-- Subcategories: one level of nesting under a top-level category
ALTER TABLE public.product_categories
  ADD COLUMN parent_id uuid REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  ADD COLUMN description text,
  ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS product_categories_name_key;
CREATE UNIQUE INDEX product_categories_parent_name_uniq
  ON public.product_categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));
CREATE INDEX product_categories_parent_idx ON public.product_categories(parent_id);

CREATE OR REPLACE FUNCTION public.validate_category_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_parent_parent uuid;
BEGIN
  IF length(trim(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Informe o nome da categoria.';
  END IF;
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Uma categoria não pode ser subcategoria dela mesma.';
  END IF;
  SELECT parent_id INTO v_parent_parent FROM public.product_categories WHERE id = NEW.parent_id;
  IF v_parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'Subcategorias só podem ficar dentro de uma categoria principal.';
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.product_categories WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'Esta categoria tem subcategorias e não pode virar subcategoria.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_category_parent
  BEFORE INSERT OR UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_category_parent();