import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BadgeTone, StockMovementType } from "@/lib/constants";
import { addDaysISO, zonedDayStart } from "@/lib/format";

export const MOVEMENTS_PAGE_SIZE = 50;

export interface MovementFilters {
  produto?: string | undefined;
  tipo?: StockMovementType | undefined;
  de?: string | undefined;
  ate?: string | undefined;
  pagina?: number | undefined;
}

/** One page of stock history, newest first, filtered on the server; days are Brasília days. */
export function movementsQuery(f: MovementFilters) {
  return queryOptions({
    queryKey: ["stock_movements", f],
    queryFn: async () => {
      const page = Math.max(1, f.pagina ?? 1);
      let q = supabase
        .from("stock_movements")
        .select("id, created_at, type, quantity, balance_after, reason, user_id, product_id, order_id, products(name, code), orders(number)", { count: "exact" });
      if (f.produto) q = q.eq("product_id", f.produto);
      if (f.tipo) q = q.eq("type", f.tipo);
      if (f.de) q = q.gte("created_at", zonedDayStart(f.de));
      if (f.ate) q = q.lt("created_at", zonedDayStart(addDaysISO(f.ate, 1)));
      const from = (page - 1) * MOVEMENTS_PAGE_SIZE;
      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + MOVEMENTS_PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0, page };
    },
  });
}

/** Names of staff members, to show who recorded each movement. */
export const staffNamesQuery = queryOptions({
  queryKey: ["profiles", "names"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name, email");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name || p.email]));
  },
  staleTime: 5 * 60_000,
});

export const MOVEMENT_TONE: Record<StockMovementType, BadgeTone> = {
  entrada: "success",
  devolucao: "success",
  cancelamento: "success",
  venda: "info",
  saida: "warning",
  perda: "danger",
  ajuste: "neutral",
};
