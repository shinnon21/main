import type { D1Like, D1Stmt } from "../lib/d1.ts";
import { HttpError, type AdminRow, type CleanPost, type PostStatus, type PostType } from "./types.ts";
import { allowedTaxonomies, editableMetaKeys } from "./validate.ts";

export const REVISION_LIMIT = 50;

type Full = CleanPost & { id: number; modified_at: string };
const q = <T>(db: D1Like, sql: string, ...a: unknown[]) => db.prepare(sql).bind(...a).all<T>().then((r) => r.results);
const one = <T>(db: D1Like, sql: string, ...a: unknown[]) => db.prepare(sql).bind(...a).first<T>();
const ph = (n: number) => Array(n).fill("?").join(",");
const json = (v: unknown) => JSON.stringify(v);

interface PostRowDb {
  id: number; wp_id: number; type: PostType; slug: string; status: PostStatus; title: string; excerpt: string | null; content: string | null;
  title_en: string | null; excerpt_en: string | null; content_en: string | null; thumbnail: string | null; menu_order: number; published_at: string; modified_at: string;
}

export async function getAdminPost(db: D1Like, id: number): Promise<Full | null> {
  const p = await one<PostRowDb>(db, "SELECT * FROM posts WHERE id=?", id);
  if (!p) return null;
  const metaRows = await q<{ key: string; value: string }>(db, "SELECT key,value FROM post_meta WHERE post_id=?", id);
  const editable = new Set(editableMetaKeys(p.type));
  const meta: Record<string, unknown> = {};
  for (const r of metaRows) if (editable.has(r.key)) { try { meta[r.key] = JSON.parse(r.value); } catch { /* skip malformed */ } }
  const terms = await q<{ taxonomy: string; slug: string }>(db, "SELECT t.taxonomy,t.slug FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id=? ORDER BY t.id", id);
  return {
    id, type: p.type, title: p.title, title_en: p.title_en ?? "", slug: p.slug, status: p.status, published_at: p.published_at,
    excerpt: p.excerpt ?? "", excerpt_en: p.excerpt_en ?? "", content: p.content ?? "", content_en: p.content_en ?? "",
    thumbnail: p.thumbnail, meta, terms, modified_at: p.modified_at,
  };
}

export async function listAdminPosts(db: D1Like, f: { type?: string; status?: string; q?: string }, limit = 100): Promise<AdminRow[]> {
  const where: string[] = []; const args: unknown[] = [];
  if (f.type) { where.push("type=?"); args.push(f.type); }
  if (f.status) { where.push("status=?"); args.push(f.status); } else where.push("status<>'trash'");
  if (f.q) { where.push("title LIKE ? ESCAPE '\\'"); args.push(`%${f.q.replace(/[\\%_]/g, "\\$&")}%`); }
  return q<AdminRow>(db, `SELECT id,type,slug,title,status,published_at,modified_at FROM posts WHERE ${where.join(" AND ")} ORDER BY modified_at DESC, id DESC LIMIT ?`, ...args, limit);
}

async function assertTerms(db: D1Like, terms: { taxonomy: string; slug: string }[]) {
  for (const t of terms) {
    if (!(await one(db, "SELECT 1 x FROM terms WHERE taxonomy=? AND slug=?", t.taxonomy, t.slug))) throw new HttpError(400, `unknown term ${t.taxonomy}/${t.slug}`);
  }
}
const slugTaken = async (db: D1Like, type: string, slug: string, exceptId?: number) =>
  !!(await one(db, "SELECT 1 x FROM posts WHERE type=? AND slug=? AND id<>?", type, slug, exceptId ?? -1));

function metaStatements(db: D1Like, postId: number | null, type: PostType, slug: string, meta: Record<string, unknown>): D1Stmt[] {
  const pid = postId !== null ? "?" : "(SELECT id FROM posts WHERE type=? AND slug=?)";
  const pArgs = postId !== null ? [postId] : [type, slug];
  return Object.entries(meta).map(([k, v]) => db.prepare(`INSERT INTO post_meta(post_id,key,value) VALUES(${pid},?,?)`).bind(...pArgs, k, json(v)));
}
function termStatements(db: D1Like, postId: number | null, type: PostType, slug: string, terms: { taxonomy: string; slug: string }[]): D1Stmt[] {
  const pid = postId !== null ? "?" : "(SELECT id FROM posts WHERE type=? AND slug=?)";
  const pArgs = postId !== null ? [postId] : [type, slug];
  return terms.map((t) => db.prepare(`INSERT OR IGNORE INTO post_terms(post_id,term_id) SELECT ${pid}, id FROM terms WHERE taxonomy=? AND slug=?`).bind(...pArgs, t.taxonomy, t.slug));
}

export async function createPost(db: D1Like, p: CleanPost, by: string, nowUtc: string): Promise<{ id: number }> {
  await assertTerms(db, p.terms);
  if (await slugTaken(db, p.type, p.slug)) throw new HttpError(409, "slug exists");
  const published = p.published_at ?? nowUtc;
  const stmts: D1Stmt[] = [
    db.prepare(`INSERT INTO posts(wp_id,type,slug,status,title,excerpt,content,title_en,excerpt_en,content_en,thumbnail,menu_order,published_at,modified_at)
      VALUES(max((SELECT COALESCE(MAX(wp_id),0) FROM posts),999)+1,?,?,?,?,?,?,?,?,?,?,0,?,?)`)
      .bind(p.type, p.slug, p.status, p.title, p.excerpt || null, p.content || null, p.title_en || null, p.excerpt_en || null, p.content_en || null, p.thumbnail, published, nowUtc),
    ...metaStatements(db, null, p.type, p.slug, p.meta),
    ...termStatements(db, null, p.type, p.slug, p.terms),
  ];
  try { await db.batch(stmts); } catch (e) { if (/UNIQUE/i.test(String(e))) throw new HttpError(409, "slug exists"); throw e; }
  const row = await one<{ id: number }>(db, "SELECT id FROM posts WHERE type=? AND slug=?", p.type, p.slug);
  return { id: row!.id };
}

export async function snapshot(db: D1Like, id: number): Promise<string> {
  const post = await one<PostRowDb>(db, "SELECT * FROM posts WHERE id=?", id);
  const meta = await q<{ key: string; value: string }>(db, "SELECT key,value FROM post_meta WHERE post_id=?", id);
  const terms = await q<{ taxonomy: string; slug: string }>(db, "SELECT t.taxonomy,t.slug FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id=?", id);
  return json({ post, meta, terms });
}
export const revisionStatements = (db: D1Like, id: number, by: string, nowUtc: string, snap: string): D1Stmt[] => [
  db.prepare("INSERT INTO revisions(post_id,saved_at,saved_by,snapshot) VALUES(?,?,?,?)").bind(id, nowUtc, by, snap),
  db.prepare("DELETE FROM revisions WHERE post_id=? AND id NOT IN (SELECT id FROM revisions WHERE post_id=? ORDER BY id DESC LIMIT ?)").bind(id, id, REVISION_LIMIT),
];

export async function updatePost(db: D1Like, id: number, p: CleanPost, by: string, nowUtc: string): Promise<{ modified_at: string }> {
  const cur = await getAdminPost(db, id);
  if (!cur) throw new HttpError(404, "not found");
  if (cur.type !== p.type) throw new HttpError(400, "type cannot be changed");
  if (p.expected_modified_at !== undefined && p.expected_modified_at !== cur.modified_at) throw new HttpError(409, "conflict: the post was modified elsewhere");
  if (await slugTaken(db, p.type, p.slug, id)) throw new HttpError(409, "slug exists");
  await assertTerms(db, p.terms);
  const tax = allowedTaxonomies(p.type);
  const keys = editableMetaKeys(p.type);
  const stmts: D1Stmt[] = [
    ...revisionStatements(db, id, by, nowUtc, await snapshot(db, id)),
    db.prepare(`UPDATE posts SET slug=?,status=?,title=?,excerpt=?,content=?,title_en=?,excerpt_en=?,content_en=?,thumbnail=?,published_at=?,modified_at=? WHERE id=?`)
      .bind(p.slug, p.status, p.title, p.excerpt || null, p.content || null, p.title_en || null, p.excerpt_en || null, p.content_en || null, p.thumbnail, p.published_at ?? cur.published_at, nowUtc, id),
    db.prepare(`DELETE FROM post_meta WHERE post_id=? AND key IN (${ph(keys.length)})`).bind(id, ...keys),
    ...metaStatements(db, id, p.type, p.slug, p.meta),
    ...(tax.length ? [db.prepare(`DELETE FROM post_terms WHERE post_id=? AND term_id IN (SELECT id FROM terms WHERE taxonomy IN (${ph(tax.length)}))`).bind(id, ...tax)] : []),
    ...termStatements(db, id, p.type, p.slug, p.terms),
  ];
  try { await db.batch(stmts); } catch (e) { if (/UNIQUE/i.test(String(e))) throw new HttpError(409, "slug exists"); throw e; }
  return { modified_at: nowUtc };
}

export async function setStatus(db: D1Like, id: number, status: PostStatus, by: string, nowUtc: string): Promise<void> {
  const cur = await one<{ id: number }>(db, "SELECT id FROM posts WHERE id=?", id);
  if (!cur) throw new HttpError(404, "not found");
  await db.batch([
    ...revisionStatements(db, id, by, nowUtc, await snapshot(db, id)),
    db.prepare("UPDATE posts SET status=?, modified_at=? WHERE id=?").bind(status, nowUtc, id),
  ]);
}

export const listRevisions = (db: D1Like, id: number) =>
  q<{ id: number; saved_at: string; saved_by: string }>(db, "SELECT id,saved_at,saved_by FROM revisions WHERE post_id=? ORDER BY id DESC", id);

export async function restoreRevision(db: D1Like, id: number, revId: number, by: string, nowUtc: string): Promise<void> {
  const rev = await one<{ snapshot: string }>(db, "SELECT snapshot FROM revisions WHERE id=? AND post_id=?", revId, id);
  if (!rev) throw new HttpError(404, "revision not found");
  if (!(await one(db, "SELECT 1 x FROM posts WHERE id=?", id))) throw new HttpError(404, "not found");
  const s = JSON.parse(rev.snapshot) as { post: PostRowDb; meta: { key: string; value: string }[]; terms: { taxonomy: string; slug: string }[] };
  if (await slugTaken(db, s.post.type, s.post.slug, id)) throw new HttpError(409, "slug exists");
  const p = s.post;
  await db.batch([
    ...revisionStatements(db, id, by, nowUtc, await snapshot(db, id)),
    db.prepare(`UPDATE posts SET slug=?,status=?,title=?,excerpt=?,content=?,title_en=?,excerpt_en=?,content_en=?,thumbnail=?,published_at=?,modified_at=? WHERE id=?`)
      .bind(p.slug, p.status, p.title, p.excerpt, p.content, p.title_en, p.excerpt_en, p.content_en, p.thumbnail, p.published_at, nowUtc, id),
    db.prepare("DELETE FROM post_meta WHERE post_id=?").bind(id),
    ...s.meta.map((m) => db.prepare("INSERT INTO post_meta(post_id,key,value) VALUES(?,?,?)").bind(id, m.key, m.value)),
    db.prepare("DELETE FROM post_terms WHERE post_id=?").bind(id),
    ...s.terms.map((t) => db.prepare("INSERT OR IGNORE INTO post_terms(post_id,term_id) SELECT ?, id FROM terms WHERE taxonomy=? AND slug=?").bind(id, t.taxonomy, t.slug)),
  ]);
}
