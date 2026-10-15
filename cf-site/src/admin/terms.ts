import type { D1Like } from "../lib/d1.ts";
import { HttpError } from "./types.ts";
import { validateSlug } from "./validate.ts";

export const TERM_TAXONOMIES = ["works_type", "industry", "skill", "news_type"];

const bad = (m: string): never => { throw new HttpError(400, m); };
const name = (v: unknown): string => {
  if (typeof v !== "string") return bad("name is required");
  const t = v.trim();
  if (!t) return bad("name is required");
  if (t.length > 100) return bad("name is too long");
  return t;
};

/** 名前からURL用スラッグを作る（日本語は保持・ASCIIは小文字・空白はハイフン・URL予約文字は除去） */
export function termSlugFromName(n: string): string {
  const s = n.trim().toLowerCase().replace(/\s+/g, "-").replace(/[/?#%\\]/g, "").replace(/^-+|-+$/g, "");
  return s || `term-${Date.now().toString(36)}`;
}

export async function listTerms(db: D1Like) {
  return (await db.prepare(
    "SELECT t.id,t.taxonomy,t.slug,t.name,(SELECT COUNT(*) FROM post_terms pt WHERE pt.term_id=t.id) AS uses FROM terms t ORDER BY t.taxonomy,t.id",
  ).bind().all()).results;
}

export async function createTerm(db: D1Like, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad("invalid body");
  const r = raw as Record<string, unknown>;
  if (typeof r.taxonomy !== "string" || !TERM_TAXONOMIES.includes(r.taxonomy)) return bad("invalid taxonomy");
  const n = name(r.name);
  const slug = r.slug === undefined || r.slug === "" ? termSlugFromName(n) : typeof r.slug === "string" ? r.slug.trim() : bad("slug must be a string");
  const err = validateSlug(slug);
  if (err) return bad(err);
  if (await db.prepare("SELECT 1 x FROM terms WHERE taxonomy=? AND slug=?").bind(r.taxonomy, slug).first()) throw new HttpError(409, "slug already exists");
  await db.prepare("INSERT INTO terms(taxonomy,slug,name) VALUES(?,?,?)").bind(r.taxonomy, slug, n).run();
  const row = await db.prepare("SELECT id,taxonomy,slug,name FROM terms WHERE taxonomy=? AND slug=?").bind(r.taxonomy, slug).first();
  return row as { id: number; taxonomy: string; slug: string; name: string };
}

/** 名前のみ変更可（スラッグは既存URLを壊さないため不変） */
export async function renameTerm(db: D1Like, id: number, raw: unknown): Promise<void> {
  const n = name((raw as { name?: unknown } | null)?.name);
  if (!(await db.prepare("SELECT 1 x FROM terms WHERE id=?").bind(id).first())) throw new HttpError(404, "not found");
  await db.prepare("UPDATE terms SET name=? WHERE id=?").bind(n, id).run();
}

/** 使用中なら削除せず件数を返す */
export async function deleteTerm(db: D1Like, id: number): Promise<{ ok: true } | { inUse: number }> {
  if (!(await db.prepare("SELECT 1 x FROM terms WHERE id=?").bind(id).first())) throw new HttpError(404, "not found");
  const c = (await db.prepare("SELECT COUNT(*) c FROM post_terms WHERE term_id=?").bind(id).first<{ c: number }>())?.c ?? 0;
  if (c > 0) return { inUse: c };
  await db.prepare("DELETE FROM terms WHERE id=?").bind(id).run();
  return { ok: true };
}
