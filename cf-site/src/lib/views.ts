import type { D1Like } from "./d1.ts";
import { hashIp } from "./contact.ts";
import { ipBucket } from "./contact.ts";
import { isStagingHost } from "./seo.ts";
import { rateLimit, type KvLike } from "./ratelimit.ts";

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget|python|go-http|axios|node-fetch|okhttp|java\/|libwww|httpclient|scrapy|postman|insomnia|gptbot|claude|perplexity|ahrefs|semrush|mj12|dotbot|petalbot|yandex|baidu|duckduck|whatsapp|vkshare/i;

/** ボット・クローラー・HTTPライブラリ・空のUAは数えない */
export const isBot = (ua: string) => ua.trim().length < 8 || BOT_RE.test(ua);

export function shouldCountRequest(req: Request, host: string, env: { FORCE_VIEW_COUNT?: string }): boolean {
  if (req.method !== "GET") return false;
  const purpose = `${req.headers.get("Purpose") ?? ""} ${req.headers.get("Sec-Purpose") ?? ""} ${req.headers.get("X-Moz") ?? ""} ${req.headers.get("X-Purpose") ?? ""}`.toLowerCase();
  if (/prefetch|prerender|preview/.test(purpose)) return false;
  // 確認用ホスト（*.workers.dev / localhost）は数えない（本番と同じD1を共有するため、テスト閲覧でランキングを汚さない）
  return env.FORCE_VIEW_COUNT === "1" || !isStagingHost(host);
}

/**
 * 閲覧を1件加算。ランキング操作・水増し対策:
 *  - 重複判定は「IP(/64)＋記事」のみ（UAは使わない＝UAを変えても水増しできない）。同一IPの同一記事は30分に1回
 *  - 同一IPが1日に加算できる総数に上限（既定200）。KV障害時は数えない
 * 例外は投げない。UAはボット判定にだけ使う
 */
export async function recordView(i: { db: D1Like; kv: KvLike; postId: number; ip: string; ua: string; salt: string; maxPerIpPerDay?: number }): Promise<boolean> {
  try {
    if (isBot(i.ua)) return false;
    const visitor = await hashIp(ipBucket(i.ip), i.salt);
    if (!visitor) return false;
    const key = `view:${i.postId}:${visitor}`;
    if (await i.kv.get(key)) return false;
    if (!(await rateLimit(i.kv, `viewcap:${visitor}`, i.maxPerIpPerDay ?? 200, 86400, Date.now(), { failOpen: false })).allowed) return false;
    await i.kv.put(key, "1", { expirationTtl: 1800 });
    await i.db.prepare("INSERT INTO views(post_id,count) VALUES(?,1) ON CONFLICT(post_id) DO UPDATE SET count=count+1").bind(i.postId).run();
    return true;
  } catch {
    return false;
  }
}
