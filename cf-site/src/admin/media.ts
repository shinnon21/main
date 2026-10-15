import type { D1Like } from "../lib/d1.ts";
import { toJst } from "../lib/format.ts";
import { HttpError } from "./types.ts";

export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type ImageType = (typeof ALLOWED_TYPES)[number];

const at = (b: Uint8Array, sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);
const ascii = (b: Uint8Array, off: number, s: string) => [...s].every((c, i) => b[off + i] === c.charCodeAt(0));

/** 先頭バイトだけで画像形式を判定する（拡張子・申告されたContent-Typeは信用しない）。SVG/HTMLは常にnull */
export function detectImageType(b: Uint8Array): ImageType | null {
  if (b.length < 12) return null;
  if (at(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a")) return "image/gif";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  return null;
}

const EXT: Record<ImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };

/** R2キー: YYYY/MM/<ascii名>-<ランダム>.<判定した形式の拡張子>。元のファイル名のパス成分・拡張子は使わない */
export function makeKey(filename: string, type: ImageType, now: Date, rand: string): string {
  const stem = filename.replace(/\.[A-Za-z0-9]{1,5}$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "") || "image";
  const j = toJst(now.toISOString());
  const mm = String(j.getUTCMonth() + 1).padStart(2, "0");
  return `${j.getUTCFullYear()}/${mm}/${stem}-${rand}.${EXT[type]}`;
}

export function validateUpload(bytes: Uint8Array, claimedType?: string): { type: ImageType } {
  if (bytes.length === 0) throw new HttpError(400, "empty file");
  if (bytes.length > MAX_BYTES) throw new HttpError(413, "file too large (max 10MB)");
  const type = detectImageType(bytes);
  if (!type) throw new HttpError(415, "unsupported file type (JPEG, PNG, GIF, WebP only)");
  const claimed = (claimedType ?? "").split(";")[0].trim().toLowerCase();
  if (claimed && claimed !== "application/octet-stream" && claimed !== type) throw new HttpError(415, "file content does not match its declared type");
  return { type };
}

export interface MediaRow { id: number; key: string; content_type: string; size: number; alt: string; uploaded_at: string; uploaded_by: string }
const like = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function insertMedia(db: D1Like, m: { key: string; content_type: string; size: number; uploaded_by: string; now: string; alt?: string }): Promise<{ id: number }> {
  try {
    const r = await db.prepare("INSERT INTO media(key,content_type,size,alt,uploaded_at,uploaded_by) VALUES(?,?,?,?,?,?)").bind(m.key, m.content_type, m.size, m.alt ?? "", m.now, m.uploaded_by).run();
    return { id: r.meta.last_row_id };
  } catch (e) {
    if (/UNIQUE/i.test(String(e))) throw new HttpError(409, "media key exists");
    throw e;
  }
}
export async function listMedia(db: D1Like, f: { q?: string; limit?: number; offset?: number }): Promise<MediaRow[]> {
  const where = f.q ? "WHERE key LIKE ? ESCAPE '\\' OR alt LIKE ? ESCAPE '\\'" : "";
  const args: unknown[] = f.q ? [`%${like(f.q)}%`, `%${like(f.q)}%`] : [];
  return (await db.prepare(`SELECT * FROM media ${where} ORDER BY uploaded_at DESC, id DESC LIMIT ? OFFSET ?`).bind(...args, f.limit ?? 60, f.offset ?? 0).all<MediaRow>()).results;
}
export const getMedia = (db: D1Like, id: number) => db.prepare("SELECT * FROM media WHERE id=?").bind(id).first<MediaRow>();
export async function setAlt(db: D1Like, id: number, alt: string): Promise<void> {
  if (alt.length > 500) throw new HttpError(400, "alt is too long");
  const r = await db.prepare("UPDATE media SET alt=? WHERE id=?").bind(alt.trim(), id).run();
  if (!r.meta.changes) throw new HttpError(404, "not found");
}
export async function deleteMediaRow(db: D1Like, id: number): Promise<void> {
  await db.prepare("DELETE FROM media WHERE id=?").bind(id).run();
}

/** このメディアを参照している記事（アイキャッチ・本文・英語本文・メタ）。削除前チェックに使う */
export async function findUsage(db: D1Like, key: string): Promise<{ id: number; type: string; title: string }[]> {
  const pat = `%/media/${like(key)}%`;
  return (await db.prepare(
    `SELECT id,type,title FROM posts WHERE thumbnail=? OR content LIKE ? ESCAPE '\\' OR content_en LIKE ? ESCAPE '\\'
     UNION SELECT p.id,p.type,p.title FROM post_meta m JOIN posts p ON p.id=m.post_id WHERE m.value LIKE ? ESCAPE '\\'`,
  ).bind(key, pat, pat, pat).all<{ id: number; type: string; title: string }>()).results;
}

export interface R2Like {
  put(key: string, body: ArrayBuffer | Uint8Array, opts: { httpMetadata: { contentType: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
}
const rand6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join("");

/** 検証→D1でキー確保→R2へ書き込み。衝突時は別サフィックスで再試行し、R2失敗時はD1行を取り消す（管理画面アップロードとMCPで共用） */
export async function saveMedia(
  ctx: { db: D1Like; media: R2Like; email: string; nowUtc: string; rand?: () => string },
  bytes: Uint8Array, claimedType: string, name: string,
): Promise<{ id: number; key: string; url: string; alt: string; content_type: string; size: number }> {
  const { type } = validateUpload(bytes, claimedType);
  const nextRand = ctx.rand ?? rand6;
  for (let attempt = 0; attempt < 3; attempt++) {
    const key = makeKey(name, type, new Date(), nextRand());
    let newId: number;
    try { ({ id: newId } = await insertMedia(ctx.db, { key, content_type: type, size: bytes.length, uploaded_by: ctx.email, now: ctx.nowUtc })); }
    catch (e) { if (e instanceof HttpError && e.status === 409) continue; throw e; }
    try { await ctx.media.put(key, bytes, { httpMetadata: { contentType: type } }); }
    catch (e) { await deleteMediaRow(ctx.db, newId).catch(() => {}); throw e; }
    return { id: newId, key, url: `/media/${key}`, alt: "", content_type: type, size: bytes.length };
  }
  throw new HttpError(409, "could not allocate a unique media key");
}
