import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchAll } from "@/lib/db";
import { isValidDocument, onlyDigits } from "@/lib/format";

export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];

export const suppliersQuery = queryOptions({
  queryKey: ["suppliers", "all"],
  queryFn: () => fetchAll<Supplier>((a, b) => supabase.from("suppliers").select("*").order("name").order("id").range(a, b)),
});

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export type SupplierStatus = "ativos" | "inativos" | "todos";

/** Accent-insensitive search by name, contact, e-mail or what they supply; 3+ digits also match CPF/CNPJ and phone. */
export function filterSuppliers<T extends Supplier>(list: T[], query: string | undefined, status: SupplierStatus = "todos"): T[] {
  const q = fold(query ?? "");
  const digits = onlyDigits(q);
  return list.filter((s) => {
    if (status === "ativos" && !s.active) return false;
    if (status === "inativos" && s.active) return false;
    if (!q) return true;
    if (fold([s.name, s.contact_name, s.email, s.products_supplied].filter(Boolean).join(" ")).includes(q)) return true;
    if (digits.length >= 3) return [s.document, s.phone].some((v) => v && onlyDigits(v).includes(digits));
    return false;
  });
}

export interface SupplierForm {
  name: string; document: string; contact_name: string; phone: string; email: string; address: string;
  products_supplied: string; payment_terms: string; notes: string; active: boolean;
}

export function emptySupplierForm(s?: Supplier | null): SupplierForm {
  return {
    name: s?.name ?? "", document: s?.document ?? "", contact_name: s?.contact_name ?? "", phone: s?.phone ?? "",
    email: s?.email ?? "", address: s?.address ?? "", products_supplied: s?.products_supplied ?? "",
    payment_terms: s?.payment_terms ?? "", notes: s?.notes ?? "", active: s?.active ?? true,
  };
}

type Errors = Partial<Record<keyof SupplierForm, string>>;

/** Same rules the database enforces, checked before sending so the user sees them next to the field. */
export function validateSupplier(f: SupplierForm): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Informe o nome.";
  const doc = onlyDigits(f.document);
  if (doc && !isValidDocument(doc)) e.document = doc.length === 11 ? "CPF inválido." : doc.length === 14 ? "CNPJ inválido." : "CPF tem 11 dígitos e CNPJ 14.";
  const p = onlyDigits(f.phone);
  if (p && (p.length < 10 || p.length > 13)) e.phone = "Informe DDD e número.";
  if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = "E-mail inválido.";
  return e;
}

export interface SupplierDuplicate { supplier: Supplier; reason: "documento" | "nome" }

/** Same CPF/CNPJ is a hard block (the database also rejects it); same name is a warning the user must confirm. */
export function findSupplierDuplicates(list: Supplier[], f: SupplierForm, selfId?: string | null): SupplierDuplicate[] {
  const doc = onlyDigits(f.document);
  const name = fold(f.name);
  const out: SupplierDuplicate[] = [];
  for (const s of list) {
    if (s.id === selfId) continue;
    if (doc && s.document && onlyDigits(s.document) === doc) out.push({ supplier: s, reason: "documento" });
    else if (name && fold(s.name) === name) out.push({ supplier: s, reason: "nome" });
  }
  return out;
}

/** Values sent to the database: digits only for numbers, empty text as null (the database normalizes again). */
export function supplierPayload(f: SupplierForm) {
  const t = (v: string) => v.trim() || null;
  const d = (v: string) => onlyDigits(v) || null;
  return {
    name: f.name.trim(), document: d(f.document), contact_name: t(f.contact_name), phone: d(f.phone),
    email: t(f.email)?.toLowerCase() ?? null, address: t(f.address), products_supplied: t(f.products_supplied),
    payment_terms: t(f.payment_terms), notes: t(f.notes), active: f.active,
  };
}
