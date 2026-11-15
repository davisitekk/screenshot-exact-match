import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { MessageCircle, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { PageHeader, Panel, EmptyState, SearchInput } from "@/components/app/ui";
import { CustomerDialog } from "@/components/customers/customer-form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { customersQuery, filterCustomers, type CustomerWithStats } from "@/lib/customers";
import { date, errorMessage, formatDocument, formatPhone, money, number, whatsappLink } from "@/lib/format";

const searchSchema = z.object({ q: z.string().optional().catch(undefined) });

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Importados Style" },
      { name: "description", content: "Cadastro de clientes com contato, endereço de entrega e histórico de compras." },
      { property: "og:title", content: "Clientes — Importados Style" },
      { property: "og:description", content: "Cadastro de clientes com contato, endereço de entrega e histórico de compras." },
    ],
  }),
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(customersQuery),
  component: CustomersPage,
  errorComponent: CustomersError,
  notFoundComponent: () => <EmptyState title="Cliente não encontrado" />,
});

function CustomersError({ error }: { error: unknown }) {
  const router = useRouter();
  return (
    <Panel>
      <p className="text-sm text-destructive">Não foi possível carregar os clientes. {errorMessage(error)}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => router.invalidate()}>Tentar novamente</Button>
    </Panel>
  );
}

function CustomersPage() {
  const { data: customers } = useSuspenseQuery(customersQuery);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { canSales, isAdmin } = useMe();
  const qc = useQueryClient();

  const [q, setQ] = useState(search.q ?? "");
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== q) navigate({ search: { q: q || undefined }, replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [q, search.q, navigate]);

  const [editing, setEditing] = useState<CustomerWithStats | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CustomerWithStats | null>(null);
  const list = filterCustomers(customers, search.q);
  const withOrders = customers.filter((c) => c.stats.orderCount > 0).length;

  async function remove(c: CustomerWithStats) {
    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) {
      const m = errorMessage(error);
      toast.error(m.includes("vinculado") ? "Este cliente tem pedidos ou contas a receber e não pode ser excluído." : m);
      return;
    }
    toast.success("Cliente excluído");
    await qc.invalidateQueries({ queryKey: customersQuery.queryKey });
  }

  const contact = (c: CustomerWithStats) => {
    const wa = whatsappLink(c.whatsapp);
    return (
      <div className="min-w-0 text-xs text-muted-foreground">
        {c.whatsapp && (
          wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground hover:text-primary">
              <MessageCircle className="size-3.5 text-success" /> {formatPhone(c.whatsapp)}
            </a>
          ) : <p>{formatPhone(c.whatsapp)}</p>
        )}
        {c.phone && c.phone !== c.whatsapp && <p>{formatPhone(c.phone)}</p>}
        {c.email && <p className="truncate">{c.email}</p>}
        {!c.whatsapp && !c.phone && !c.email && <p>—</p>}
      </div>
    );
  };

  const actions = (c: CustomerWithStats) =>
    canSales && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Ações de ${c.name}`}><MoreVertical className="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(c)}><Pencil /> Editar</DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleting(c)}><Trash2 /> Excluir</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  const place = (c: CustomerWithStats) => [c.city, c.state].filter(Boolean).join(" / ") || "—";

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${number(customers.length)} cadastrados · ${number(withOrders)} com pedidos`}
        actions={canSales && <Button onClick={() => setEditing(null)}><Plus /> Novo cliente</Button>}
      />

      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Nome, CPF/CNPJ, telefone ou e-mail" />
          {search.q && <span className="text-xs text-muted-foreground">{number(list.length)} encontrado{list.length === 1 ? "" : "s"}</span>}
        </div>
      </Panel>

      <Panel>
        {list.length === 0 ? (
          <EmptyState
            title={customers.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente encontrado"}
            description={customers.length === 0 ? "Cadastre clientes para registrar pedidos e acompanhar o que cada um comprou." : "Tente outra pesquisa."}
            action={customers.length === 0 && canSales ? <Button onClick={() => setEditing(null)}><Plus /> Novo cliente</Button> : undefined}
          />
        ) : (
          <>
            <ul className="-my-2 divide-y md:hidden">
              {list.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.document && <p className="text-xs text-muted-foreground">{formatDocument(c.document)}</p>}
                    {contact(c)}
                    <p className="text-xs text-muted-foreground">
                      {place(c)} · {number(c.stats.orderCount)} pedido{c.stats.orderCount === 1 ? "" : "s"} · {money(c.stats.totalSpent)}
                    </p>
                  </div>
                  {actions(c)}
                </li>
              ))}
            </ul>

            <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-5 pb-2 font-medium">Cliente</th>
                    <th className="px-3 pb-2 font-medium">Contato</th>
                    <th className="px-3 pb-2 font-medium">Cidade / UF</th>
                    <th className="px-3 pb-2 text-right font-medium">Pedidos</th>
                    <th className="px-3 pb-2 text-right font-medium">Total comprado</th>
                    <th className="px-3 pb-2 font-medium">Última compra</th>
                    <th className="w-12 px-3 pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((c) => (
                    <tr key={c.id} className="align-middle">
                      <td className="px-5 py-2.5">
                        <p className="max-w-xs truncate font-medium" title={c.name}>{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.document ? formatDocument(c.document) : "Sem CPF/CNPJ"}</p>
                      </td>
                      <td className="max-w-[15rem] px-3 py-2.5">{contact(c)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{place(c)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{number(c.stats.orderCount)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(c.stats.totalSpent)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{date(c.stats.lastPurchase)}</td>
                      <td className="px-3 py-2.5 text-right">{actions(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {editing !== undefined && <CustomerDialog customer={editing} customers={customers} onClose={() => setEditing(undefined)} />}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir clientes sem pedidos e sem contas a receber. O histórico de vendas nunca é apagado.
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
