import type { D1Like } from "../lib/d1.ts";
import { SNS } from "../lib/sns.ts";
import { HttpError } from "./types.ts";

const bad = (m: string): never => { throw new HttpError(400, m); };
export const DEFAULT_NAME = "小林慎之助", DEFAULT_DESC = "構想を、社会に実装する。";
const SNS_KEYS = SNS.map((s) => s.key as string);

const get = async (db: D1Like, key: string): Promise<unknown> => {
  const r = await db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<{ value: string }>();
  try { return r ? JSON.parse(r.value) : undefined; } catch { return undefined; }
};

export async function readSettings(db: D1Like) {
  const name = await get(db, "blogname"), desc = await get(db, "blogdescription"), saved = await get(db, "sns_urls");
  const o = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {};
  const sns = Object.fromEntries(SNS.map((s) => [s.key, typeof o[s.key] === "string" ? (o[s.key] as string) : s.url]));
  return { blogname: typeof name === "string" && name ? name : DEFAULT_NAME, blogdescription: typeof desc === "string" && desc ? desc : DEFAULT_DESC, sns };
}

export function cleanSettings(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad("invalid body");
  const r = raw as Record<string, unknown>;
  if (typeof r.blogname !== "string" || !r.blogname.trim()) return bad("blogname is required");
  if (typeof r.blogdescription !== "string") return bad("blogdescription must be a string");
  const blogname = r.blogname.trim(), blogdescription = r.blogdescription.trim();
  if (blogname.length > 100) return bad("blogname is too long");
  if (blogdescription.length > 300) return bad("blogdescription is too long");
  if (!r.sns || typeof r.sns !== "object" || Array.isArray(r.sns)) return bad("sns must be an object");
  const sns: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.sns as Record<string, unknown>)) {
    if (!SNS_KEYS.includes(k)) return bad(`unknown sns key: ${k}`);
    if (typeof v !== "string") return bad(`${k} must be a string`);
    const u = v.trim();
    if (u) {
      if (u.length > 300) return bad(`${k} url is too long`);
      if (!/^https:\/\/[^\s<>"'\\]+$/i.test(u)) return bad(`${k} must be an https URL`);
      try { new URL(u); } catch { return bad(`${k} must be an https URL`); }
    }
    sns[k] = u;
  }
  return { blogname, blogdescription, sns };
}

export async function saveSettings(db: D1Like, c: ReturnType<typeof cleanSettings>): Promise<void> {
  const up = "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value";
  await db.batch([
    db.prepare(up).bind("blogname", JSON.stringify(c.blogname)),
    db.prepare(up).bind("blogdescription", JSON.stringify(c.blogdescription)),
    db.prepare(up).bind("sns_urls", JSON.stringify(c.sns)),
  ]);
}
