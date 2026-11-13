import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { PageHeader, Panel, EmptyState, StatusBadge, Field, NativeSelect } from "@/components/app/ui";
import { Confirm } from "@/components/app/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildCategoryTree, categoriesQuery, categoryDeleteBlocker, productsQuery, type Category } from "@/lib/catalog";
import { errorMessage, number } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Importados Style" },
      { name: "description", content: "Organize o catálogo em categorias e subcategorias." },
      { property: "og:title", content: "Categorias — Importados Style" },
      { property: "og:description", content: "Organize o catálogo em categorias e subcategorias." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(categoriesQuery), context.queryClient.ensureQueryData(productsQuery)]),
  component: CategoriesPage,
  errorComponent: CategoriesError,
  notFoundComponent: () => <EmptyState title="Categoria não encontrada" />,
});

function CategoriesError({ error }: { error: unknown }) {
  const router = useRouter();
  return (
    <Panel>
      <p className="text-sm text-destructive">Não foi possível carregar as categorias. {errorMessage(error)}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => router.invalidate()}>Tentar novamente</Button>
    </Panel>
  );
}

type Editing = { category?: Category; parentId?: string | null } | null;

function CategoriesPage() {
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  const { canSales } = useMe();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const tree = buildCategoryTree(categories);
  const countOf = (id: string) => products.filter((p) => p.category_id === id).length;
  const totalOf = (id: string) => products.filter((p) => p.category_id === id || categories.some((c) => c.id === p.category_id && c.parent_id === id)).length;
  const uncategorized = products.filter((p) => !p.category_id).length;

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: categoriesQuery.queryKey }), qc.invalidateQueries({ queryKey: productsQuery.queryKey })]);

  async function toggle(c: Category) {
    const { error } = await supabase.from("product_categories").update({ active: !c.active }).eq("id", c.id);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(c.active ? "Categoria inativada" : "Categoria ativada");
    await refresh();
  }

  async function remove(c: Category) {
    const blocker = categoryDeleteBlocker(categories, products, c.id);
    if (blocker) { toast.error(blocker); return; }
    const { error } = await supabase.from("product_categories").delete().eq("id", c.id);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Categoria excluída");
    await refresh();
  }

  const row = (c: Category, isChild: boolean) => {
    const own = countOf(c.id);
    const total = isChild ? own : totalOf(c.id);
    const blocker = categoryDeleteBlocker(categories, products, c.id);
    return (
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3", isChild && "pl-6 sm:pl-8")}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isChild ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" /> : <FolderTree className="size-4 shrink-0 text-primary" />}
          <div className="min-w-0">
            <p className={cn("truncate text-sm", isChild ? "text-foreground" : "font-semibold")}>{c.name}</p>
            {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
          </div>
        </div>
        <Link to="/produtos" search={{ categoria: c.id, status: "todos" }} className="text-xs tabular-nums text-muted-foreground hover:text-primary">
          {number(total)} produto{total === 1 ? "" : "s"}
        </Link>
        {!c.active && <StatusBadge tone="neutral">Inativa</StatusBadge>}
        {canSales && (
          <div className="flex items-center gap-1">
            {!isChild && (
              <Button variant="ghost" size="sm" onClick={() => setEditing({ parentId: c.id })} aria-label={`Nova subcategoria em ${c.name}`}>
                <Plus className="size-3.5" /> <span className="hidden sm:inline">Subcategoria</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing({ category: c })} aria-label={`Editar ${c.name}`}>
              <Pencil className="size-3.5" />
            </Button>
            <Switch checked={c.active} onCheckedChange={() => toggle(c)} aria-label={c.active ? `Inativar ${c.name}` : `Ativar ${c.name}`} />
            <Confirm
              trigger={
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Excluir ${c.name}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              }
              title={`Excluir "${c.name}"?`}
              description={blocker ?? "A categoria será apagada. Esta ação não pode ser desfeita."}
              confirmLabel={blocker ? "Entendi" : "Excluir"}
              onConfirm={() => (blocker ? undefined : remove(c))}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Categorias"
        description={`${categories.length} categorias · ${tree.length} principais`}
        actions={canSales && <Button onClick={() => setEditing({ parentId: null })}><Plus /> Nova categoria</Button>}
      />
      <Panel>
        {tree.length === 0 ? (
          <EmptyState title="Nenhuma categoria cadastrada" description="Crie categorias como Tênis ou Jaquetas e, dentro delas, subcategorias como Nike." />
        ) : (
          <div className="-my-3 divide-y">
            {tree.map((root) => (
              <div key={root.id}>
                {row(root, false)}
                {root.children.length > 0 && <div className="divide-y border-t border-dashed">{root.children.map((ch) => <div key={ch.id}>{row(ch, true)}</div>)}</div>}
              </div>
            ))}
          </div>
        )}
        {uncategorized > 0 && (
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            <Link to="/produtos" search={{ semCategoria: true, status: "todos" }} className="text-primary hover:underline">{number(uncategorized)} produto{uncategorized === 1 ? "" : "s"} sem categoria</Link>
          </p>
        )}
      </Panel>
      {editing && <CategoryDialog editing={editing} categories={categories} onClose={() => setEditing(null)} onSaved={refresh} />}
    </>
  );
}

function CategoryDialog({ editing, categories, onClose, onSaved }: {
  editing: NonNullable<Editing>; categories: Category[]; onClose: () => void; onSaved: () => Promise<unknown>;
}) {
  const c = editing.category;
  const [name, setName] = useState(c?.name ?? "");
  const [parentId, setParentId] = useState<string>(c ? c.parent_id ?? "" : editing.parentId ?? "");
  const [description, setDescription] = useState(c?.description ?? "");
  const [active, setActive] = useState(c?.active ?? true);
  const [busy, setBusy] = useState(false);
  const hasChildren = !!c && categories.some((x) => x.parent_id === c.id);
  const parents = categories.filter((x) => !x.parent_id && x.id !== c?.id).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) { toast.error("Informe o nome da categoria."); return; }
    const pid = parentId || null;
    const dup = categories.some((x) => x.id !== c?.id && (x.parent_id ?? null) === pid && x.name.trim().toLocaleLowerCase("pt-BR") === n.toLocaleLowerCase("pt-BR"));
    if (dup) { toast.error(pid ? "Já existe uma subcategoria com este nome nesta categoria." : "Já existe uma categoria principal com este nome."); return; }
    setBusy(true);
    const payload = { name: n, parent_id: pid, description: description.trim() || null, active };
    const { error } = c
      ? await supabase.from("product_categories").update(payload).eq("id", c.id)
      : await supabase.from("product_categories").insert(payload);
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(c ? "Categoria atualizada" : "Categoria criada");
    await onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{c ? "Editar categoria" : parentId ? "Nova subcategoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>Subcategorias ficam dentro de uma categoria principal, como Tênis › Nike.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} />
          </Field>
          <Field label="Dentro de" hint={hasChildren ? "Esta categoria tem subcategorias, então precisa continuar como principal." : undefined}>
            <NativeSelect value={parentId} onChange={(e) => setParentId(e.target.value)} disabled={hasChildren}>
              <option value="">Nenhuma (categoria principal)</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (inativa)"}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Descrição">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <span>
              Ativa
              <span className="block text-xs text-muted-foreground">Categorias inativas não aparecem ao cadastrar produtos.</span>
            </span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
