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
