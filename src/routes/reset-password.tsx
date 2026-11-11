import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/ui";
import { errorMessage } from "@/lib/format";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Gestão da Loja" },
      { name: "description", content: "Defina uma nova senha de acesso ao sistema de gestão." },
      { property: "og:title", content: "Nova senha — Gestão da Loja" },
      { property: "og:description", content: "Defina uma nova senha de acesso ao sistema de gestão." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => { if (s.session && isRecovery) setReady(true); else if (s.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { toast.error("As senhas não conferem."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Senha alterada com sucesso.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-card">
        <h1 className="text-xl font-semibold">Criar nova senha</h1>
        {!ready ? (
          <p className="mt-3 text-sm text-muted-foreground">Validando o link de recuperação... Se nada acontecer, solicite um novo link na tela de login.</p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Nova senha" required><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="Confirmar senha" required><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
            <Button className="w-full" disabled={busy}>{busy ? "Salvando..." : "Salvar nova senha"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
