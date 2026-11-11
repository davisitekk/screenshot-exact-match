
-- ============ helpers ============
ALTER TABLE public.financial_transactions ADD COLUMN reversed_at timestamptz, ADD COLUMN reversed_by uuid;
DROP INDEX public.fin_tx_origin_uniq;
CREATE UNIQUE INDEX fin_tx_origin_active_uniq ON public.financial_transactions (origin_type, origin_id)
  WHERE origin_type IN ('recebivel','pagavel','estorno') AND origin_id IS NOT NULL AND reversed_at IS NULL;

CREATE OR REPLACE FUNCTION public.order_confirmed(_status public.order_status, _pay public.payment_status)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _pay = 'pago' OR _status IN ('pagamento_aprovado','em_separacao','em_preparacao','enviado','entregue','devolvido')
$$;

CREATE OR REPLACE FUNCTION public.today_br()
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date
$$;

-- ============ stock core ============
CREATE OR REPLACE FUNCTION public._apply_stock(p_product uuid, p_type public.stock_movement_type, p_delta int, p_reason text, p_order uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_qty int; v_new int; v_allow boolean; v_name text;
BEGIN
  IF p_delta = 0 THEN RAISE EXCEPTION 'A quantidade da movimentação não pode ser zero'; END IF;
  SELECT stock_qty, name INTO v_qty, v_name FROM public.products WHERE id = p_product FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  v_new := v_qty + p_delta;
  SELECT allow_negative_stock INTO v_allow FROM public.store_settings WHERE id = 1;
  IF v_new < 0 AND NOT COALESCE(v_allow, false) THEN
    RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, necessário %', v_name, v_qty, -p_delta;
  END IF;
  PERFORM set_config('app.stock_movement', 'on', true);
  UPDATE public.products SET stock_qty = v_new WHERE id = p_product;
  PERFORM set_config('app.stock_movement', 'off', true);
  INSERT INTO public.stock_movements (product_id, type, quantity, balance_after, reason, order_id, user_id)
  VALUES (p_product, p_type, p_delta, v_new, p_reason, p_order, auth.uid());
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_stock_movement(p_product uuid, p_type public.stock_movement_type, p_quantity int, p_reason text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current int; v_delta int;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para movimentar o estoque';
  END IF;
  IF p_type IN ('venda','cancelamento') THEN
    RAISE EXCEPTION 'Movimentações de venda e cancelamento são geradas automaticamente pelos pedidos';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 0 THEN RAISE EXCEPTION 'Informe uma quantidade válida'; END IF;
  IF p_type = 'ajuste' THEN
    SELECT stock_qty INTO v_current FROM public.products WHERE id = p_product;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    v_delta := p_quantity - v_current;
    IF v_delta = 0 THEN RAISE EXCEPTION 'A quantidade contada é igual ao estoque atual'; END IF;
  ELSIF p_quantity = 0 THEN
    RAISE EXCEPTION 'Informe uma quantidade maior que zero';
  ELSIF p_type IN ('entrada','devolucao') THEN
    v_delta := p_quantity;
  ELSE
    v_delta := -p_quantity;
  END IF;
  RETURN public._apply_stock(p_product, p_type, v_delta, NULLIF(trim(COALESCE(p_reason,'')), ''), NULL);
END;
$$;

-- ============ orders ============
CREATE OR REPLACE FUNCTION public._apply_order_effects(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; v_mode text; v_conf boolean; it record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order FOR UPDATE;
  SELECT stock_deduct_on INTO v_mode FROM public.store_settings WHERE id = 1;
  v_conf := public.order_confirmed(o.status, o.payment_status);
  IF v_conf AND o.confirmed_at IS NULL AND o.status <> 'cancelado' THEN
    UPDATE public.orders SET confirmed_at = now() WHERE id = p_order;
  END IF;
  IF o.status NOT IN ('cancelado','devolvido') AND NOT o.stock_deducted AND (v_conf OR v_mode = 'pedido_criado') THEN
    FOR it IN SELECT product_id, SUM(quantity)::int AS q FROM public.order_items WHERE order_id = p_order GROUP BY product_id LOOP
      PERFORM public._apply_stock(it.product_id, 'venda', -it.q, 'Pedido #' || o.number, p_order);
    END LOOP;
    UPDATE public.orders SET stock_deducted = true WHERE id = p_order;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order(p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_number bigint; v_item jsonb; v_prod record;
  v_sub numeric := 0; v_cost numeric := 0; v_line numeric; v_total numeric;
  v_qty int; v_price numeric; v_disc numeric; v_inst int; v_first date; v_i int; v_part numeric; v_acc numeric := 0;
  v_cat uuid; v_customer uuid; v_discount numeric; v_shipping numeric; v_method text;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para registrar vendas';
  END IF;
  IF jsonb_typeof(p->'items') <> 'array' OR jsonb_array_length(p->'items') = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um produto ao pedido';
  END IF;
  v_customer := NULLIF(p->>'customer_id','')::uuid;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'Selecione o cliente do pedido'; END IF;
  v_discount := COALESCE(NULLIF(p->>'discount','')::numeric, 0);
  v_shipping := COALESCE(NULLIF(p->>'shipping','')::numeric, 0);
  v_inst := COALESCE(NULLIF(p->>'installments','')::int, 1);
  v_method := NULLIF(p->>'payment_method','');
  IF v_discount < 0 OR v_shipping < 0 THEN RAISE EXCEPTION 'Valores de desconto e frete não podem ser negativos'; END IF;

  INSERT INTO public.orders (customer_id, channel, discount, shipping, shipping_cost, payment_fee, marketplace_fee,
    payment_method, installments, status, payment_status, tracking_code, notes, created_by)
  VALUES (v_customer, COALESCE(NULLIF(p->>'channel',''), 'Manual'), v_discount, v_shipping,
    COALESCE(NULLIF(p->>'shipping_cost','')::numeric, 0), COALESCE(NULLIF(p->>'payment_fee','')::numeric, 0),
    COALESCE(NULLIF(p->>'marketplace_fee','')::numeric, 0), v_method, v_inst,
    COALESCE(NULLIF(p->>'status','')::public.order_status, 'aguardando_pagamento'),
    COALESCE(NULLIF(p->>'payment_status','')::public.payment_status, 'pendente'),
    NULLIF(p->>'tracking_code',''), NULLIF(p->>'notes',''), auth.uid())
  RETURNING id, number INTO v_id, v_number;

  IF (SELECT status FROM public.orders WHERE id = v_id) IN ('cancelado','devolvido') THEN
    RAISE EXCEPTION 'Um pedido novo não pode ser criado como cancelado ou devolvido';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
    v_qty := NULLIF(v_item->>'quantity','')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida em um dos itens'; END IF;
    SELECT id, name, cost, price, active INTO v_prod FROM public.products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    IF NOT v_prod.active THEN RAISE EXCEPTION 'O produto "%" está inativo', v_prod.name; END IF;
    v_price := COALESCE(NULLIF(v_item->>'unit_price','')::numeric, v_prod.price);
    v_disc := COALESCE(NULLIF(v_item->>'discount','')::numeric, 0);
    IF v_price < 0 OR v_disc < 0 THEN RAISE EXCEPTION 'Preço e desconto do item não podem ser negativos'; END IF;
    v_line := round(v_qty * v_price - v_disc, 2);
    IF v_line < 0 THEN RAISE EXCEPTION 'O desconto do item "%" é maior que o valor do item', v_prod.name; END IF;
    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, discount, total)
    VALUES (v_id, v_prod.id, v_prod.name, v_qty, v_price, v_prod.cost, v_disc, v_line);
    v_sub := v_sub + v_line;
    v_cost := v_cost + v_qty * v_prod.cost;
  END LOOP;

  v_total := round(v_sub - v_discount + v_shipping, 2);
  IF v_total < 0 THEN RAISE EXCEPTION 'O desconto é maior que o valor do pedido'; END IF;
  UPDATE public.orders SET subtotal = v_sub, total = v_total, cost_total = v_cost WHERE id = v_id;

  IF v_total > 0 THEN
    IF v_total < v_inst * 0.01 THEN RAISE EXCEPTION 'Número de parcelas incompatível com o valor do pedido'; END IF;
    v_first := COALESCE(NULLIF(p->>'first_due_date','')::date, public.today_br());
    SELECT id INTO v_cat FROM public.finance_categories WHERE name = 'Vendas' AND kind = 'receita' LIMIT 1;
    FOR v_i IN 1..v_inst LOOP
      IF v_i < v_inst THEN v_part := round(v_total / v_inst, 2); ELSE v_part := v_total - v_acc; END IF;
      v_acc := v_acc + v_part;
      INSERT INTO public.receivables (order_id, customer_id, category_id, description, installment_no, installment_count,
        amount, due_date, payment_method, created_by)
      VALUES (v_id, v_customer, v_cat,
        'Pedido #' || v_number || CASE WHEN v_inst > 1 THEN ' – parcela ' || v_i || '/' || v_inst ELSE '' END,
        v_i, v_inst, v_part, (v_first + ((v_i - 1) || ' months')::interval)::date, v_method, auth.uid());
    END LOOP;
  END IF;

  PERFORM public._apply_order_effects(v_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order uuid, p_status public.order_status, p_payment_status public.payment_status DEFAULT NULL, p_tracking text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; it record;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar pedidos';
  END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.status IN ('cancelado','devolvido') AND p_status <> o.status THEN
    RAISE EXCEPTION 'Pedidos cancelados ou devolvidos não podem mudar de status';
  END IF;
  IF p_status = 'devolvido' AND NOT public.order_confirmed(o.status, o.payment_status) THEN
    RAISE EXCEPTION 'Só é possível marcar como devolvido um pedido que foi confirmado';
  END IF;

  IF p_status = 'cancelado' AND o.status <> 'cancelado' THEN
    IF o.stock_deducted THEN
      FOR it IN SELECT product_id, SUM(quantity)::int AS q FROM public.order_items WHERE order_id = p_order GROUP BY product_id LOOP
        PERFORM public._apply_stock(it.product_id, 'cancelamento', it.q, 'Cancelamento do pedido #' || o.number, p_order);
      END LOOP;
      UPDATE public.orders SET stock_deducted = false WHERE id = p_order;
    END IF;
    UPDATE public.receivables SET status = 'cancelado' WHERE order_id = p_order AND status = 'pendente';
  END IF;
  IF p_status = 'devolvido' AND o.status <> 'devolvido' THEN
    UPDATE public.receivables SET status = 'cancelado' WHERE order_id = p_order AND status = 'pendente';
  END IF;

  UPDATE public.orders SET
    status = p_status,
    payment_status = CASE WHEN p_status = 'cancelado' AND o.payment_status = 'pendente' THEN 'pendente' ELSE COALESCE(p_payment_status, o.payment_status) END,
    tracking_code = COALESCE(NULLIF(p_tracking,''), o.tracking_code)
  WHERE id = p_order;

  PERFORM public._apply_order_effects(p_order);
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_returned_order(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; it record;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para conferir devoluções';
  END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.status <> 'devolvido' THEN RAISE EXCEPTION 'O pedido precisa estar com status Devolvido'; END IF;
  IF o.return_restocked THEN RAISE EXCEPTION 'Os produtos deste pedido já retornaram ao estoque'; END IF;
  IF o.stock_deducted THEN
    FOR it IN SELECT product_id, SUM(quantity)::int AS q FROM public.order_items WHERE order_id = p_order GROUP BY product_id LOOP
      PERFORM public._apply_stock(it.product_id, 'devolucao', it.q, 'Devolução conferida do pedido #' || o.number, p_order);
    END LOOP;
  END IF;
  UPDATE public.orders SET return_restocked = true, stock_deducted = false WHERE id = p_order;
END;
$$;

-- ============ finance ============
CREATE OR REPLACE FUNCTION public.receive_receivable(p_id uuid, p_account uuid, p_date date DEFAULT NULL, p_amount numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.receivables%ROWTYPE; v_amount numeric; v_date date;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para dar baixa em recebimentos';
  END IF;
  SELECT * INTO r FROM public.receivables WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;
  IF r.status <> 'pendente' THEN RAISE EXCEPTION 'Este recebimento já foi baixado ou cancelado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE id = p_account AND active) THEN
    RAISE EXCEPTION 'Selecione uma conta financeira ativa';
  END IF;
  v_amount := COALESCE(p_amount, r.amount);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'O valor recebido deve ser maior que zero'; END IF;
  v_date := COALESCE(p_date, public.today_br());
  UPDATE public.receivables SET status = 'pago', received_amount = v_amount, received_at = v_date, account_id = p_account WHERE id = p_id;
  INSERT INTO public.financial_transactions (account_id, type, amount, date, description, category_id, origin_type, origin_id, created_by)
  VALUES (p_account, 'entrada', v_amount, v_date, r.description, r.category_id, 'recebivel', r.id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_payable(p_id uuid, p_account uuid, p_date date DEFAULT NULL, p_amount numeric DEFAULT NULL, p_method text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.payables%ROWTYPE; v_amount numeric; v_date date;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para pagar contas';
  END IF;
  SELECT * INTO b FROM public.payables WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
  IF b.status <> 'pendente' THEN RAISE EXCEPTION 'Esta conta já foi paga ou cancelada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE id = p_account AND active) THEN
    RAISE EXCEPTION 'Selecione uma conta financeira ativa';
  END IF;
  v_amount := COALESCE(p_amount, b.amount);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'O valor pago deve ser maior que zero'; END IF;
  v_date := COALESCE(p_date, public.today_br());
  UPDATE public.payables SET status = 'pago', paid_amount = v_amount, paid_at = v_date, account_id = p_account,
    payment_method = COALESCE(NULLIF(p_method,''), payment_method) WHERE id = p_id;
  INSERT INTO public.financial_transactions (account_id, type, amount, date, description, category_id, origin_type, origin_id, created_by)
  VALUES (p_account, 'saida', v_amount, v_date, b.description, b.category_id, 'pagavel', b.id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_bill(p_kind text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.financial_transactions%ROWTYPE; v_origin text;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para estornar lançamentos';
  END IF;
  v_origin := CASE p_kind WHEN 'receber' THEN 'recebivel' WHEN 'pagar' THEN 'pagavel' ELSE NULL END;
  IF v_origin IS NULL THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  SELECT * INTO t FROM public.financial_transactions WHERE origin_type = v_origin AND origin_id = p_id AND reversed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma baixa ativa encontrada para estornar'; END IF;
  UPDATE public.financial_transactions SET reversed_at = now(), reversed_by = auth.uid() WHERE id = t.id;
  INSERT INTO public.financial_transactions (account_id, type, amount, date, description, category_id, origin_type, origin_id, created_by)
  VALUES (t.account_id, CASE WHEN t.type = 'entrada' THEN 'saida'::public.transaction_type ELSE 'entrada'::public.transaction_type END,
    t.amount, public.today_br(), 'Estorno: ' || t.description, t.category_id, 'estorno', t.id, auth.uid());
  IF v_origin = 'recebivel' THEN
    UPDATE public.receivables SET status = 'pendente', received_amount = NULL, received_at = NULL, account_id = NULL WHERE id = p_id;
  ELSE
    UPDATE public.payables SET status = 'pendente', paid_amount = NULL, paid_at = NULL, account_id = NULL WHERE id = p_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_between_accounts(p_from uuid, p_to uuid, p_amount numeric, p_date date DEFAULT NULL, p_description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group uuid := gen_random_uuid(); v_date date; v_desc text; v_from text; v_to text;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) THEN
    RAISE EXCEPTION 'Você não tem permissão para transferências';
  END IF;
  IF p_from = p_to THEN RAISE EXCEPTION 'Escolha contas de origem e destino diferentes'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'O valor deve ser maior que zero'; END IF;
  SELECT name INTO v_from FROM public.financial_accounts WHERE id = p_from AND active;
  SELECT name INTO v_to FROM public.financial_accounts WHERE id = p_to AND active;
  IF v_from IS NULL OR v_to IS NULL THEN RAISE EXCEPTION 'Selecione contas ativas'; END IF;
  v_date := COALESCE(p_date, public.today_br());
  v_desc := COALESCE(NULLIF(trim(COALESCE(p_description,'')),''), 'Transferência ' || v_from || ' → ' || v_to);
  INSERT INTO public.financial_transactions (account_id, type, amount, date, description, origin_type, transfer_group, created_by)
  VALUES (p_from, 'transferencia_saida', p_amount, v_date, v_desc, 'transferencia', v_group, auth.uid()),
         (p_to, 'transferencia_entrada', p_amount, v_date, v_desc, 'transferencia', v_group, auth.uid());
  RETURN v_group;
END;
$$;

-- ============ views ============
CREATE VIEW public.account_balances WITH (security_invoker = on) AS
SELECT a.id, a.name, a.type, a.active, a.initial_balance, a.details,
  a.initial_balance + COALESCE(SUM(CASE WHEN t.type IN ('entrada','transferencia_entrada') THEN t.amount ELSE -t.amount END), 0) AS balance
FROM public.financial_accounts a
LEFT JOIN public.financial_transactions t ON t.account_id = a.id
GROUP BY a.id;
GRANT SELECT ON public.account_balances TO authenticated;

CREATE VIEW public.customer_summary WITH (security_invoker = on) AS
SELECT c.id,
  COUNT(o.id) FILTER (WHERE o.status <> 'cancelado') AS order_count,
  COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelado','devolvido') AND public.order_confirmed(o.status, o.payment_status)), 0) AS total_spent,
  MAX(o.created_at) FILTER (WHERE o.status <> 'cancelado') AS last_purchase
FROM public.customers c
LEFT JOIN public.orders o ON o.customer_id = c.id
GROUP BY c.id;
GRANT SELECT ON public.customer_summary TO authenticated;

CREATE VIEW public.product_sales WITH (security_invoker = on) AS
SELECT p.id AS product_id,
  COALESCE(SUM(oi.quantity) FILTER (WHERE o.id IS NOT NULL), 0) AS qty_sold,
  COALESCE(SUM(oi.total) FILTER (WHERE o.id IS NOT NULL), 0) AS revenue,
  COALESCE(SUM(oi.total - oi.quantity * oi.unit_cost) FILTER (WHERE o.id IS NOT NULL), 0) AS profit,
  MAX(o.created_at) AS last_sold_at
FROM public.products p
LEFT JOIN public.order_items oi ON oi.product_id = p.id
LEFT JOIN public.orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelado','devolvido') AND public.order_confirmed(o.status, o.payment_status)
GROUP BY p.id;
GRANT SELECT ON public.product_sales TO authenticated;

-- ============ dashboard ============
CREATE OR REPLACE FUNCTION public.get_dashboard(p_start date, p_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := public.today_br(); v_fin boolean; r jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  v_fin := public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]);

  WITH o AS (
    SELECT ord.*, (ord.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d,
      public.order_confirmed(ord.status, ord.payment_status) AS conf
    FROM public.orders ord
  ), per AS (SELECT * FROM o WHERE d BETWEEN p_start AND p_end),
  valid AS (SELECT * FROM per WHERE conf AND status NOT IN ('cancelado','devolvido')),
  vitems AS (SELECT oi.* FROM public.order_items oi JOIN valid ON valid.id = oi.order_id)
  SELECT jsonb_build_object(
    'today_sales', (SELECT COALESCE(SUM(total),0) FROM o WHERE d = v_today AND conf AND status NOT IN ('cancelado','devolvido')),
    'month_sales', (SELECT COALESCE(SUM(total),0) FROM o WHERE date_trunc('month', d) = date_trunc('month', v_today) AND conf AND status NOT IN ('cancelado','devolvido')),
    'gross', (SELECT COALESCE(SUM(subtotal + shipping),0) FROM per WHERE conf AND status <> 'cancelado'),
    'discounts', (SELECT COALESCE(SUM(discount),0) FROM valid),
    'returns', (SELECT COALESCE(SUM(subtotal + shipping),0) FROM per WHERE conf AND status = 'devolvido'),
    'payment_fees', (SELECT COALESCE(SUM(payment_fee),0) FROM per WHERE conf AND status <> 'cancelado'),
    'marketplace_fees', (SELECT COALESCE(SUM(marketplace_fee),0) FROM per WHERE conf AND status <> 'cancelado'),
    'shipping_costs', (SELECT COALESCE(SUM(shipping_cost),0) FROM per WHERE conf AND status <> 'cancelado'),
    'cogs', (SELECT COALESCE(SUM(cost_total),0) FROM valid),
    'valid_total', (SELECT COALESCE(SUM(total),0) FROM valid),
    'valid_count', (SELECT count(*) FROM valid),
    'orders_total', (SELECT count(*) FROM per),
    'orders_by_status', (SELECT COALESCE(jsonb_object_agg(status, c), '{}'::jsonb) FROM (SELECT status, count(*) AS c FROM per GROUP BY status) s),
    'items_sold', (SELECT COALESCE(SUM(quantity),0) FROM vitems),
    'daily', (SELECT COALESCE(jsonb_agg(x ORDER BY x.d), '[]'::jsonb) FROM (
        SELECT d, SUM(total) AS total, SUM(total - cost_total - payment_fee - marketplace_fee - shipping_cost) AS profit, count(*) AS orders
        FROM valid GROUP BY d) x),
    'top_products', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT product_name AS name, SUM(quantity) AS qty, SUM(total) AS revenue, SUM(total - quantity * unit_cost) AS profit
        FROM vitems GROUP BY product_id, product_name ORDER BY SUM(quantity) DESC LIMIT 8) t),
    'by_category', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT COALESCE(c.name, 'Sem categoria') AS name, SUM(vi.total) AS total
        FROM vitems vi JOIN public.products p ON p.id = vi.product_id LEFT JOIN public.product_categories c ON c.id = p.category_id
        GROUP BY 1 ORDER BY 2 DESC) t),
    'by_payment', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT COALESCE(payment_method, 'Não informado') AS name, SUM(total) AS total, count(*) AS orders
        FROM valid GROUP BY 1 ORDER BY 2 DESC) t),
    'top_margin', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT name, margin, price, cost FROM public.products WHERE active AND price > 0 ORDER BY margin DESC LIMIT 8) t),
    'low_stock', (SELECT count(*) FROM public.products WHERE active AND stock_qty > 0 AND stock_qty <= min_stock),
    'out_of_stock', (SELECT count(*) FROM public.products WHERE active AND stock_qty <= 0)
  ) INTO r;

  IF v_fin THEN
    r := r || jsonb_build_object(
      'opex', (SELECT COALESCE(SUM(p.amount),0) FROM public.payables p LEFT JOIN public.finance_categories fc ON fc.id = p.category_id
               WHERE p.status <> 'cancelado' AND p.issue_date BETWEEN p_start AND p_end AND NOT COALESCE(fc.is_merchandise, false)),
      'payables_open', (SELECT COALESCE(SUM(amount),0) FROM public.payables WHERE status = 'pendente'),
      'payables_overdue', (SELECT count(*) FROM public.payables WHERE status = 'pendente' AND due_date < v_today),
      'receivables_open', (SELECT COALESCE(SUM(amount),0) FROM public.receivables WHERE status = 'pendente'),
      'receivables_overdue', (SELECT count(*) FROM public.receivables WHERE status = 'pendente' AND due_date < v_today),
      'cash_balance', (SELECT COALESCE(SUM(balance),0) FROM public.account_balances WHERE active)
    );
  END IF;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cash_flow(p_start date, p_end date, p_account uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_opening numeric; v_rows jsonb; v_in numeric; v_out numeric; v_tin numeric; v_tout numeric;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT COALESCE(SUM(initial_balance),0) INTO v_opening FROM public.financial_accounts WHERE p_account IS NULL OR id = p_account;
  SELECT v_opening + COALESCE(SUM(CASE WHEN type IN ('entrada','transferencia_entrada') THEN amount ELSE -amount END),0) INTO v_opening
  FROM public.financial_transactions WHERE date < p_start AND (p_account IS NULL OR account_id = p_account);
  SELECT COALESCE(SUM(amount) FILTER (WHERE type='entrada'),0), COALESCE(SUM(amount) FILTER (WHERE type='saida'),0),
         COALESCE(SUM(amount) FILTER (WHERE type='transferencia_entrada'),0), COALESCE(SUM(amount) FILTER (WHERE type='transferencia_saida'),0)
    INTO v_in, v_out, v_tin, v_tout
  FROM public.financial_transactions WHERE date BETWEEN p_start AND p_end AND (p_account IS NULL OR account_id = p_account);
  SELECT COALESCE(jsonb_agg(x ORDER BY x.d), '[]'::jsonb) INTO v_rows FROM (
    SELECT date AS d,
      COALESCE(SUM(amount) FILTER (WHERE type='entrada'),0) AS entradas,
      COALESCE(SUM(amount) FILTER (WHERE type='saida'),0) AS saidas,
      COALESCE(SUM(CASE WHEN type IN ('entrada','transferencia_entrada') THEN amount ELSE -amount END),0) AS net
    FROM public.financial_transactions WHERE date BETWEEN p_start AND p_end AND (p_account IS NULL OR account_id = p_account)
    GROUP BY date) x;
  RETURN jsonb_build_object('opening', v_opening, 'entradas', v_in, 'saidas', v_out,
    'transfer_in', v_tin, 'transfer_out', v_tout, 'closing', v_opening + v_in - v_out + v_tin - v_tout, 'daily', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_alerts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := public.today_br(); s public.store_settings%ROWTYPE; r jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO s FROM public.store_settings WHERE id = 1;
  r := jsonb_build_object(
    'low_stock', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT id, name, stock_qty, min_stock FROM public.products WHERE active AND stock_qty > 0 AND stock_qty <= min_stock ORDER BY stock_qty LIMIT 20) t),
    'out_of_stock', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT id, name, stock_qty FROM public.products WHERE active AND stock_qty <= 0 ORDER BY name LIMIT 20) t),
    'awaiting_payment', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT id, number, total, created_at FROM public.orders WHERE status = 'aguardando_pagamento' ORDER BY created_at LIMIT 20) t),
    'stale_orders', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT id, number, status, updated_at FROM public.orders
        WHERE status NOT IN ('entregue','cancelado','devolvido') AND updated_at < now() - make_interval(days => s.stale_order_days) ORDER BY updated_at LIMIT 20) t),
    'recent_purchases', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT o.id, o.number, o.total, c.name AS customer, o.created_at FROM public.orders o LEFT JOIN public.customers c ON c.id = o.customer_id
        WHERE o.created_at > now() - interval '24 hours' AND o.status <> 'cancelado' ORDER BY o.created_at DESC LIMIT 10) t),
    'slow_products', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT p.id, p.name, p.stock_qty, ps.last_sold_at FROM public.products p JOIN public.product_sales ps ON ps.product_id = p.id
        WHERE p.active AND p.stock_qty > 0 AND p.created_at < now() - interval '60 days' AND (ps.last_sold_at IS NULL OR ps.last_sold_at < now() - interval '60 days') ORDER BY ps.last_sold_at NULLS FIRST LIMIT 20) t)
  );
  IF public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) THEN
    r := r || jsonb_build_object(
      'payables_due_soon', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT id, description, amount, due_date FROM public.payables WHERE status = 'pendente' AND due_date BETWEEN v_today AND v_today + s.due_alert_days ORDER BY due_date LIMIT 20) t),
      'payables_overdue', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT id, description, amount, due_date FROM public.payables WHERE status = 'pendente' AND due_date < v_today ORDER BY due_date LIMIT 20) t),
      'receivables_overdue', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT id, description, amount, due_date FROM public.receivables WHERE status = 'pendente' AND due_date < v_today ORDER BY due_date LIMIT 20) t)
    );
  END IF;
  RETURN r;
END;
$$;

-- ============ execution privileges ============
REVOKE EXECUTE ON FUNCTION public._apply_stock(uuid, public.stock_movement_type, int, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._apply_order_effects(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_price_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_stock_movement(uuid, public.stock_movement_type, int, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, public.order_status, public.payment_status, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restock_returned_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_receivable(uuid, uuid, date, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pay_payable(uuid, uuid, date, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reverse_bill(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, numeric, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_cash_flow(date, date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_stock_movement(uuid, public.stock_movement_type, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, public.order_status, public.payment_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restock_returned_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_receivable(uuid, uuid, date, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_payable(uuid, uuid, date, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_bill(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_flow(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_alerts() TO authenticated;
