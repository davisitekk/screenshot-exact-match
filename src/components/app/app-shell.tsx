import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, ShoppingBag, Users, Package, Boxes, Truck, ArrowDownCircle, ArrowUpCircle,
  LineChart, Wallet, UserCog, History, Settings, LogOut, Menu, FolderTree,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { settingsQuery } from "@/lib/settings";
import { ROLES, type AppRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles?: AppRole[] };
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Geral", items: [{ to: "/dashboard", label: "Painel", icon: LayoutDashboard }] },
  {
    group: "Vendas",
    items: [
      { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { to: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    group: "Catálogo",
    items: [
      { to: "/produtos", label: "Produtos", icon: Package },
      { to: "/categorias", label: "Categorias", icon: FolderTree },
      { to: "/estoque", label: "Estoque", icon: Boxes },
      { to: "/fornecedores", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    group: "Financeiro",
    items: [
      { to: "/financeiro/receber", label: "Contas a receber", icon: ArrowDownCircle, roles: ["financeiro"] },
      { to: "/financeiro/pagar", label: "Contas a pagar", icon: ArrowUpCircle, roles: ["financeiro"] },
      { to: "/financeiro/caixa", label: "Fluxo de caixa", icon: LineChart, roles: ["financeiro"] },
      { to: "/financeiro/contas", label: "Contas e carteiras", icon: Wallet, roles: ["financeiro"] },
    ],
  },
  {
    group: "Administração",
    items: [
      { to: "/usuarios", label: "Usuários", icon: UserCog, roles: ["admin"] },
      { to: "/atividades", label: "Atividades", icon: History, roles: ["admin"] },
      { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
    ],
  },
];

/** Store wordmark in the store's display lettering: last word in gold. */
export function BrandMark({ name, className }: { name?: string | null | undefined; className?: string }) {
  const words = (name?.trim() || "Minha Loja").split(/\s+/);
  const last = words.length > 1 ? words.pop() : undefined;
  return (
    <p className={cn("truncate font-display text-2xl leading-none text-sidebar-foreground", className)}>
      {words.join(" ")}
      {last && <span className="text-sidebar-primary"> {last}</span>}
    </p>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { me, has } = useMe();
  const { data: settings } = useQuery(settingsQuery);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 pb-4 pt-5">
        <BrandMark name={settings?.store_name} />
        <p className="eyebrow mt-1 text-sidebar-muted">Gestão da loja</p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.roles || has(...i.roles));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <p className="eyebrow px-2 pb-1.5 text-sidebar-muted">{g.group}</p>
              <ul className="space-y-0.5">
                {items.map((i) => {
                  const active = pathname === i.to || pathname.startsWith(i.to + "/");
                  return (
                    <li key={i.to}>
                      <Link
                        to={i.to}
                        onClick={onNavigate}
                        className={cn(
                          "relative flex items-center gap-3 rounded-sm px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-sidebar-primary"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <i.icon className={cn("size-4", active && "text-sidebar-primary")} />
                        {i.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium">{me?.fullName}</p>
          <p className="truncate text-[11px] text-sidebar-muted">{me?.roles.map((r) => ROLES[r].label).join(", ")}</p>
        </div>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="size-4" /> Sair
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: settings } = useQuery(settingsQuery);
  return (
    <div className="min-h-screen bg-background">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>
      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu />
        </Button>
        <BrandMark name={settings?.store_name} />
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
