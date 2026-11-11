import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loading } from "@/components/app/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão da Loja — Vendas, estoque e financeiro" },
      { name: "description", content: "Sistema completo de gestão para e-commerce: pedidos, estoque, clientes, contas a pagar e a receber." },
      { property: "og:title", content: "Gestão da Loja" },
      { property: "og:description", content: "Pedidos, estoque, clientes e financeiro integrados em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return <Loading />;
}
