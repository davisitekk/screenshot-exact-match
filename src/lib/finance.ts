export interface DashboardData {
  today_sales: number;
  month_sales: number;
  gross: number;
  discounts: number;
  returns: number;
  payment_fees: number;
  marketplace_fees: number;
  shipping_costs: number;
  cogs: number;
  valid_total: number;
  valid_count: number;
  orders_total: number;
  orders_by_status: Record<string, number>;
  items_sold: number;
  daily: { d: string; total: number; profit: number; orders: number }[];
  top_products: { name: string; qty: number; revenue: number; profit: number }[];
  by_category: { name: string; total: number }[];
  by_payment: { name: string; total: number; orders: number }[];
  top_margin: { name: string; margin: number; price: number; cost: number }[];
  low_stock: number;
  out_of_stock: number;
  opex?: number;
  payables_open?: number;
  payables_overdue?: number;
  receivables_open?: number;
  receivables_overdue?: number;
  cash_balance?: number;
}

export interface ProfitBreakdown {
  gross: number;
  discounts: number;
  returns: number;
  fees: number;
  netRevenue: number;
  cogs: number;
  shippingCosts: number;
  grossProfit: number;
  opex: number;
  netProfit: number;
  ticket: number;
  grossMargin: number;
  netMargin: number;
}

const n = (v: unknown) => Number(v ?? 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Faturamento bruto → líquido → lucro bruto → lucro líquido.
 * Never treats the sale total as profit: costs, fees, shipping and expenses are deducted.
 */
export function computeProfit(d: Pick<DashboardData, "gross" | "discounts" | "returns" | "payment_fees" | "marketplace_fees" | "cogs" | "shipping_costs" | "valid_total" | "valid_count"> & { opex?: number }): ProfitBreakdown {
  const gross = n(d.gross);
  const discounts = n(d.discounts);
  const returns = n(d.returns);
  const fees = n(d.payment_fees) + n(d.marketplace_fees);
  const netRevenue = r2(gross - discounts - returns - fees);
  const cogs = n(d.cogs);
  const shippingCosts = n(d.shipping_costs);
  const grossProfit = r2(netRevenue - cogs - shippingCosts);
  const opex = n(d.opex);
  const netProfit = r2(grossProfit - opex);
  const ticket = n(d.valid_count) > 0 ? r2(n(d.valid_total) / n(d.valid_count)) : 0;
  return {
    gross, discounts, returns, fees: r2(fees), netRevenue, cogs, shippingCosts, grossProfit, opex, netProfit, ticket,
    grossMargin: netRevenue > 0 ? r2((grossProfit / netRevenue) * 100) : 0,
    netMargin: netRevenue > 0 ? r2((netProfit / netRevenue) * 100) : 0,
  };
}

export function productMargin(cost: number, price: number) {
  if (!price || price <= 0) return 0;
  return r2(((price - cost) / price) * 100);
}

/** Groups a daily series into day / week / month / year buckets. */
export function groupSeries<T extends { d: string }>(rows: T[], by: "dia" | "semana" | "mes" | "ano", keys: (keyof T)[]) {
  const out = new Map<string, Record<string, number | string>>();
  for (const row of rows) {
    let k = row.d;
    if (by === "mes") k = row.d.slice(0, 7);
    else if (by === "ano") k = row.d.slice(0, 4);
    else if (by === "semana") {
      const dt = new Date(row.d + "T00:00:00Z");
      const day = (dt.getUTCDay() + 6) % 7; // Monday = 0
      dt.setUTCDate(dt.getUTCDate() - day);
      k = dt.toISOString().slice(0, 10);
    }
    const cur = out.get(k) ?? { d: k };
    for (const key of keys) cur[key as string] = r2(n(cur[key as string]) + n(row[key]));
    out.set(k, cur);
  }
  return [...out.values()].sort((a, b) => String(a.d).localeCompare(String(b.d)));
}

export function bucketLabel(k: string, by: "dia" | "semana" | "mes" | "ano") {
  if (by === "ano") return k;
  if (by === "mes") return `${k.slice(5, 7)}/${k.slice(0, 4)}`;
  return `${k.slice(8, 10)}/${k.slice(5, 7)}`;
}
