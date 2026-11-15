-- 1) Visitors who are not signed in get no direct access to any app table or view (everything is staff-only).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m') LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
  END LOOP;
END $$;

-- 2) A customer with receivables cannot be deleted (finance history must keep its customer).
ALTER TABLE public.receivables DROP CONSTRAINT receivables_customer_id_fkey;
ALTER TABLE public.receivables ADD CONSTRAINT receivables_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

-- 3) Brazilian document validation (server side, same algorithm as the UI).
CREATE OR REPLACE FUNCTION public.is_valid_cpf(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int; r int; i int;
BEGIN
  IF length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0; FOR i IN 1..9 LOOP s := s + substr(d, i, 1)::int * (11 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  IF r <> substr(d, 10, 1)::int THEN RETURN false; END IF;
  s := 0; FOR i IN 1..10 LOOP s := s + substr(d, i, 1)::int * (12 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  RETURN r = substr(d, 11, 1)::int;
END $$;

CREATE OR REPLACE FUNCTION public.is_valid_cnpj(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  w1 int[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2]; w2 int[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; i int;
BEGIN
  IF length(d) <> 14 OR d ~ '^(\d)\1{13}$' THEN RETURN false; END IF;
  s := 0; FOR i IN 1..12 LOOP s := s + substr(d, i, 1)::int * w1[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF r <> substr(d, 13, 1)::int THEN RETURN false; END IF;
  s := 0; FOR i IN 1..13 LOOP s := s + substr(d, i, 1)::int * w2[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  RETURN r = substr(d, 14, 1)::int;
END $$;

-- 4) Normalize and validate every customer write, whatever client sends it.
CREATE OR REPLACE FUNCTION public.normalize_customer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.name := btrim(regexp_replace(coalesce(NEW.name, ''), '\s+', ' ', 'g'));
  IF NEW.name = '' THEN RAISE EXCEPTION 'Informe o nome do cliente.'; END IF;

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
  NEW.whatsapp := nullif(regexp_replace(coalesce(NEW.whatsapp, ''), '\D', '', 'g'), '');
  IF NEW.phone IS NOT NULL AND length(NEW.phone) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'Telefone inválido: informe DDD e número.'; END IF;
  IF NEW.whatsapp IS NOT NULL AND length(NEW.whatsapp) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'WhatsApp inválido: informe DDD e número.'; END IF;

  NEW.email := nullif(lower(btrim(coalesce(NEW.email, ''))), '');
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail inválido.'; END IF;

  NEW.zip := nullif(regexp_replace(coalesce(NEW.zip, ''), '\D', '', 'g'), '');
  IF NEW.zip IS NOT NULL AND length(NEW.zip) <> 8 THEN RAISE EXCEPTION 'CEP deve ter 8 dígitos.'; END IF;

  NEW.state := nullif(upper(btrim(coalesce(NEW.state, ''))), '');
  IF NEW.state IS NOT NULL AND NEW.state NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN
    RAISE EXCEPTION 'UF inválida.';
  END IF;

  IF NEW.birth_date IS NOT NULL AND (NEW.birth_date > public.today_br() OR NEW.birth_date < DATE '1900-01-01') THEN
    RAISE EXCEPTION 'Data de nascimento inválida.';
  END IF;

  NEW.address := nullif(btrim(coalesce(NEW.address, '')), '');
  NEW.address_number := nullif(btrim(coalesce(NEW.address_number, '')), '');
  NEW.complement := nullif(btrim(coalesce(NEW.complement, '')), '');
  NEW.district := nullif(btrim(coalesce(NEW.district, '')), '');
  NEW.city := nullif(btrim(coalesce(NEW.city, '')), '');
  NEW.notes := nullif(btrim(coalesce(NEW.notes, '')), '');
  RETURN NEW;
END $$;

CREATE TRIGGER customers_normalize BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.normalize_customer();

-- 5) Fast history listing by date and by type.
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON public.stock_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS customers_name_idx ON public.customers (lower(name));