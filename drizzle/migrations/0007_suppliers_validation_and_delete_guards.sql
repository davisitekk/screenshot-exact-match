-- 1) Normalize and validate every supplier write, whatever client sends it (same rules as customers).
CREATE OR REPLACE FUNCTION public.normalize_supplier()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.name := btrim(regexp_replace(coalesce(NEW.name, ''), '\s+', ' ', 'g'));
  IF NEW.name = '' THEN RAISE EXCEPTION 'Informe o nome do fornecedor.'; END IF;

  NEW.document := nullif(regexp_replace(coalesce(NEW.document, ''), '\D', '', 'g'), '');
  IF NEW.document IS NOT NULL THEN
    IF length(NEW.document) = 11 THEN
      IF NOT public.is_valid_cpf(NEW.document) THEN RAISE EXCEPTION 'CPF inválido.'; END IF;
    ELSIF length(NEW.document) = 14 THEN
      IF NOT public.is_valid_cnpj(NEW.document) THEN RAISE EXCEPTION 'CNPJ inválido.'; END IF;
    ELSE
      RAISE EXCEPTION 'CPF deve ter 11 dígitos e CNPJ 14 dígitos.';
    END IF;
  END IF;

  NEW.phone := nullif(regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g'), '');
  IF NEW.phone IS NOT NULL AND length(NEW.phone) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'Telefone inválido: informe DDD e número.'; END IF;

  NEW.email := nullif(lower(btrim(coalesce(NEW.email, ''))), '');
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido.'; END IF;

  NEW.contact_name := nullif(btrim(coalesce(NEW.contact_name, '')), '');
  NEW.address := nullif(btrim(coalesce(NEW.address, '')), '');
  NEW.products_supplied := nullif(btrim(coalesce(NEW.products_supplied, '')), '');
  NEW.payment_terms := nullif(btrim(coalesce(NEW.payment_terms, '')), '');
  NEW.notes := nullif(btrim(coalesce(NEW.notes, '')), '');
  RETURN NEW;
END $$;

CREATE TRIGGER suppliers_normalize BEFORE INSERT OR UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.normalize_supplier();

-- 2) The same CPF/CNPJ cannot be registered for two suppliers.
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_document_uniq ON public.suppliers (document)
  WHERE document IS NOT NULL AND document <> '';
CREATE INDEX IF NOT EXISTS suppliers_name_idx ON public.suppliers (lower(name));

-- 3) A supplier linked to products or bills cannot be deleted (it must be deactivated instead),
--    so products and payables never silently lose their supplier.
ALTER TABLE public.products DROP CONSTRAINT products_supplier_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;
ALTER TABLE public.payables DROP CONSTRAINT payables_supplier_id_fkey;
ALTER TABLE public.payables ADD CONSTRAINT payables_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;