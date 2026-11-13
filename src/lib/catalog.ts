import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Category = Database["public"]["Tables"]["product_categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];

export interface CategoryNode extends Category {
  children: Category[];
}

/** Groups flat categories into main categories with their subcategories, both sorted by name. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "pt-BR");
  const roots = categories.filter((c) => !c.parent_id).sort(byName);
  return roots.map((r) => ({ ...r, children: categories.filter((c) => c.parent_id === r.id).sort(byName) }));
}

/** "Tênis › Nike" for a subcategory, "Jaquetas" for a main category. */
export function categoryPath(categories: Category[], id: string | null | undefined): string {
  if (!id) return "Sem categoria";
  const c = categories.find((x) => x.id === id);
  if (!c) return "Sem categoria";
  const parent = c.parent_id ? categories.find((x) => x.id === c.parent_id) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

/** Category ids matched by a filter: a main category also matches all its subcategories. */
export function categoryFilterIds(categories: Category[], id: string): Set<string> {
  const ids = new Set([id]);
  for (const c of categories) if (c.parent_id === id) ids.add(c.id);
  return ids;
}

/** Gross margin over the sale price, or null when there is no price or no cost recorded. */
export function marginPercent(price: number, cost: number): number | null {
  if (!(price > 0) || !(cost > 0)) return null;
  return ((price - cost) / price) * 100;
}

export const categoriesQuery = queryOptions({
  queryKey: ["product_categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("product_categories").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const suppliersListQuery = queryOptions({
  queryKey: ["suppliers", "list"],
  queryFn: async () => {
    const { data, error } = await supabase.from("suppliers").select("id, name, active").order("name");
    if (error) throw error;
    return data;
  },
});

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Signed URLs (1h) for private product photos, keyed by storage path. */
export function useSignedImages(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))].sort();
  return useQuery({
    queryKey: ["signed-images", list],
    enabled: list.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const map: Record<string, string> = {};
      for (let i = 0; i < list.length; i += 100) {
        const chunk = list.slice(i, i + 100);
        const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrls(chunk, 3600);
        if (error) throw error;
        for (const d of data ?? []) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      }
      return map;
    },
  });
}
