import type { WpExport } from "./types.ts";
import { rewriteUploads, findWpArtifacts } from "./transform.ts";

const q = (v: string | number | null): string =>
  v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`;
const nz = (s: unknown): string | null => (typeof s === "string" && s.trim() !== "" ? s : null);
const EN_KEYS = new Set(["title_en", "excerpt_en", "content_en"]);

export function buildImportSql(exp: WpExport) {
  const statements: string[] = [
    "DELETE FROM post_terms;", "DELETE FROM views;", "DELETE FROM post_meta;",
    "DELETE FROM posts;", "DELETE FROM terms;", "DELETE FROM settings;",
  ];
  const skipped: { id: number; reason: string }[] = [];
  const artifacts: { id: number; items: string[] }[] = [];
  const attach = new Map(exp.attachments.map((a) => [a.id, a.path]));
  const rw = (s: string | null) => (s === null ? null : rewriteUploads(s, exp.site_url));

  for (const t of exp.terms)
    statements.push(`INSERT INTO terms(taxonomy,slug,name,description) VALUES(${q(t.taxonomy)},${q(t.slug)},${q(t.name)},${q(nz(t.description))});`);

  for (const p of exp.posts) {
    if (p.password_protected) { skipped.push({ id: p.id, reason: "password_protected" }); continue; }
    if (p.status !== "publish") { skipped.push({ id: p.id, reason: `status:${p.status}` }); continue; }
    const m = p.meta;
    const content = rw(nz(p.content)), contentEn = rw(nz(m.content_en));
    const found = [...findWpArtifacts(content ?? ""), ...findWpArtifacts(contentEn ?? "")];
    if (found.length) artifacts.push({ id: p.id, items: found });
    const thumb = p.thumbnail_id !== null ? attach.get(p.thumbnail_id) ?? null : null;
    statements.push(
      `INSERT INTO posts(wp_id,type,slug,status,title,excerpt,content,title_en,excerpt_en,content_en,thumbnail,menu_order,published_at,modified_at) VALUES(` +
      [p.id, q(p.type), q(p.slug), q("publish"), q(p.title), q(nz(p.excerpt)), q(content), q(nz(m.title_en)), q(nz(m.excerpt_en)), q(contentEn), q(thumb), p.menu_order, q(p.date), q(p.modified)].join(",") + ");",
    );
    for (const [k, v] of Object.entries(m)) {
      if (k.startsWith("_") || EN_KEYS.has(k) || v === null || v === "") continue;
      statements.push(`INSERT INTO post_meta(post_id,key,value) VALUES((SELECT id FROM posts WHERE wp_id=${p.id}),${q(k)},${q(JSON.stringify(v))});`);
    }
    for (const t of p.terms)
      statements.push(`INSERT OR IGNORE INTO post_terms(post_id,term_id) VALUES((SELECT id FROM posts WHERE wp_id=${p.id}),(SELECT id FROM terms WHERE taxonomy=${q(t.taxonomy)} AND slug=${q(t.slug)}));`);
    if (p.views > 0)
      statements.push(`INSERT INTO views(post_id,count) VALUES((SELECT id FROM posts WHERE wp_id=${p.id}),${p.views});`);
  }
  for (const [k, v] of Object.entries(exp.options))
    statements.push(`INSERT INTO settings(key,value) VALUES(${q(k)},${q(JSON.stringify(v))});`);
  return { statements, skipped, artifacts };
}
