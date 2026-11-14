ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_product_id_fkey;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;