import type { D1Like } from "../lib/d1.ts";
import { revisionStatements, snapshot } from "./store.ts";
import { HttpError } from "./types.ts";

const bad = (m: string): never => { throw new HttpError(400, m); };

/** 管理画面で編集する項目（JA）と最大文字数。`_en` 付きが英語版 */
const BASE: [string, number][] = [
  ["profile_kana", 200], ["profile_name", 200], ["profile_role", 500],
  ["profile_bio", 20000], ["profile_career", 20000], ["profile_skills", 20000],
  ["profile_research_title", 500], ["profile_research_body", 20000], ["profile_activities", 20000],
];
const LIMITS = new Map(BASE.flatMap(([k, n]) => [[k, n], [`${k}_en`, n]] as [string, number][]));
export const PROFILE_KEYS = [...LIMITS.keys()];

const page = (db: D1Like) => db.prepare("SELECT id,thumbnail FROM posts WHERE type='page' AND slug='profile'").bind().first<{ id: number; thumbnail: string | null }>();

export async function readProfile(db: D1Like) {
  const p = await page(db);
  if (!p) throw new HttpError(404, "profile page not found");
  const rows = (await db.prepare("SELECT key,value FROM post_meta WHERE post_id=? AND key LIKE 'profile\\_%' ESCAPE '\\'").bind(p.id).all<{ key: string; value: string }>()).results;
  const fields: Record<string, string> = Object.fromEntries(PROFILE_KEYS.map((k) => [k, ""]));
  for (const r of rows) if (LIMITS.has(r.key)) { try { const v = JSON.parse(r.value); if (typeof v === "string") fields[r.key] = v; } catch { /* 壊れた値は空扱い */ } }
  return { fields, thumbnail: p.thumbnail };
}

export function cleanProfile(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad("invalid body");
  const r = raw as Record<string, unknown>;
  if (!r.fields || typeof r.fields !== "object" || Array.isArray(r.fields)) return bad("fields must be an object");
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.fields as Record<string, unknown>)) {
    const max = LIMITS.get(k);
    if (max === undefined) return bad(`unknown field: ${k}`);
    if (typeof v !== "string") return bad(`${k} must be a string`);
    const t = v.replace(/\r\n?/g, "\n").trim();
    if (t.length > max) return bad(`${k} is too long`);
    fields[k] = t;
  }
  let thumbnail: string | null | undefined;
  if (r.thumbnail !== undefined) {
    if (r.thumbnail !== null && typeof r.thumbnail !== "string") return bad("invalid thumbnail");
    const t = ((r.thumbnail as string | null) ?? "").trim();
    if (t && (t.length > 500 || t.startsWith("/") || t.split("/").includes("..") || t.includes("\0"))) return bad("invalid thumbnail");
    thumbnail = t || null;
  }
  return { fields, thumbnail };
}

/** 送られたキーだけを置き換える（空文字は削除＝既定値へフォールバック）。保存前に必ずリビジョンを残す */
export async function saveProfile(db: D1Like, c: ReturnType<typeof cleanProfile>, by: string, nowUtc: string): Promise<void> {
  const p = await page(db);
  if (!p) throw new HttpError(404, "profile page not found");
  const keys = Object.keys(c.fields);
  await db.batch([
    ...revisionStatements(db, p.id, by, nowUtc, await snapshot(db, p.id)),
    ...(keys.length ? [db.prepare(`DELETE FROM post_meta WHERE post_id=? AND key IN (${keys.map(() => "?").join(",")})`).bind(p.id, ...keys)] : []),
    ...keys.filter((k) => c.fields[k]).map((k) => db.prepare("INSERT INTO post_meta(post_id,key,value) VALUES(?,?,?)").bind(p.id, k, JSON.stringify(c.fields[k]))),
    db.prepare(c.thumbnail === undefined ? "UPDATE posts SET modified_at=? WHERE id=?" : "UPDATE posts SET modified_at=?,thumbnail=? WHERE id=?")
      .bind(...(c.thumbnail === undefined ? [nowUtc, p.id] : [nowUtc, c.thumbnail, p.id])),
  ]);
}
