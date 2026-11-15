import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, NativeSelect } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UF } from "@/lib/constants";
import {
  customerPayload, customersQuery, emptyCustomerForm, findPossibleDuplicates, validateCustomer,
  type Customer, type CustomerForm, type DuplicateMatch,
} from "@/lib/customers";
import { errorMessage, formatDocument, onlyDigits, todayISO } from "@/lib/format";

const REASON: Record<DuplicateMatch["reason"], string> = {
  documento: "mesmo CPF/CNPJ", "e-mail": "mesmo e-mail", telefone: "mesmo telefone", nome: "mesmo nome",
};

export function CustomerDialog({ customer, customers, onClose }: { customer: Customer | null; customers: Customer[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<CustomerForm>(() => emptyCustomerForm(customer));
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerForm, string>>>({});
  const [confirmDup, setConfirmDup] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CustomerForm, v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((s) => (s[k] ? { ...s, [k]: undefined } : s));
    setConfirmDup(false);
  };

  const dups = findPossibleDuplicates(customers, f, customer?.id);
  const hardDup = dups.find((d) => d.reason === "documento");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateCustomer(f);
    if (hardDup) errs.document = `Já cadastrado para ${hardDup.customer.name}.`;
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Revise os campos destacados."); return; }
    if (dups.length && !confirmDup) { setConfirmDup(true); return; }
    setBusy(true);
    const payload = customerPayload(f);
    const { error } = customer
      ? await supabase.from("customers").update(payload).eq("id", customer.id)
      : await supabase.from("customers").insert(payload);
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(customer ? "Cliente atualizado" : "Cliente cadastrado");
    await qc.invalidateQueries({ queryKey: customersQuery.queryKey });
    onClose();
  }

  const input = (k: keyof CustomerForm, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Input value={f[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} {...props} />
  );
  const err = (k: keyof CustomerForm) => errors[k];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{customer ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Só o nome é obrigatório. CPF/CNPJ não pode se repetir entre clientes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" required className="sm:col-span-2" error={err("name")}>{input("name", { maxLength: 150, autoFocus: true })}</Field>
            <Field label="CPF ou CNPJ" error={err("document")}>
              {input("document", { inputMode: "numeric", maxLength: 18, onBlur: () => set("document", formatDocument(onlyDigits(f.document)) || f.document) })}
            </Field>
            <Field label="Data de nascimento" error={err("birth_date")}>{input("birth_date", { type: "date", max: todayISO() })}</Field>
            <Field label="WhatsApp" error={err("whatsapp")} hint="Com DDD, ex.: (11) 91234-5678">{input("whatsapp", { inputMode: "tel", maxLength: 20 })}</Field>
            <Field label="Telefone" error={err("phone")}>{input("phone", { inputMode: "tel", maxLength: 20 })}</Field>
            <Field label="E-mail" className="sm:col-span-2" error={err("email")}>{input("email", { type: "email", maxLength: 150, autoComplete: "off" })}</Field>
          </div>

          <fieldset className="grid gap-4 border-t pt-4 sm:grid-cols-6">
            <legend className="eyebrow mb-1 text-muted-foreground">Endereço de entrega</legend>
            <Field label="CEP" className="sm:col-span-2" error={err("zip")}>{input("zip", { inputMode: "numeric", maxLength: 9 })}</Field>
            <Field label="Cidade" className="sm:col-span-3">{input("city", { maxLength: 100 })}</Field>
            <Field label="UF" className="sm:col-span-1">
              <NativeSelect value={f.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">—</option>
                {UF.map((u) => <option key={u} value={u}>{u}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Rua / avenida" className="sm:col-span-4">{input("address", { maxLength: 200 })}</Field>
            <Field label="Número" className="sm:col-span-2">{input("address_number", { maxLength: 20 })}</Field>
            <Field label="Bairro" className="sm:col-span-3">{input("district", { maxLength: 100 })}</Field>
            <Field label="Complemento" className="sm:col-span-3">{input("complement", { maxLength: 100 })}</Field>
          </fieldset>

          <Field label="Observações">
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={1000} placeholder="Ex.: tamanho que costuma usar, preferências" />
          </Field>

          {dups.length > 0 && !hardDup && (
            <div role="alert" className="flex gap-3 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <div>
                <p className="font-medium">Pode ser um cliente já cadastrado:</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {dups.slice(0, 5).map((d) => <li key={d.customer.id}>{d.customer.name} ({REASON[d.reason]})</li>)}
                </ul>
                {confirmDup && <p className="mt-2 font-medium">Confira antes de salvar. Clique em "Salvar mesmo assim" se for outra pessoa.</p>}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando..." : confirmDup ? "Salvar mesmo assim" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
