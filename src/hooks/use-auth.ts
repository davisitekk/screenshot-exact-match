import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/constants";

export interface Me {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  roles: AppRole[];
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, active").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    return {
      id: u.user.id,
      email: u.user.email ?? profile?.email ?? "",
      fullName: profile?.full_name || u.user.email || "",
      active: profile?.active ?? true,
      roles: (roles ?? []).map((r) => r.role),
    };
  },
  staleTime: 60_000,
});

export function useMe() {
  const { data } = useQuery(meQuery);
  const roles = data?.roles ?? [];
  const has = (...r: AppRole[]) => roles.includes("admin") || r.some((x) => roles.includes(x));
  return {
    me: data ?? null,
    isAdmin: roles.includes("admin"),
    canSales: has("vendas"),
    canFinance: has("financeiro"),
    has,
  };
}
