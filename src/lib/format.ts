export const TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function money(v: number | string | null | undefined) {
  return brl.format(Number(v ?? 0));
}
export function number(v: number | string | null | undefined) {
  return num.format(Number(v ?? 0));
}
export function percent(v: number | string | null | undefined) {
  return `${pct.format(Number(v ?? 0))}%`;
}

/** Formats a timestamp (or yyyy-mm-dd) as DD/MM/AAAA in Brasília time. */
export function date(v: string | Date | null | undefined) {
  if (!v) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v));
}

export function dateTime(v: string | Date | null | undefined) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(v));
}

/** Today's date in Brasília as yyyy-mm-dd. */
export function todayISO(): string {
  return isoInTZ(new Date());
}

export function isoInTZ(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA gives yyyy-mm-dd
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function startOfMonthISO(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonthISO(iso: string) {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string) {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86400000);
}

export function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

export function isValidCPF(value: string) {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export function isValidCNPJ(value: string) {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((s, wi, i) => s + Number(c[i]) * wi, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function isValidDocument(value: string) {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

export function formatDocument(value: string | null | undefined) {
  const d = onlyDigits(value ?? "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value ?? "";
}

export function errorMessage(e: unknown): string {
  if (!e) return "Erro desconhecido";
  if (typeof e === "string") return e;
  const m = (e as { message?: string }).message ?? String(e);
  if (m.includes("duplicate key")) {
    if (m.includes("sku")) return "Já existe um produto com este SKU.";
    if (m.includes("document")) return "Já existe um cadastro com este CPF/CNPJ.";
    return "Este registro já existe.";
  }
  if (m.includes("violates foreign key") || m.includes("still referenced"))
    return "Este registro está vinculado a outros lançamentos e não pode ser excluído. Inative-o.";
  if (m.includes("row-level security") || m.includes("permission denied"))
    return "Você não tem permissão para esta ação.";
  return m;
}
