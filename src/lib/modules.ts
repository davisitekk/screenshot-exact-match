/** Menu paths that already have a working screen. Others show as "Em breve" instead of opening a missing page. */
export const READY_PATHS: ReadonlySet<string> = new Set(["/dashboard", "/produtos", "/categorias"]);

export function isReady(path: string): boolean {
  return READY_PATHS.has(path);
}
