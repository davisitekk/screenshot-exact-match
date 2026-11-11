import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  TrendingUp, CalendarDays, Receipt, ShoppingCart, PackageX, PackageMinus, Wallet, ArrowDownCircle, ArrowUpCircle, AlertTriangle, BadgePercent,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { PageHeader, Panel, StatCard, EmptyState, Loading, StatusBadge } from "@/components/app/ui";
import { PeriodPicker, GroupToggle, presetPeriod, type Period } from "@/components/app/period-picker";
import { computeProfit, groupSeries, bucketLabel, type DashboardData } from "@/lib/finance";
import { money, number, percent, date } from "@/lib/format";
import { ORDER_STATUS, ORDER_STATUS_LIST } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Gestão da Loja" },
      { name: "description", content: "Indicadores de vendas, lucro, pedidos, estoque e financeiro da loja." },
      { property: "og:title", content: "Painel — Gestão da Loja" },
      { property: "og:description", content: "Indicadores de vendas, lucro, pedidos, estoque e financeiro da loja." },
    ],
  }),
  component: Dashboard,
});

const CHART = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

function Dashboard() {
  const { canFinance } = useMe();
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));
  const [group, setGroup] = useState<"dia" | "semana" | "mes" | "ano">("dia");

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", period.start, period.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard", { p_start: period.start, p_end: period.end });
      if (error) throw error;
      return data as unknown as DashboardData;
    },
  });
  const { data: alerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_alerts");
      if (error) throw error;
      return data as Record<string, Array<Record<string, string | number>>>;
    },
  });

  const p = data ? computeProfit(data) : null;
  const series = data ? groupSeries(data.daily, group, ["total", "profit", "orders"]).map((r) => ({ ...r, label: bucketLabel(String(r.d), group) })) : [];

  return (
    <>
      <PageHeader title="Painel" description="Visão geral da loja no período selecionado." actions={<PeriodPicker value={period} onChange={setPeriod} />} />
      {isLoading || !data || !p ? (
        error ? <Panel><p className="text-sm text-destructive">Não foi possível carregar os indicadores.</p></Panel> : <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard tone="brand" label="Vendas hoje" value={money(data.today_sales)} icon={<CalendarDays />} hint={`Mês atual: ${money(data.month_sales)}`} />
            <StatCard label="Faturamento bruto" value={money(p.gross)} icon={<Receipt />} hint={`Líquido: ${money(p.netRevenue)}`} />
            <StatCard tone="success" label="Lucro bruto estimado" value={money(p.grossProfit)} icon={<TrendingUp />} hint={`Margem ${percent(p.grossMargin)}`} />
            <StatCard tone={canFinance && p.netProfit < 0 ? "danger" : "success"} label="Lucro líquido estimado" value={canFinance ? money(p.netProfit) : "—"} icon={<BadgePercent />} hint={canFinance ? `Margem ${percent(p.netMargin)}` : "Visível ao financeiro"} />
            <StatCard label="Pedidos no período" value={number(data.orders_total)} icon={<ShoppingCart />} hint={`Ticket médio ${money(p.ticket)}`} />
            <StatCard label="Produtos vendidos" value={number(data.items_sold)} icon={<ShoppingCart />} hint="unidades" />
            <StatCard tone={data.low_stock ? "warning" : "default"} label="Estoque baixo" value={number(data.low_stock)} icon={<PackageMinus />} hint="produtos ativos" />
            <StatCard tone={data.out_of_stock ? "danger" : "default"} label="Sem estoque" value={number(data.out_of_stock)} icon={<PackageX />} hint="produtos ativos" />
            {canFinance && (
              <>
                <StatCard label="Contas a receber" value={money(data.receivables_open)} icon={<ArrowDownCircle />} hint={`${data.receivables_overdue ?? 0} em atraso`} tone={data.receivables_overdue ? "warning" : "default"} />
                <StatCard label="Contas a pagar" value={money(data.payables_open)} icon={<ArrowUpCircle />} hint={`${data.payables_overdue ?? 0} vencidas`} tone={data.payables_overdue ? "danger" : "default"} />
                <StatCard tone="brand" label="Saldo em caixa" value={money(data.cash_balance)} icon={<Wallet />} hint="todas as contas ativas" />
                <StatCard label="Despesas operacionais" value={money(p.opex)} icon={<ArrowUpCircle />} hint="lançadas no período" />
              </>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2" title="Vendas e lucro" description="Pedidos confirmados, sem cancelados e devolvidos" actions={<GroupToggle value={group} onChange={setGroup} />}>
              {series.length === 0 ? <EmptyState title="Sem vendas no período" /> : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={70} tickFormatter={(v) => money(v).replace(",00", "")} />
                      <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" name="Vendas" dataKey="total" stroke="var(--chart-1)" fill="url(#gTotal)" strokeWidth={2} />
                      <Area type="monotone" name="Lucro bruto" dataKey="profit" stroke="var(--chart-2)" fill="url(#gProfit)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Do faturamento ao lucro" description="Nunca considera o valor da venda como lucro">
              <dl className="space-y-2 text-sm">
                {[
                  ["Faturamento bruto", p.gross, ""],
                  ["(−) Descontos", -p.discounts, ""],
                  ["(−) Devoluções", -p.returns, ""],
                  ["(−) Taxas de pagamento e marketplace", -p.fees, ""],
                  ["= Faturamento líquido", p.netRevenue, "font-semibold"],
                  ["(−) Custo dos produtos vendidos", -p.cogs, ""],
                  ["(−) Frete pago pela loja", -p.shippingCosts, ""],
                  ["= Lucro bruto", p.grossProfit, "font-semibold text-accent-foreground"],
                  ...(canFinance ? [["(−) Despesas operacionais", -p.opex, ""], ["= Lucro líquido estimado", p.netProfit, "font-semibold text-accent-foreground"]] : []),
                ].map(([l, v, cls]) => (
                  <div key={l as string} className={`flex justify-between gap-2 ${cls}`}>
                    <dt className="text-muted-foreground">{l}</dt>
                    <dd className="tabular-nums">{money(v as number)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Pedidos por status">
              <ul className="space-y-2">
                {ORDER_STATUS_LIST.map((s) => (
                  <li key={s} className="flex items-center justify-between text-sm">
                    <StatusBadge tone={ORDER_STATUS[s].tone}>{ORDER_STATUS[s].label}</StatusBadge>
                    <span className="font-semibold tabular-nums">{number(data.orders_by_status[s] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Vendas por categoria">
              {data.by_category.length === 0 ? <EmptyState title="Sem dados" /> : (
                <div className="h-60">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.by_category} dataKey="total" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {data.by_category.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => money(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel title="Vendas por forma de pagamento">
              {data.by_payment.length === 0 ? <EmptyState title="Sem dados" /> : (
                <div className="h-60">
                  <ResponsiveContainer>
                    <BarChart data={data.by_payment} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => money(v)} />
                      <Bar dataKey="total" name="Total" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Produtos mais vendidos">
              {data.top_products.length === 0 ? <EmptyState title="Sem vendas no período" /> : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={data.top_products} margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={0} tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} width={36} />
                      <Tooltip />
                      <Bar dataKey="qty" name="Unidades" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel title="Produtos com melhor margem">
              {data.top_margin.length === 0 ? <EmptyState title="Nenhum produto cadastrado" /> : (
                <ul className="divide-y">
                  {data.top_margin.map((m) => (
                    <li key={m.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="truncate">{m.name}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-muted-foreground">{money(m.cost)} → {money(m.price)}</span>
                        <StatusBadge tone="success">{percent(m.margin)}</StatusBadge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {alerts && <AlertsPanel alerts={alerts} />}
        </div>
      )}
    </>
  );
}

function AlertsPanel({ alerts }: { alerts: Record<string, Array<Record<string, string | number>>> }) {
  const sections: { key: string; title: string; render: (r: Record<string, string | number>) => React.ReactNode; to: string }[] = [
    { key: "out_of_stock", title: "Produtos sem estoque", render: (r) => r.name, to: "/produtos" },
    { key: "low_stock", title: "Estoque baixo", render: (r) => `${r.name} — ${r.stock_qty} un. (mín. ${r.min_stock})`, to: "/produtos" },
    { key: "awaiting_payment", title: "Pedidos aguardando pagamento", render: (r) => `#${r.number} — ${money(r.total)} — ${date(String(r.created_at))}`, to: "/pedidos" },
    { key: "stale_orders", title: "Pedidos sem atualização", render: (r) => `#${r.number} — ${ORDER_STATUS[r.status as keyof typeof ORDER_STATUS]?.label} desde ${date(String(r.updated_at))}`, to: "/pedidos" },
    { key: "payables_overdue", title: "Contas vencidas", render: (r) => `${r.description} — ${money(r.amount)} — venceu ${date(String(r.due_date))}`, to: "/financeiro/pagar" },
    { key: "payables_due_soon", title: "Contas próximas do vencimento", render: (r) => `${r.description} — ${money(r.amount)} — ${date(String(r.due_date))}`, to: "/financeiro/pagar" },
    { key: "receivables_overdue", title: "Recebimentos atrasados", render: (r) => `${r.description} — ${money(r.amount)} — ${date(String(r.due_date))}`, to: "/financeiro/receber" },
    { key: "recent_purchases", title: "Compras recentes (24h)", render: (r) => `#${r.number} — ${r.customer ?? "Cliente"} — ${money(r.total)}`, to: "/pedidos" },
    { key: "slow_products", title: "Produtos com baixo desempenho (60 dias sem venda)", render: (r) => `${r.name} — ${r.stock_qty} un. em estoque`, to: "/produtos" },
  ];
  const visible = sections.filter((s) => (alerts[s.key]?.length ?? 0) > 0);
  return (
    <Panel title="Alertas" description="Atualizados automaticamente a cada acesso">
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum alerta no momento. Tudo em dia.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <div key={s.key} className="rounded-lg border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="size-4 text-warning" />{s.title}</p>
                <Link to={s.to} className="text-xs text-primary hover:underline">Ver</Link>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {alerts[s.key].slice(0, 5).map((r, i) => <li key={i} className="truncate">{s.render(r)}</li>)}
                {alerts[s.key].length > 5 && <li>+ {alerts[s.key].length - 5} outros</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
