import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, NativeSelect } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  IMAGE_TYPES, MAX_IMAGE_BYTES, PRODUCT_IMAGES_BUCKET, buildCategoryTree, marginPercent, productsQuery,
  suppliersListQuery, useSignedImages, type Category, type Product,
} from "@/lib/catalog";
import { decimalInput, errorMessage, money, number, parseDecimal, percent } from "@/lib/format";

const text = (v: string) => v.trim() || null;

export function ProductDialog({ product, categories, onClose }: { product: Product | null; categories: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery(suppliersListQuery);
  const { data: signed } = useSignedImages([product?.image_url]);
  const [f, setF] = useState(() => ({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? "",
    brand: product?.brand ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    supplier_id: product?.supplier_id ?? "",
    cost: decimalInput(product?.cost),
    price: decimalInput(product?.price),
    min_stock: String(product?.min_stock ?? 0),
    weight_kg: decimalInput(product?.weight_kg, 3),
    height_cm: decimalInput(product?.height_cm, 1),
    width_cm: decimalInput(product?.width_cm, 1),
    length_cm: decimalInput(product?.length_cm, 1),
    variations: product?.variations ?? "",
    active: product?.active ?? true,
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const currentUrl = preview ?? (!removeImage && product?.image_url ? signed?.[product.image_url] : undefined);

  const tree = buildCategoryTree(categories.filter((c) => c.active || c.id === product?.category_id));
  const cost = parseDecimal(f.cost) ?? 0;
  const price = parseDecimal(f.price) ?? 0;
  const margin = marginPercent(price, cost);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files?.[0];
    e.target.value = "";
    if (!fl) return;
    if (!IMAGE_TYPES.includes(fl.type)) { toast.error("Use uma foto JPG, PNG ou WEBP."); return; }
    if (fl.size > MAX_IMAGE_BYTES) { toast.error("A foto deve ter no máximo 5 MB."); return; }
    setFile(fl);
    setRemoveImage(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) { toast.error("Informe o nome do produto."); return; }
    const nums: Record<string, number | null> = {};
    for (const [k, label] of [["cost", "Custo"], ["price", "Preço de venda"], ["weight_kg", "Peso"], ["height_cm", "Altura"], ["width_cm", "Largura"], ["length_cm", "Comprimento"]] as const) {
      const raw = f[k].trim();
      const v = parseDecimal(raw);
      if (raw && (v === null || v < 0)) { toast.error(`${label}: informe um número válido, sem valores negativos.`); return; }
      nums[k] = v;
    }
    if (!/^\d+$/.test(f.min_stock.trim())) { toast.error("Estoque mínimo: informe um número inteiro."); return; }

    setBusy(true);
    let uploaded: string | null = null;
    if (file) {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      uploaded = `produtos/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(uploaded, file, { contentType: file.type });
      if (error) { setBusy(false); { toast.error(`Não foi possível enviar a foto. ${errorMessage(error)}`); return; } }
    }
    const image_url = uploaded ?? (removeImage ? null : product?.image_url ?? null);
    const c = nums["cost"] ?? 0;
    const p = nums["price"] ?? 0;
    const payload = {
      name,
      description: text(f.description),
      category_id: f.category_id || null,
      brand: text(f.brand),
      sku: text(f.sku),
      barcode: text(f.barcode),
      supplier_id: f.supplier_id || null,
      cost: c,
      price: p,
      // margin is a generated column computed by the database from price and cost.
      min_stock: Number(f.min_stock),
      weight_kg: nums["weight_kg"] ?? null,
      height_cm: nums["height_cm"] ?? null,
      width_cm: nums["width_cm"] ?? null,
      length_cm: nums["length_cm"] ?? null,
      variations: text(f.variations),
      active: f.active,
      image_url,
    };
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    if (error) {
      if (uploaded) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([uploaded]);
      setBusy(false);
      { toast.error(errorMessage(error)); return; }
    }
    if (product?.image_url && product.image_url !== image_url) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([product.image_url]);
    }
    await Promise.all([qc.invalidateQueries({ queryKey: productsQuery.queryKey }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);
    setBusy(false);
    toast.success(product ? "Produto atualizado" : "Produto cadastrado");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>{product ? `Código ${product.code}` : "O código interno é gerado automaticamente."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="shrink-0">
              <div className="relative grid size-32 place-items-center overflow-hidden rounded-md border bg-muted">
                {currentUrl ? <img src={currentUrl} alt="" className="size-full object-cover" /> : <ImagePlus className="size-7 text-muted-foreground" />}
              </div>
              <div className="mt-2 flex gap-1">
                <Button type="button" variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    {currentUrl ? "Trocar" : "Enviar foto"}
                    <input type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={pickFile} />
                  </label>
                </Button>
                {currentUrl && (
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Remover foto" onClick={() => { setFile(null); setRemoveImage(true); }}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid flex-1 gap-4">
              <Field label="Nome" required>
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={150} autoFocus={!product} />
              </Field>
              <Field label="Categoria">
                <NativeSelect value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
                  <option value="">Sem categoria</option>
                  {tree.map((r) => (
                    <optgroup key={r.id} label={r.name}>
                      <option value={r.id}>{r.name} (geral)</option>
                      {r.children.map((ch) => <option key={ch.id} value={ch.id}>{r.name} › {ch.name}</option>)}
                    </optgroup>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Custo (R$)" hint="Quanto a loja paga por unidade">
              <Input value={f.cost} onChange={(e) => set("cost", e.target.value)} inputMode="decimal" placeholder="0,00" />
            </Field>
            <Field label="Preço de venda (R$)">
              <Input value={f.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" placeholder="0,00" />
            </Field>
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Margem bruta</p>
              <p className={margin !== null && margin < 0 ? "font-display text-2xl text-destructive" : "font-display text-2xl text-primary"}>{margin === null ? "—" : percent(margin)}</p>
              <p className="text-[11px] text-muted-foreground">{margin === null ? "Informe custo e preço" : `Lucro de ${money(price - cost)} por unidade`}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Marca"><Input value={f.brand} onChange={(e) => set("brand", e.target.value)} maxLength={80} /></Field>
            <Field label="SKU" hint="Precisa ser único"><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} maxLength={60} /></Field>
            <Field label="Código de barras"><Input value={f.barcode} onChange={(e) => set("barcode", e.target.value)} inputMode="numeric" maxLength={30} /></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fornecedor" hint={suppliers.length === 0 ? "Nenhum fornecedor cadastrado ainda." : undefined}>
              <NativeSelect value={f.supplier_id} onChange={(e) => set("supplier_id", e.target.value)} disabled={suppliers.length === 0}>
                <option value="">Sem fornecedor</option>
                {suppliers.filter((s) => s.active || s.id === product?.supplier_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Estoque mínimo" hint={product ? `Estoque atual: ${number(product.stock_qty)} un. (altere em "Movimentar estoque")` : "O estoque começa em 0; registre uma entrada depois de salvar."}>
              <Input value={f.min_stock} onChange={(e) => set("min_stock", e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
            </Field>
          </div>

          <Field label="Variações" hint="Ex.: P, M, G, GG. O estoque ainda é um só para todas as variações.">
            <Input value={f.variations} onChange={(e) => set("variations", e.target.value)} maxLength={200} />
          </Field>
          <Field label="Descrição">
            <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={2000} />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Peso e medidas da embalagem (para frete)</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input aria-label="Peso em kg" value={f.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} inputMode="decimal" placeholder="Peso (kg)" />
              <Input aria-label="Altura em cm" value={f.height_cm} onChange={(e) => set("height_cm", e.target.value)} inputMode="decimal" placeholder="Altura (cm)" />
              <Input aria-label="Largura em cm" value={f.width_cm} onChange={(e) => set("width_cm", e.target.value)} inputMode="decimal" placeholder="Largura (cm)" />
              <Input aria-label="Comprimento em cm" value={f.length_cm} onChange={(e) => set("length_cm", e.target.value)} inputMode="decimal" placeholder="Compr. (cm)" />
            </div>
          </fieldset>

          <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <span>Produto ativo<span className="block text-xs text-muted-foreground">Inativos não aparecem para venda, mas o histórico é mantido.</span></span>
            <Switch checked={f.active} onCheckedChange={(v) => set("active", v)} />
          </label>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar produto"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
