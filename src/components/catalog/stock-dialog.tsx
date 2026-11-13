import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, NativeSelect } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STOCK_TYPES, type StockMovementType } from "@/lib/constants";
import { productsQuery, type Product } from "@/lib/catalog";
import { errorMessage, number } from "@/lib/format";

const MANUAL = (Object.keys(STOCK_TYPES) as StockMovementType[]).filter((t) => STOCK_TYPES[t].manual);

/** Manual stock movement for one product; the balance is changed only by the database function. */
export function StockDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<StockMovementType>("entrada");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const q = /^\d+$/.test(qty.trim()) ? Number(qty) : null;
  const isAdjust = type === "ajuste";
  const after = q === null ? null : isAdjust ? q : product.stock_qty + STOCK_TYPES[type].sign * q;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q === null || (!isAdjust && q === 0)) { toast.error(isAdjust ? "Informe a quantidade contada." : "Informe uma quantidade maior que zero."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("register_stock_movement", { p_product: product.id, p_type: type, p_quantity: q, p_reason: reason });
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(`Estoque de ${product.name}: ${number(data)} un.`);
    await Promise.all([
      qc.invalidateQueries({ queryKey: productsQuery.queryKey }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["alerts"] }),
    ]);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar estoque</DialogTitle>
          <DialogDescription>{product.name} · estoque atual: <strong className="text-foreground">{number(product.stock_qty)} un.</strong></DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Tipo de movimentação" required>
            <NativeSelect value={type} onChange={(e) => setType(e.target.value as StockMovementType)}>
              {MANUAL.map((t) => <option key={t} value={t}>{STOCK_TYPES[t].label}</option>)}
            </NativeSelect>
          </Field>
          <Field label={isAdjust ? "Quantidade contada no inventário" : "Quantidade"} required hint={isAdjust ? "O estoque passa a ser exatamente este número." : undefined}>
            <Input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoFocus placeholder="0" />
          </Field>
          <Field label="Motivo / observação">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={type === "entrada" ? "Ex.: compra do fornecedor, nota 123" : ""} />
          </Field>
          {after !== null && (
            <p className={after < 0 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              Estoque após a movimentação: <strong className="tabular-nums">{number(after)} un.</strong>
              {after < 0 && " — ficará negativo; só é permitido se a loja liberar estoque negativo nas configurações."}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Registrando..." : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
