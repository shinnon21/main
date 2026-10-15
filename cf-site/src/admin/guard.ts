export const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

/**
 * リクエストパスの分類。ルーターが /admin に解決しうる綴り（%エンコード・連続スラッシュ・大文字・/en 付き）を
 * すべて検出する。デコードできないパスは fail closed で "admin" 扱い。
 *  - "admin"   : 認証必須（Access JWT）
 *  - "blocked" : /en/admin… は存在しない（言語書き換えで管理画面に到達させない）→ 404
 *  - "public"  : 公開サイト
 */
export function classifyPath(pathname: string): "admin" | "blocked" | "public" {
  let p: string;
  try { p = decodeURIComponent(pathname); } catch { return "admin"; }
  p = p.replace(/\/{2,}/g, "/").toLowerCase();
  if (/^\/(?:\.\.?\/)*admin(?:\/|$)/.test(p)) return "admin";
  if (/^\/en\/(?:\.\.?\/)*admin(?:\/|$)/.test(p)) return "blocked";
  // 先頭が /admin%2F… のようにスラッシュを含む1セグメント（デコード後は /admin/…）は上の判定で捕捉済み
  return "public";
}

export function adminHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  out.headers.set("Cache-Control", "no-store");
  return out;
}

export const nowUtcMs = (d = new Date()) => d.toISOString().replace("T", " ").replace("Z", "");
