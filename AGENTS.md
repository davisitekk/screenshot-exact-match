<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Business rules (stock, orders, receivables/payables, transfers, dashboard math) live in Postgres SECURITY DEFINER functions called via `supabase.rpc`; the UI never writes stock_qty, order status or financial transactions directly — keeps every effect atomic and audited.
- `products.stock_qty` changes only through `_apply_stock` (guard trigger resets direct writes); every change writes a `stock_movements` row.
- Order/receivable/payable state columns are protected by column-level grants; only notes-like columns are directly updatable.
- Roles live in `user_roles` (admin, financeiro, vendas); RLS uses `has_role`/`has_any_role`/`is_staff`, which also require `profiles.active`.
- All dates are shown in America/Sao_Paulo via `src/lib/format.ts`; never format dates ad hoc.
- Product images are in the private `product-images` bucket; `products.image_url` stores the storage path and the UI uses signed URLs.
- Routes: public `/auth`, `/reset-password`; everything else under `src/routes/_authenticated/` (client-only gate, app shell with sidebar).
