import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/hooks/use-auth";
import { AppShell } from "@/components/app/app-shell";
import { Loading } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: me, isLoading } = useQuery(meQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (isLoading) return <Loading />;
  if (!me || !me.active || me.roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-warning-soft text-warning-foreground"><Clock className="size-5" /></span>
          <h1 className="text-lg font-semibold">{me && !me.active ? "Usuário bloqueado" : "Aguardando liberação"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {me && !me.active
              ? "Seu acesso foi bloqueado pelo administrador."
              : "Sua conta foi criada. Peça ao administrador da loja para definir o seu perfil de acesso."}
          </p>
          <Button variant="outline" className="mt-5" onClick={async () => { qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}>
            Sair
          </Button>
        </div>
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
