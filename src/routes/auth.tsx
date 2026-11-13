import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BarChart3, Boxes, Wallet } from "lucide-react";
import lifestyle from "@/assets/importados-style-lifestyle.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/ui";
import { errorMessage } from "@/lib/format";
import { BrandMark } from "@/components/app/app-shell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Importados Style" },
      { name: "description", content: "Acesse o sistema de gestão de vendas, estoque e financeiro da loja." },
      { property: "og:title", content: "Entrar — Importados Style" },
      { property: "og:description", content: "Acesse o sistema de gestão de vendas, estoque e financeiro da loja." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message === "Email not confirmed" ? "Confirme seu e-mail antes de entrar." : error.message);
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else setNotice("Enviamos um link de confirmação para o seu e-mail. Confirme para acessar o sistema.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setNotice("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden border-r bg-sidebar lg:flex lg:flex-col lg:justify-between">
        <img src={lifestyle.url} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-35 grayscale" />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/85 to-sidebar/40" />
        <div className="relative p-12">
          <BrandMark name="Importados Style" className="text-4xl" />
          <p className="eyebrow mt-2 text-sidebar-muted">Gestão da loja</p>
        </div>
        <div className="relative max-w-lg p-12">
          <p className="eyebrow text-primary">Painel interno</p>
          <h1 className="mt-3 text-6xl leading-[0.92] text-sidebar-foreground">Toda a operação da loja em um só lugar.</h1>
          <p className="mt-5 max-w-md text-sidebar-muted">Pedidos, estoque, clientes e financeiro integrados — com lucro calculado de verdade, descontando custos, taxas e despesas.</p>
          <ul className="mt-10 space-y-4 text-sm text-sidebar-foreground">
            {[
              [BarChart3, "Indicadores de vendas e lucro"],
              [Boxes, "Estoque atualizado a cada venda"],
              [Wallet, "Contas a pagar, a receber e fluxo de caixa"],
            ].map(([Icon, t], i) => {
              const I = Icon as typeof Wallet;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-sm border border-primary/40 text-primary"><I className="size-4" /></span>
                  {t as string}
                </li>
              );
            })}
          </ul>
          <p className="mt-12 text-xs text-sidebar-muted">Dados protegidos com controle de acesso por perfil (LGPD).</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <BrandMark name="Importados Style" className="text-3xl" />
            <p className="eyebrow mt-1 text-muted-foreground">Gestão da loja</p>
          </div>
          <h2 className="font-display text-4xl">
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar acesso" : "Recuperar senha"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" && "Use seu e-mail e senha cadastrados."}
            {mode === "signup" && "O primeiro cadastro se torna o administrador. Os demais aguardam liberação."}
            {mode === "forgot" && "Informe seu e-mail para receber o link de redefinição."}
          </p>

          {notice ? (
            <div className="mt-6 rounded-lg border bg-success-soft p-4 text-sm text-success">{notice}</div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <Field label="Nome completo" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </Field>
              )}
              <Field label="E-mail" required>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </Field>
              {mode !== "forgot" && (
                <Field label="Senha" required hint={mode === "signup" ? "Mínimo de 8 caracteres." : undefined}>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
                </Field>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar acesso" : "Enviar link"}
              </Button>
            </form>
          )}

          <div className="mt-6 flex flex-col gap-2 text-sm">
            {mode === "login" ? (
              <>
                <button className="text-left text-primary hover:underline" onClick={() => { setMode("forgot"); setNotice(null); }}>Esqueci minha senha</button>
                <button className="text-left text-muted-foreground hover:text-foreground" onClick={() => { setMode("signup"); setNotice(null); }}>Primeiro acesso? Criar conta</button>
              </>
            ) : (
              <button className="text-left text-primary hover:underline" onClick={() => { setMode("login"); setNotice(null); }}>Voltar para o login</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
