
-- Restrict direct updates to safe columns; state changes go through functions
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT UPDATE (notes, tracking_code) ON public.orders TO authenticated;

REVOKE UPDATE ON public.receivables FROM authenticated;
GRANT UPDATE (description, amount, due_date, payment_method, notes, status, category_id, customer_id) ON public.receivables TO authenticated;

REVOKE UPDATE ON public.payables FROM authenticated;
GRANT UPDATE (description, category_id, supplier_id, amount, issue_date, due_date, payment_method, status, document_ref, notes) ON public.payables TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, active) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.financial_accounts FROM authenticated;
GRANT UPDATE (name, type, details, active, initial_balance) ON public.financial_accounts TO authenticated;

-- Admins cannot block themselves out by accident
CREATE OR REPLACE FUNCTION public.guard_profile_self_block()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id = auth.uid() AND OLD.active AND NOT NEW.active THEN
    RAISE EXCEPTION 'Você não pode bloquear o seu próprio usuário';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_guard_self_block BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_block();

-- Storage: product images (private bucket, staff only)
CREATE POLICY "Staff read product images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));
CREATE POLICY "Sales/admin upload product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));
CREATE POLICY "Sales/admin update product images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));
CREATE POLICY "Sales/admin delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_any_role(auth.uid(), ARRAY['admin','vendas']::public.app_role[]));
