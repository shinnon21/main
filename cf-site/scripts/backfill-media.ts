// usage: node scripts/backfill-media.ts <export.json> [uploadsDir] > data/backfill-media.sql
// WordPressから移行済みの画像を media テーブル（メディアライブラリ）へ登録する。何度実行しても安全（INSERT OR IGNORE）
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { mediaKey, originalsOnly, sniffContentType } from "./lib/media.ts";
import type { WpAttachment, WpExport } from "./lib/types.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };

export function buildBackfillSql(attachments: WpAttachment[], readFile: (key: string) => { bytes: Uint8Array; size: number } | null, now: string): string[] {
  const keys = originalsOnly(attachments.map((a) => a.path).filter(Boolean));
  const out: string[] = [];
  for (const path of keys) {
    let key: string;
    try { key = mediaKey(path); } catch { continue; }
    const f = readFile(key);
    const type = f ? sniffContentType(f.bytes, key) : EXT[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
    out.push(`INSERT OR IGNORE INTO media(key,content_type,size,alt,uploaded_at,uploaded_by) VALUES(${q(key)},${q(type)},${f?.size ?? 0},'',${q(now)},'wp-import');`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exp: WpExport = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const dir = process.argv[3] ?? "data/uploads";
  const sql = buildBackfillSql(exp.attachments, (key) => {
    const p = join(dir, key);
    return existsSync(p) ? { bytes: new Uint8Array(readFileSync(p)), size: statSync(p).size } : null;
  }, new Date().toISOString().replace("T", " ").slice(0, 19));
  process.stdout.write(sql.join("\n") + "\n");
}
