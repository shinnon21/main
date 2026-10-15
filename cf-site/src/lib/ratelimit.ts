export interface KvLike { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> }

/** 固定ウィンドウのレート制限（KV）。ブロックされたリクエストはカウントしない。KV障害時は fail open（インフラ障害で正規ユーザーを締め出さない） */
export async function rateLimit(kv: KvLike, key: string, limit: number, windowSec: number, nowMs = Date.now()): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const raw = await kv.get(`rl:${key}`);
    let n = 0, exp = nowMs + windowSec * 1000;
    if (raw) { const [c, e] = raw.split("|").map(Number); if (e > nowMs) { n = c; exp = e; } }
    if (n >= limit) return { allowed: false, remaining: 0 };
    await kv.put(`rl:${key}`, `${n + 1}|${exp}`, { expirationTtl: Math.max(60, Math.ceil((exp - nowMs) / 1000)) });
    return { allowed: true, remaining: limit - n - 1 };
  } catch {
    return { allowed: true, remaining: limit };
  }
}
