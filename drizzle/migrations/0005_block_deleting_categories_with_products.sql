ALTER TABLE public.products DROP CONSTRAINT products_category_id_fkey;
ALTER TABLE public.products
  ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE RESTRICT;