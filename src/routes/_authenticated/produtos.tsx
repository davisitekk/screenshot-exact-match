import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Boxes, MoreVertical, Package, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { PageHeader, Panel, EmptyState, StatusBadge, SearchInput, NativeSelect } from "@/components/app/ui";
import { ProductDialog } from "@/components/catalog/product-form";
import { StockDialog } from "@/components/catalog/stock-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PRODUCT_IMAGES_BUCKET, buildCategoryTree, categoriesQuery, categoryPath, filterProducts, marginPercent,
  productsQuery, stockLevel, useSignedImages, type Product, type StockLevel,
} from "@/lib/catalog";
import { errorMessage, money, number, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  categoria: z.string().optional().catch(undefined),
  semCategoria: z.boolean().optional().catch(undefined),
  status: z.enum(["ativos", "inativos", "todos"]).optional().catch(undefined),
  estoque: z.enum(["baixo", "sem"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Importados Style" },
      { name: "description", content: "Catálogo de produtos com preços, custos, margem e estoque." },
      { property: "og:title", content: "Produtos — Importados Style" },
      { property: "og:description", content: "Catálogo de produtos com preços, custos, margem e estoque." },
    ],
  }),
  validateSearch: searchSchema,
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(categoriesQuery)]),
  component: ProductsPage,
  errorComponent: ProductsError,
  notFoundComponent: () => <EmptyState title="Produto não encontrado" />,
});

function ProductsError({ error }: { error: unknown }) {
  const router = useRouter();
  return (
    <Panel>
      <p className="text-sm text-destructive">Não foi possível carregar os produtos. {errorMessage(error)}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => router.invalidate()}>Tentar novamente</Button>
    </Panel>
  );
}

const STOCK_TONE: Record<StockLevel, { tone: "success" | "warning" | "danger"; label: (n: number) => string }> = {
  ok: { tone: "success", label: (n) => `${number(n)} un.` },
  baixo: { tone: "warning", label: (n) => `${number(n)} un. · baixo` },
  sem: { tone: "danger", label: (n) => (n < 0 ? `${number(n)} un.` : "Sem estoque") },
};

function ProductsPage() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { canSales, isAdmin } = useMe();
  const qc = useQueryClient();

  const [q, setQ] = useState(search.q ?? "");
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== q) navigate({ search: (s) => ({ ...s, q: q || undefined }), replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [q, search.q, navigate]);

  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [moving, setMoving] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const status = search.status ?? "ativos";
  const base = filterProducts(products, categories, { q: search.q, category: search.categoria, status, uncategorized: search.semCategoria });
  const list = search.estoque ? base.filter((p) => stockLevel(p) === search.estoque) : base;
  const lowCount = base.filter((p) => stockLevel(p) === "baixo").length;
  const outCount = base.filter((p) => stockLevel(p) === "sem").length;
  const { data: images } = useSignedImages(list.map((p) => p.image_url));
  const tree = buildCategoryTree(categories);
  const activeCount = products.filter((p) => p.active).length;

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: productsQuery.queryKey }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);

  async function toggle(p: Product) {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(errorMessage(error));
    toast.success(p.active ? "Produto inativado" : "Produto ativado");
    await refresh();
  }

  async function remove(p: Product) {
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      const m = errorMessage(error);
      return toast.error(m.includes("vinculado") ? "Este produto já tem vendas ou movimentações de estoque e não pode ser excluído. Inative-o." : m);
    }
    if (p.image_url) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([p.image_url]);
    toast.success("Produto excluído");
    await refresh();
  }

  const setFilter = (patch: Partial<z.infer<typeof searchSchema>>) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true });
  const hasFilters = !!(search.q || search.categoria || search.semCategoria || search.estoque || status !== "ativos");

  const actions = (p: Product) =>
    canSales && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Ações de ${p.name}`}><MoreVertical className="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(p)}><Pencil /> Editar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMoving(p)}><Boxes /> Movimentar estoque</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toggle(p)}><Power /> {p.active ? "Inativar" : "Ativar"}</DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleting(p)}><Trash2 /> Excluir</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  const thumb = (p: Product, size: string) => (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-sm border bg-muted", size)}>
      {p.image_url && images?.[p.image_url] ? <img src={images[p.image_url]} alt="" loading="lazy" className="size-full object-cover" /> : <Package className="size-4 text-muted-foreground" />}
    </span>
  );

  const stockBadge = (p: Product) => {
    const s = STOCK_TONE[stockLevel(p)];
    return <StatusBadge tone={s.tone}>{s.label(p.stock_qty)}</StatusBadge>;
  };

  return (
    <>
      <PageHeader
        title="Produtos"
        description={`${number(activeCount)} ativos · ${number(products.length - activeCount)} inativos`}
        actions={canSales && <Button onClick={() => setEditing(null)}><Plus /> Novo produto</Button>}
      />

      <Panel className="mb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Nome, código, SKU ou marca" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1">
            <NativeSelect
              aria-label="Categoria"
              className="sm:w-56"
              value={search.semCategoria ? "__none" : search.categoria ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setFilter({ categoria: v && v !== "__none" ? v : undefined, semCategoria: v === "__none" ? true : undefined });
              }}
            >
              <option value="">Todas as categorias</option>
              <option value="__none">Sem categoria</option>
              {tree.map((r) => (
                <optgroup key={r.id} label={r.name}>
                  <option value={r.id}>{r.name} (todas)</option>
                  {r.children.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </optgroup>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Situação" className="sm:w-36" value={status} onChange={(e) => setFilter({ status: e.target.value === "ativos" ? undefined : (e.target.value as "inativos" | "todos") })}>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </NativeSelect>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {([[undefined, `Todos (${base.length})`], ["baixo", `Estoque baixo (${lowCount})`], ["sem", `Sem estoque (${outCount})`]] as const).map(([k, label]) => (
            <Button key={label} size="sm" variant={search.estoque === k ? "default" : "outline"} className="h-7 rounded-full text-xs" onClick={() => setFilter({ estoque: k })}>
              {label}
            </Button>
          ))}
          {hasFilters && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { setQ(""); navigate({ search: {}, replace: true }); }}>
              Limpar filtros
            </Button>
          )}
        </div>
      </Panel>

      <Panel>
        {list.length === 0 ? (
          <EmptyState
            title={products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
            description={products.length === 0 ? "Cadastre o primeiro produto para começar a vender." : "Tente outra pesquisa ou limpe os filtros."}
            action={products.length === 0 && canSales ? <Button onClick={() => setEditing(null)}><Plus /> Novo produto</Button> : undefined}
          />
        ) : (
          <>
            <ul className="-my-2 divide-y md:hidden">
              {list.map((p) => (
                <li key={p.id} className="flex items-start gap-3 py-3">
                  {thumb(p, "size-14")}
                  <div className="min-w-0 flex-1">
                    <p className={cn("line-clamp-2 text-sm font-medium", !p.active && "text-muted-foreground")}>{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.code} · {categoryPath(categories, p.category_id)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{money(p.price)}</span>
                      {stockBadge(p)}
                      {!p.active && <StatusBadge tone="neutral">Inativo</StatusBadge>}
                    </div>
                  </div>
                  {actions(p)}
                </li>
              ))}
            </ul>

            <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-5 pb-2 font-medium">Produto</th>
                    <th className="px-3 pb-2 font-medium">Categoria</th>
                    <th className="px-3 pb-2 text-right font-medium">Custo</th>
                    <th className="px-3 pb-2 text-right font-medium">Preço</th>
                    <th className="px-3 pb-2 text-right font-medium">Margem</th>
                    <th className="px-3 pb-2 font-medium">Estoque</th>
                    <th className="w-12 px-3 pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((p) => {
                    const m = marginPercent(Number(p.price), Number(p.cost));
                    return (
                      <tr key={p.id} className={cn("align-middle", !p.active && "opacity-60")}>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-3">
                            {thumb(p, "size-11")}
                            <div className="min-w-0">
                              <p className="max-w-xs truncate font-medium" title={p.name}>{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.code}{p.sku ? ` · SKU ${p.sku}` : ""}{p.brand ? ` · ${p.brand}` : ""}{!p.active ? " · Inativo" : ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{categoryPath(categories, p.category_id)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{Number(p.cost) > 0 ? money(p.cost) : "—"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(p.price)}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular-nums", m !== null && m < 0 ? "text-destructive" : "text-muted-foreground")}>{m === null ? "—" : percent(m)}</td>
                        <td className="px-3 py-2.5">{stockBadge(p)}</td>
                        <td className="px-3 py-2.5 text-right">{actions(p)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {editing !== undefined && <ProductDialog product={editing} categories={categories} onClose={() => setEditing(undefined)} />}
      {moving && <StockDialog product={moving} onClose={() => setMoving(null)} />}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir produtos que nunca foram vendidos nem tiveram estoque movimentado. Nos outros casos, inative o produto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) void remove(deleting); setDeleting(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
