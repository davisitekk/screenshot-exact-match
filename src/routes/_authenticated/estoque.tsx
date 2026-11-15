import { useState } from "react";
import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Boxes, ChevronLeft, ChevronRight } from "lucide-react";
import { useMe } from "@/hooks/use-auth";
import { PageHeader, Panel, EmptyState, StatusBadge, NativeSelect } from "@/components/app/ui";
import { StockDialog } from "@/components/catalog/stock-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STOCK_TYPES, type StockMovementType } from "@/lib/constants";
import { productsQuery, stockLevel } from "@/lib/catalog";
import { MOVEMENTS_PAGE_SIZE, MOVEMENT_TONE, movementsQuery, staffNamesQuery } from "@/lib/stock";
import { dateTime, errorMessage, number } from "@/lib/format";
import { cn } from "@/lib/utils";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TYPES = Object.keys(STOCK_TYPES) as [StockMovementType, ...StockMovementType[]];
const searchSchema = z.object({
  produto: z.string().uuid().optional().catch(undefined),
  tipo: z.enum(TYPES).optional().catch(undefined),
  de: isoDay.optional().catch(undefined),
  ate: isoDay.optional().catch(undefined),
  pagina: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Importados Style" },
      { name: "description", content: "Histórico de entradas, saídas, vendas, perdas e ajustes de estoque." },
      { property: "og:title", content: "Estoque — Importados Style" },
      { property: "og:description", content: "Histórico de entradas, saídas, vendas, perdas e ajustes de estoque." },
    ],
  }),
  validateSearch: searchSchema,
  loaderDeps: ({ search: { produto, tipo, de, ate, pagina } }) => ({ produto, tipo, de, ate, pagina }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(movementsQuery(deps)),
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(staffNamesQuery),
    ]),
  component: StockPage,
  errorComponent: StockError,
  notFoundComponent: () => <EmptyState title="Movimentação não encontrada" />,
});

function StockError({ error }: { error: unknown }) {
  const router = useRouter();
  return (
    <Panel>
      <p className="text-sm text-destructive">Não foi possível carregar o histórico de estoque. {errorMessage(error)}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => router.invalidate()}>Tentar novamente</Button>
    </Panel>
  );
}

function StockPage() {
  const deps = Route.useLoaderDeps();
  const { data: page } = useSuspenseQuery(movementsQuery(deps));
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: names } = useSuspenseQuery(staffNamesQuery);
  const navigate = useNavigate({ from: Route.fullPath });
  const { canSales } = useMe();
  const [moving, setMoving] = useState(false);

  const setFilter = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (s) => ({ ...s, pagina: undefined, ...patch }), replace: true });
  const hasFilters = !!(deps.produto || deps.tipo || deps.de || deps.ate);
  const product = deps.produto ? products.find((p) => p.id === deps.produto) : undefined;
  const pages = Math.max(1, Math.ceil(page.total / MOVEMENTS_PAGE_SIZE));
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const qty = (n: number) => (
    <span className={cn("font-semibold tabular-nums", n > 0 ? "text-success" : "text-destructive")}>{n > 0 ? "+" : "−"}{number(Math.abs(n))}</span>
  );
  const origin = (r: (typeof page.rows)[number]) =>
    r.orders?.number ? `Pedido #${r.orders.number}` : r.reason || "—";

  return (
    <>
      <PageHeader title="Estoque" description="Histórico de todas as movimentações, da mais recente para a mais antiga." />

      <Panel className="mb-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto_auto]">
          <NativeSelect aria-label="Produto" value={deps.produto ?? ""} onChange={(e) => setFilter({ produto: e.target.value || undefined })}>
            <option value="">Todos os produtos</option>
            {sorted.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code}){p.active ? "" : " — inativo"}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Tipo de movimentação" value={deps.tipo ?? ""} onChange={(e) => setFilter({ tipo: (e.target.value || undefined) as StockMovementType | undefined })}>
            <option value="">Todos os tipos</option>
            {TYPES.map((t) => <option key={t} value={t}>{STOCK_TYPES[t].label}</option>)}
          </NativeSelect>
          <div className="flex items-center gap-1.5">
            <Input type="date" className="w-full lg:w-[9.5rem]" aria-label="Data inicial" value={deps.de ?? ""} max={deps.ate}
              onChange={(e) => setFilter({ de: e.target.value || undefined })} />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" className="w-full lg:w-[9.5rem]" aria-label="Data final" value={deps.ate ?? ""} min={deps.de}
              onChange={(e) => setFilter({ ate: e.target.value || undefined })} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate({ search: {}, replace: true })}>Limpar filtros</Button>
          )}
        </div>
      </Panel>

      {product && (
        <Panel className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                {product.code} · estoque atual <strong className="text-foreground tabular-nums">{number(product.stock_qty)} un.</strong> · mínimo {number(product.min_stock)}
                {stockLevel(product) !== "ok" && <span className="text-destructive"> · {stockLevel(product) === "sem" ? "sem estoque" : "estoque baixo"}</span>}
              </p>
            </div>
            {canSales && <Button size="sm" onClick={() => setMoving(true)}><Boxes /> Movimentar estoque</Button>}
          </div>
        </Panel>
      )}

      <Panel>
        {page.rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nenhuma movimentação encontrada" : "Nenhuma movimentação registrada"}
            description={hasFilters ? "Tente outro período ou limpe os filtros." : "As entradas, saídas e vendas aparecem aqui assim que forem registradas."}
            action={!hasFilters ? <Button asChild variant="outline"><Link to="/produtos">Ir para Produtos</Link></Button> : undefined}
          />
        ) : (
          <>
            <ul className="-my-2 divide-y md:hidden">
              {page.rows.map((r) => (
                <li key={r.id} className="space-y-1 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium">{r.products?.name ?? "—"}</p>
                    <span className="shrink-0 text-sm">{qty(r.quantity)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge tone={MOVEMENT_TONE[r.type]}>{STOCK_TYPES[r.type].label}</StatusBadge>
                    <span>saldo {number(r.balance_after)} un.</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{dateTime(r.created_at)} · {r.user_id ? names[r.user_id] ?? "Usuário removido" : "Sistema"} · {origin(r)}</p>
                </li>
              ))}
            </ul>

            <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-5 pb-2 font-medium">Data e hora</th>
                    <th className="px-3 pb-2 font-medium">Produto</th>
                    <th className="px-3 pb-2 font-medium">Tipo</th>
                    <th className="px-3 pb-2 text-right font-medium">Quantidade</th>
                    <th className="px-3 pb-2 text-right font-medium">Saldo após</th>
                    <th className="px-3 pb-2 font-medium">Motivo / origem</th>
                    <th className="px-3 pb-2 font-medium">Registrado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {page.rows.map((r) => (
                    <tr key={r.id} className="align-middle">
                      <td className="whitespace-nowrap px-5 py-2.5 text-xs text-muted-foreground">{dateTime(r.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <p className="max-w-xs truncate font-medium" title={r.products?.name}>{r.products?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.products?.code}</p>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge tone={MOVEMENT_TONE[r.type]}>{STOCK_TYPES[r.type].label}</StatusBadge></td>
                      <td className="px-3 py-2.5 text-right">{qty(r.quantity)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{number(r.balance_after)}</td>
                      <td className="max-w-[16rem] truncate px-3 py-2.5 text-xs text-muted-foreground" title={origin(r)}>{origin(r)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.user_id ? names[r.user_id] ?? "Usuário removido" : "Sistema"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
              <span>{number(page.total)} movimentaç{page.total === 1 ? "ão" : "ões"} · página {page.page} de {pages}</span>
              {pages > 1 && (
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page.page <= 1} onClick={() => navigate({ search: (s) => ({ ...s, pagina: page.page - 1 > 1 ? page.page - 1 : undefined }) })}>
                    <ChevronLeft /> Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={page.page >= pages} onClick={() => navigate({ search: (s) => ({ ...s, pagina: page.page + 1 }) })}>
                    Próxima <ChevronRight />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Panel>

      {moving && product && <StockDialog product={product} onClose={() => setMoving(false)} />}
    </>
  );
}
