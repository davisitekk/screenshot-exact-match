import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchAll } from "@/lib/db";
import { isValidDocument, onlyDigits, todayISO } from "@/lib/format";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export interface CustomerStats { orderCount: number; totalSpent: number; lastPurchase: string | null }
export type CustomerWithStats = Customer & { stats: CustomerStats };

const NO_STATS: CustomerStats = { orderCount: 0, totalSpent: 0, lastPurchase: null };

export const customersQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: async (): Promise<CustomerWithStats[]> => {
    const [rows, sums] = await Promise.all([
      fetchAll<Customer>((a, b) => supabase.from("customers").select("*").order("name").order("id").range(a, b)),
      fetchAll<Database["public"]["Views"]["customer_summary"]["Row"]>((a, b) =>
        supabase.from("customer_summary").select("*").order("id").range(a, b)),
    ]);
    const byId = new Map(sums.map((s) => [s.id, s]));
    return rows.map((c) => {
      const s = byId.get(c.id);
      return {
        ...c,
        stats: s ? { orderCount: Number(s.order_count ?? 0), totalSpent: Number(s.total_spent ?? 0), lastPurchase: s.last_purchase } : NO_STATS,
      };
    });
  },
});

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Accent-insensitive search by name, e-mail or city; 3+ typed digits also match CPF/CNPJ, phone and WhatsApp. */
export function filterCustomers<T extends Customer>(list: T[], query: string | undefined): T[] {
  const q = fold(query ?? "");
  if (!q) return list;
  const digits = onlyDigits(q);
  return list.filter((c) => {
    if (fold([c.name, c.email, c.city].filter(Boolean).join(" ")).includes(q)) return true;
    if (digits.length >= 3) return [c.document, c.phone, c.whatsapp].some((v) => v && onlyDigits(v).includes(digits));
    return false;
  });
}

export interface CustomerForm {
  name: string; document: string; phone: string; whatsapp: string; email: string; birth_date: string;
  zip: string; state: string; city: string; district: string; address: string; address_number: string; complement: string; notes: string;
}

export function emptyCustomerForm(c?: Customer | null): CustomerForm {
  return {
    name: c?.name ?? "", document: c?.document ?? "", phone: c?.phone ?? "", whatsapp: c?.whatsapp ?? "", email: c?.email ?? "",
    birth_date: c?.birth_date ?? "", zip: c?.zip ?? "", state: c?.state ?? "", city: c?.city ?? "", district: c?.district ?? "",
    address: c?.address ?? "", address_number: c?.address_number ?? "", complement: c?.complement ?? "", notes: c?.notes ?? "",
  };
}

/** Same rules the database enforces, checked before sending so the user sees them next to the field. */
export function validateCustomer(f: CustomerForm, today = todayISO()): Partial<Record<keyof CustomerForm, string>> {
  const e: Partial<Record<keyof CustomerForm, string>> = {};
  if (!f.name.trim()) e.name = "Informe o nome.";
  const doc = onlyDigits(f.document);
  if (doc && !isValidDocument(doc)) e.document = doc.length === 11 ? "CPF inválido." : doc.length === 14 ? "CNPJ inválido." : "CPF tem 11 dígitos e CNPJ 14.";
  for (const k of ["phone", "whatsapp"] as const) {
    const d = onlyDigits(f[k]);
    if (d && (d.length < 10 || d.length > 13)) e[k] = "Informe DDD e número.";
  }
  if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = "E-mail inválido.";
  const zip = onlyDigits(f.zip);
  if (zip && zip.length !== 8) e.zip = "CEP tem 8 dígitos.";
  if (f.birth_date && (f.birth_date > today || f.birth_date < "1900-01-01")) e.birth_date = "Data inválida.";
  return e;
}

export interface DuplicateMatch { customer: Customer; reason: "documento" | "e-mail" | "telefone" | "nome" }

/**
 * Existing customers that look like the same person. Same CPF/CNPJ is a hard block (the database
 * also rejects it); same e-mail, phone or name is a warning the user must confirm.
 */
export function findPossibleDuplicates(list: Customer[], f: CustomerForm, selfId?: string | null): DuplicateMatch[] {
  const doc = onlyDigits(f.document);
  const email = f.email.trim().toLowerCase();
  const phones = [f.phone, f.whatsapp].map(onlyDigits).filter((d) => d.length >= 10);
  const name = fold(f.name);
  const out: DuplicateMatch[] = [];
  for (const c of list) {
    if (c.id === selfId) continue;
    if (doc && c.document && onlyDigits(c.document) === doc) out.push({ customer: c, reason: "documento" });
    else if (email && c.email && c.email.toLowerCase() === email) out.push({ customer: c, reason: "e-mail" });
    else if (phones.length && [c.phone, c.whatsapp].some((p) => p && phones.includes(onlyDigits(p)))) out.push({ customer: c, reason: "telefone" });
    else if (name && fold(c.name) === name) out.push({ customer: c, reason: "nome" });
  }
  return out;
}

/** Values sent to the database: digits only for numbers, empty text as null (the database normalizes again). */
export function customerPayload(f: CustomerForm) {
  const t = (v: string) => v.trim() || null;
  const d = (v: string) => onlyDigits(v) || null;
  return {
    name: f.name.trim(), document: d(f.document), phone: d(f.phone), whatsapp: d(f.whatsapp), email: t(f.email)?.toLowerCase() ?? null,
    birth_date: f.birth_date || null, zip: d(f.zip), state: t(f.state), city: t(f.city), district: t(f.district),
    address: t(f.address), address_number: t(f.address_number), complement: t(f.complement), notes: t(f.notes),
  };
}
