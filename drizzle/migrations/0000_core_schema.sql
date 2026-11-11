
-- ===================== ENUMS =====================
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'vendas');
CREATE TYPE public.order_status AS ENUM ('aguardando_pagamento','pagamento_aprovado','em_separacao','em_preparacao','enviado','entregue','cancelado','devolvido');
CREATE TYPE public.payment_status AS ENUM ('pendente','pago','estornado');
CREATE TYPE public.stock_movement_type AS ENUM ('entrada','saida','venda','devolucao','ajuste','perda','cancelamento');
CREATE TYPE public.account_type AS ENUM ('banco','caixa','pix','carteira_digital','mercado_pago','outro');
CREATE TYPE public.transaction_type AS ENUM ('entrada','saida','transferencia_entrada','transferencia_saida');
CREATE TYPE public.bill_status AS ENUM ('pendente','pago','cancelado');
CREATE TYPE public.finance_kind AS ENUM ('receita','despesa');

-- ===================== PROFILES & ROLES =====================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = _role AND p.active
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = ANY(_roles) AND p.active
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','financeiro','vendas']::public.app_role[])
$$;

CREATE POLICY "Staff can view profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND active = (SELECT p.active FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "View own or admin roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- New user -> profile; very first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email,''));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===================== SETTINGS =====================
CREATE TABLE public.store_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name text NOT NULL DEFAULT 'Minha Loja',
  logo_url text,
  document text,
  address text,
  phone text,
  email text,
  currency text NOT NULL DEFAULT 'BRL',
  payment_methods text[] NOT NULL DEFAULT ARRAY['PIX','Cartão de crédito','Cartão de débito','Boleto','Dinheiro','Transferência'],
  default_min_stock int NOT NULL DEFAULT 5,
  allow_negative_stock boolean NOT NULL DEFAULT false,
  stock_deduct_on text NOT NULL DEFAULT 'pagamento_aprovado' CHECK (stock_deduct_on IN ('pagamento_aprovado','pedido_criado')),
  bank_details text,
  notify_low_stock boolean NOT NULL DEFAULT true,
  notify_due_bills boolean NOT NULL DEFAULT true,
  notify_pending_orders boolean NOT NULL DEFAULT true,
  due_alert_days int NOT NULL DEFAULT 3,
  stale_order_days int NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view settings" ON public.store_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin update settings" ON public.store_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.store_settings (id) VALUES (1);
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===================== CATEGORIES =====================
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view product categories" ON public.product_categories FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Sales/admin manage product categories" ON public.product_categories FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));

CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.finance_kind NOT NULL,
  is_merchandise boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance view categories" ON public.finance_categories FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]));
CREATE POLICY "Finance manage categories" ON public.finance_categories FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]));
INSERT INTO public.finance_categories (name, kind, is_merchandise) VALUES
 ('Vendas','receita',false),('Outras receitas','receita',false),
 ('Compra de mercadorias','despesa',true),('Aluguel','despesa',false),('Internet','despesa',false),
 ('Energia elétrica','despesa',false),('Marketing e publicidade','despesa',false),('Embalagens','despesa',false),
 ('Fretes','despesa',false),('Taxas de plataformas','despesa',false),('Impostos','despesa',false),
 ('Serviços contratados','despesa',false),('Despesas fixas','despesa',false),('Despesas variáveis','despesa',false),
 ('Outras despesas','despesa',false);

-- ===================== SUPPLIERS =====================
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  contact_name text,
  phone text,
  email text,
  address text,
  products_supplied text,
  payment_terms text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===================== PRODUCTS =====================
CREATE SEQUENCE public.product_code_seq START 1000;
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('P' || nextval('public.product_code_seq')::text),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  brand text,
  barcode text,
  sku text UNIQUE,
  image_url text,
  cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  margin numeric(8,2) GENERATED ALWAYS AS (CASE WHEN price > 0 THEN round(((price - cost) / price) * 100, 2) ELSE 0 END) STORED,
  stock_qty int NOT NULL DEFAULT 0,
  min_stock int NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  weight_kg numeric(10,3),
  height_cm numeric(10,2),
  width_cm numeric(10,2),
  length_cm numeric(10,2),
  variations text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view products" ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Sales/admin insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));
CREATE POLICY "Sales/admin update products" ON public.products FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));
CREATE POLICY "Admin delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- stock_qty may only change through stock movements
CREATE OR REPLACE FUNCTION public.guard_product_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock_qty <> 0 AND current_setting('app.stock_movement', true) IS DISTINCT FROM 'on' THEN
      NEW.stock_qty := 0;
    END IF;
  ELSIF NEW.stock_qty IS DISTINCT FROM OLD.stock_qty AND current_setting('app.stock_movement', true) IS DISTINCT FROM 'on' THEN
    NEW.stock_qty := OLD.stock_qty;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER products_guard_stock BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_product_stock();

CREATE TABLE public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_cost numeric(12,2),
  new_cost numeric(12,2) NOT NULL,
  old_price numeric(12,2),
  new_price numeric(12,2) NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_price_history TO authenticated;
GRANT ALL ON public.product_price_history TO service_role;
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view price history" ON public.product_price_history FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.track_price_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.cost IS DISTINCT FROM OLD.cost OR NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO public.product_price_history (product_id, old_cost, new_cost, old_price, new_price, changed_by)
    VALUES (NEW.id, CASE WHEN TG_OP='UPDATE' THEN OLD.cost END, NEW.cost, CASE WHEN TG_OP='UPDATE' THEN OLD.price END, NEW.price, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER products_price_history AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.track_price_change();

-- ===================== CUSTOMERS =====================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  document text,
  phone text,
  whatsapp text,
  email text,
  birth_date date,
  address text,
  address_number text,
  complement text,
  district text,
  city text,
  state text,
  zip text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_document_uniq ON public.customers (document) WHERE document IS NOT NULL AND document <> '';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view customers" ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Sales/admin insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));
CREATE POLICY "Sales/admin update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));
CREATE POLICY "Admin delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER customers_touch BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===================== FINANCIAL ACCOUNTS =====================
CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.account_type NOT NULL DEFAULT 'banco',
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  details text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance view accounts" ON public.financial_accounts FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]));
CREATE POLICY "Finance manage accounts" ON public.financial_accounts FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]));

-- ===================== ORDERS =====================
CREATE SEQUENCE public.order_number_seq START 1001;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint NOT NULL UNIQUE DEFAULT nextval('public.order_number_seq'),
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  channel text NOT NULL DEFAULT 'Manual',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping >= 0),
  shipping_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  payment_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (payment_fee >= 0),
  marketplace_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (marketplace_fee >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0,
  cost_total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  installments int NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 48),
  payment_status public.payment_status NOT NULL DEFAULT 'pendente',
  status public.order_status NOT NULL DEFAULT 'aguardando_pagamento',
  tracking_code text,
  notes text,
  stock_deducted boolean NOT NULL DEFAULT false,
  return_restocked boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view orders" ON public.orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Sales/admin update order notes" ON public.orders FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12,2) NOT NULL
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
CREATE INDEX order_items_product_idx ON public.order_items(product_id);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view order items" ON public.order_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===================== STOCK MOVEMENTS =====================
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity int NOT NULL CHECK (quantity <> 0),
  balance_after int NOT NULL,
  reason text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_product_idx ON public.stock_movements(product_id, created_at DESC);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===================== RECEIVABLES / PAYABLES / TRANSACTIONS =====================
CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  description text NOT NULL,
  installment_no int NOT NULL DEFAULT 1,
  installment_count int NOT NULL DEFAULT 1,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  payment_method text,
  status public.bill_status NOT NULL DEFAULT 'pendente',
  received_amount numeric(12,2),
  received_at date,
  account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, installment_no)
);
GRANT SELECT, INSERT, UPDATE ON public.receivables TO authenticated;
GRANT ALL ON public.receivables TO service_role;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance view receivables" ON public.receivables FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]));
CREATE POLICY "Finance insert manual receivables" ON public.receivables FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) AND order_id IS NULL AND status = 'pendente');
CREATE POLICY "Finance update pending receivables" ON public.receivables FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) AND status = 'pendente')
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) AND status IN ('pendente','cancelado'));
CREATE TRIGGER receivables_touch BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL CHECK (length(trim(description)) > 0),
  category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  issue_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  due_date date NOT NULL,
  paid_at date,
  paid_amount numeric(12,2),
  payment_method text,
  account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  status public.bill_status NOT NULL DEFAULT 'pendente',
  document_ref text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payables TO authenticated;
GRANT ALL ON public.payables TO service_role;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance view payables" ON public.payables FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]));
CREATE POLICY "Finance insert payables" ON public.payables FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) AND status = 'pendente');
CREATE POLICY "Finance update pending payables" ON public.payables FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) AND status = 'pendente')
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]) AND status IN ('pendente','cancelado'));
CREATE TRIGGER payables_touch BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  type public.transaction_type NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  date date NOT NULL,
  description text NOT NULL,
  category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  origin_type text NOT NULL CHECK (origin_type IN ('recebivel','pagavel','transferencia','manual','estorno')),
  origin_id uuid,
  transfer_group uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fin_tx_origin_uniq ON public.financial_transactions (origin_type, origin_id) WHERE origin_type IN ('recebivel','pagavel','estorno') AND origin_id IS NOT NULL;
CREATE INDEX fin_tx_date_idx ON public.financial_transactions (date);
GRANT SELECT ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance view transactions" ON public.financial_transactions FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','financeiro']::public.app_role[]));

-- ===================== ACTIVITY LOG =====================
CREATE TABLE public.activity_log (
  id bigserial PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_created_idx ON public.activity_log (created_at DESC);
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view activity" ON public.activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_id := (to_jsonb(OLD)->>'id'); ELSE v_id := (to_jsonb(NEW)->>'id'); END IF;
  INSERT INTO public.activity_log (user_id, action, entity, entity_id, old_data, new_data)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, v_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','customers','suppliers','orders','receivables','payables','financial_accounts','financial_transactions','store_settings','user_roles','profiles','product_categories','finance_categories']
  LOOP
    EXECUTE format('CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_activity()', t, t);
  END LOOP;
END $$;
