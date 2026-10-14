import type { WpExport } from "./types.ts";
export function urlsFor(exp: WpExport): string[] {
  const set = new Set<string>(["/", "/en/"]);
  for (const p of exp.posts) {
    if (p.status !== "publish" || p.password_protected) continue;
    const path = p.type === "page" ? `/${p.slug}/` : `/${p.type}/${p.slug}/`;
    set.add(path); set.add(`/en${path}`);
  }
  return [...set].sort();
}
export function extractHead(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? null;
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
  return { title, canonical };
}
type Snap = { status: number; title: string | null; canonical: string | null };
const pathOf = (u: string | null) => (u ? new URL(u).pathname : null);
export function diffPage(a: Snap, b: Snap): string[] {
  const out: string[] = [];
  if (a.status !== b.status) out.push(`status: ${a.status} vs ${b.status}`);
  if (a.title !== b.title) out.push(`title: ${a.title} vs ${b.title}`);
  if (pathOf(a.canonical) !== pathOf(b.canonical)) out.push(`canonical: ${a.canonical} vs ${b.canonical}`);
  return out;
}
