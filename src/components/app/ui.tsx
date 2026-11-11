import type { ReactNode } from "react";
import { Search, ShieldOff, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/constants";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "default", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "success" | "warning" | "danger" | "brand"; icon?: ReactNode }) {
  const toneCls = {
    default: "bg-card",
    success: "bg-card",
    warning: "bg-card",
    danger: "bg-card",
    brand: "bg-brand text-primary-foreground border-transparent",
  }[tone];
  const dot = {
    default: "bg-secondary text-primary",
    success: "bg-success-soft text-accent-foreground",
    warning: "bg-warning-soft text-warning-foreground",
    danger: "bg-danger-soft text-destructive",
    brand: "bg-sidebar-accent text-sidebar-primary",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-4 shadow-card", toneCls)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-xs font-medium uppercase tracking-wide", tone === "brand" ? "text-sidebar-muted" : "text-muted-foreground")}>{label}</p>
        {icon && <span className={cn("grid size-8 place-items-center rounded-lg [&_svg]:size-4", dot)}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className={cn("mt-1 text-xs", tone === "brand" ? "text-sidebar-muted" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <Badge variant={tone === "default" ? "secondary" : tone}>{children}</Badge>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-secondary text-primary"><Inbox className="size-5" /></span>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AccessDenied() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
      <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-danger-soft text-destructive"><ShieldOff className="size-5" /></span>
      <h2 className="text-lg font-semibold">Acesso restrito</h2>
      <p className="mt-1 text-sm text-muted-foreground">Seu perfil não tem permissão para acessar esta área. Fale com o administrador.</p>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Pesquisar..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

export function Field({ label, children, hint, className, required }: { label: string; children: ReactNode; hint?: string | undefined; className?: string | undefined; required?: boolean | undefined }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto sm:-mx-5">{children}</div>;
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
        props.className,
      )}
    />
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <span className="size-6 animate-spin rounded-full border-2 border-muted border-t-success" />
    </div>
  );
}
