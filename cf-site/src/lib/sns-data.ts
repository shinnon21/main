import type { D1Like } from "./d1.ts";
import { SNS } from "./sns.ts";

export type SnsItem = (typeof SNS)[number];

/** 管理画面で保存した `settings.sns_urls`（{キー: URL}）を既定値に重ねる。保存済みキーは空文字でも優先＝非表示。壊れたJSONは既定値のまま */
export async function resolveSns(db: D1Like): Promise<SnsItem[]> {
  let o: Record<string, unknown> = {};
  try {
    const r = await db.prepare("SELECT value FROM settings WHERE key='sns_urls'").bind().first<{ value: string }>();
    const p = r ? JSON.parse(r.value) : null;
    if (p && typeof p === "object" && !Array.isArray(p)) o = p;
  } catch { /* 既定値を使う */ }
  return SNS.map((s) => (typeof o[s.key] === "string" ? { ...s, url: o[s.key] as string } : s)).filter((s) => s.url);
}
