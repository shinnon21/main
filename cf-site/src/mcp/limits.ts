/** 認証なしで到達できるエンドポイント（動的クライアント登録）への巨大ボディを、ライブラリに渡す前に拒否する。小さければ読み直せるRequestを返す */
export async function capBody(req: Request, max: number): Promise<Request | Response> {
  const declared = Number(req.headers.get("Content-Length"));
  if (declared > max) return new Response("Payload Too Large", { status: 413 });
  if (!req.body) return req;
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel().catch(() => {}); return new Response("Payload Too Large", { status: 413 }); }
    chunks.push(value);
  }
  const all = new Uint8Array(total); let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  return new Request(req, { body: all });
}

interface Kv { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> }
/**
 * 動的クライアント登録の1日あたり総数の上限（UTC日）。上限到達後はKVに一切書き込まない＝大量に叩かれても書き込みは上限件数で止まる。
 * IP別のレート制限（Cloudflare WAF）の補強。読み取り失敗は拒否。
 */
export async function registrationAllowed(kv: Kv, nowMs: number, cap: number): Promise<boolean> {
  const key = `mcp:reg:${new Date(nowMs).toISOString().slice(0, 10)}`;
  let n: number;
  try { n = Number((await kv.get(key)) ?? 0) || 0; } catch { return false; }
  if (n >= cap) return false;
  try { await kv.put(key, String(n + 1), { expirationTtl: 2 * 24 * 3600 }); } catch { /* 書き込み失敗でも登録自体は通す */ }
  return true;
}
