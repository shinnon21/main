export const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

type Kind = "admin" | "blocked" | "public";

/**
 * パスの分類。ルーターが /admin に解決しうる綴り（%エンコードの多重化・連続スラッグ・大文字・/en 付き・ドットセグメント）を検出する。
 *  - "admin"   : 認証必須（Access JWT）
 *  - "blocked" : 存在させない（/en/admin… と、デコード後にドットセグメント `.`/`..` を含むパス）→ 404
 *  - "public"  : 公開サイト
 * デコードできない・多重エンコードが収束しないパスは fail closed で "admin"。
 */
export function classifyPath(pathname: string): Kind {
  let p = pathname;
  for (let i = 0; ; i++) {
    let d: string;
    try { d = decodeURIComponent(p); } catch { return "admin"; }
    if (d === p) break;
    if (i >= 5) return "admin";
    p = d;
  }
  p = p.replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase();
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(p)) return "blocked";
  if (/^\/admin(?:\/|$)/.test(p)) return "admin";
  if (/^\/en\/admin(?:\/|$)/.test(p)) return "blocked";
  return "public";
}

/** ミドルウェアが見るURL（ドットセグメント解決済み）と、ルーターが見る生のパスの両方を分類し、厳しい方を採用する */
export function classifyRequest(url: string): Kind {
  const raw = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, "").split(/[?#]/)[0] || "/";
  let resolved = raw;
  try { resolved = new URL(url).pathname; } catch { /* keep raw */ }
  const a = classifyPath(raw), b = classifyPath(resolved);
  return a === "blocked" || b === "blocked" ? "blocked" : a === "admin" || b === "admin" ? "admin" : "public";
}

export function adminHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  out.headers.set("Cache-Control", "no-store");
  return out;
}

export const nowUtcMs = (d = new Date()) => d.toISOString().replace("T", " ").replace("Z", "");
