import { Input } from "@/components/ui/input";
import { addDaysISO, endOfMonthISO, startOfMonthISO, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Period = { start: string; end: string; preset: string };

export function presetPeriod(preset: string): Period {
  const t = todayISO();
  switch (preset) {
    case "hoje": return { start: t, end: t, preset };
    case "7d": return { start: addDaysISO(t, -6), end: t, preset };
    case "30d": return { start: addDaysISO(t, -29), end: t, preset };
    case "mes-passado": {
      const prev = addDaysISO(startOfMonthISO(t), -1);
      return { start: startOfMonthISO(prev), end: endOfMonthISO(prev), preset };
    }
    case "ano": return { start: `${t.slice(0, 4)}-01-01`, end: `${t.slice(0, 4)}-12-31`, preset };
    default: return { start: startOfMonthISO(t), end: endOfMonthISO(t), preset: "mes" };
  }
}

const PRESETS = [
  ["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["mes", "Este mês"], ["mes-passado", "Mês passado"], ["ano", "Este ano"],
] as const;

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-lg border bg-card p-0.5 shadow-card">
        {PRESETS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => onChange(presetPeriod(k))}
            className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors", value.preset === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input type="date" className="h-8 w-[9.5rem] text-xs" value={value.start} onChange={(e) => e.target.value && onChange({ start: e.target.value, end: value.end < e.target.value ? e.target.value : value.end, preset: "custom" })} aria-label="Data inicial" />
        <span className="text-xs text-muted-foreground">até</span>
        <Input type="date" className="h-8 w-[9.5rem] text-xs" value={value.end} onChange={(e) => e.target.value && onChange({ start: value.start > e.target.value ? e.target.value : value.start, end: e.target.value, preset: "custom" })} aria-label="Data final" />
      </div>
    </div>
  );
}

export function GroupToggle({ value, onChange }: { value: "dia" | "semana" | "mes" | "ano"; onChange: (v: "dia" | "semana" | "mes" | "ano") => void }) {
  const opts = [["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]] as const;
  return (
    <div className="flex rounded-md border p-0.5">
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={cn("rounded px-2 py-1 text-xs", value === k ? "bg-secondary font-semibold text-primary" : "text-muted-foreground")}>{l}</button>
      ))}
    </div>
  );
}
