import type { WpExport } from "./types.ts";
export interface Counts { posts: Record<string, number>; postTerms: number; attachmentsReferenced: number }
export function expectedCounts(exp: WpExport): Counts {
  const posts: Record<string, number> = {}; let postTerms = 0; const att = new Set<number>();
  for (const p of exp.posts) {
    if (p.password_protected || p.status !== "publish") continue;
    posts[p.type] = (posts[p.type] ?? 0) + 1;
    postTerms += new Set(p.terms.map((t) => `${t.taxonomy}/${t.slug}`)).size;
    if (p.thumbnail_id !== null && exp.attachments.some((a) => a.id === p.thumbnail_id)) att.add(p.thumbnail_id);
  }
  return { posts, postTerms, attachmentsReferenced: att.size };
}
export function compareCounts(e: Counts, a: Counts): string[] {
  const out: string[] = [];
  for (const k of new Set([...Object.keys(e.posts), ...Object.keys(a.posts)]))
    if ((e.posts[k] ?? 0) !== (a.posts[k] ?? 0)) out.push(`posts.${k}: expected ${e.posts[k] ?? 0}, actual ${a.posts[k] ?? 0}`);
  if (e.postTerms !== a.postTerms) out.push(`postTerms: expected ${e.postTerms}, actual ${a.postTerms}`);
  if (e.attachmentsReferenced !== a.attachmentsReferenced) out.push(`attachmentsReferenced: expected ${e.attachmentsReferenced}, actual ${a.attachmentsReferenced}`);
  return out;
}
export function findBrokenMediaLinks(html: string, known: Set<string>): string[] {
  return [...html.matchAll(/\/media\/([^\s"'<>,)]+)/g)].map((m) => m[1]).filter((p) => !known.has(p));
}
