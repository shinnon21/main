import type { D1Like } from "../lib/d1.ts";
import { MAX_BYTES, type R2Like, saveMedia } from "../admin/media.ts";
import { HttpError } from "../admin/types.ts";

const bad = (m: string): never => { throw new HttpError(400, m); };
const INTERNAL_SUFFIX = /\.(local|localhost|internal|localdomain|lan|home|corp|intranet)$/;
const MAX_REDIRECTS = 3;

/**
 * 取得してよいURLか検証する（SSRF対策の第1層）。https のみ・認証情報/ポート指定なし・IPリテラル全面禁止・内部名禁止。
 * 数値表記（10進/16進/8進）のIPはURLパーサーが正規化するので、ホスト名が数字とドットのみなら拒否すれば足りる。
 * 第2層として wrangler の global_fetch_strictly_public により Worker からの内部到達自体が遮断される。
 */
export function assertPublicHttpsUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { return bad("invalid url"); }
  if (u.protocol !== "https:") return bad("only https urls are allowed");
  if (u.username || u.password) return bad("urls with credentials are not allowed");
  if (u.port) return bad("urls with a port are not allowed");
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.startsWith("[") || /^[0-9.]+$/.test(host)) return bad("ip addresses are not allowed");
  if (!host.includes(".") || INTERNAL_SUFFIX.test(host)) return bad("internal hostnames are not allowed");
  return u;
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("Content-Length"));
  if (declared > MAX_BYTES) { await res.body?.cancel().catch(() => {}); throw new HttpError(413, "image too large (max 10MB)"); }
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) { await reader.cancel().catch(() => {}); throw new HttpError(413, "image too large (max 10MB)"); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export async function uploadMediaFromUrl(
  ctx: { db: D1Like; media: R2Like; email: string; nowUtc: string; fetcher?: typeof fetch; rand?: () => string },
  a: { url: string; alt?: string },
) {
  const doFetch = ctx.fetcher ?? fetch;
  let url = assertPublicHttpsUrl(a.url);
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    try { res = await doFetch(url.toString(), { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { Accept: "image/jpeg,image/png,image/gif,image/webp" } }); }
    catch { throw new HttpError(502, "could not fetch the image"); }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("Location");
      await res.body?.cancel().catch(() => {});
      if (!loc || hop === MAX_REDIRECTS) return bad("too many redirects");
      let next: string;
      try { next = new URL(loc, url).toString(); } catch { return bad("invalid redirect"); }
      url = assertPublicHttpsUrl(next);
      continue;
    }
    break;
  }
  if (!res || res.status !== 200) { await res?.body?.cancel().catch(() => {}); return bad(`image server returned ${res?.status ?? "no response"}`); }
  const bytes = await readCapped(res);
  let name = "image";
  try { name = decodeURIComponent(url.pathname.split("/").pop() || "") || "image"; } catch { /* 既定名 */ }
  const alt = (a.alt ?? "").trim();
  if (alt.length > 500) return bad("alt is too long");
  // 保存形式は先頭バイトで判定するため、配信元の Content-Type（image/jpg・octet-stream 等の不正確な値）は照合に使わない
  return saveMedia(ctx, bytes, "", name, alt);
}
