/**
 * Reads every row of a query in pages. The Data API caps a single response (1000 rows by default),
 * so a plain select would silently drop rows once a table grows past that.
 * The page callback must apply a deterministic order (e.g. name, then id).
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}
