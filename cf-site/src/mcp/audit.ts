import type { D1Like } from "../lib/d1.ts";
import type { KvLike } from "../lib/ratelimit.ts";

export interface AuditRow { id: number; at: string; email: string; client: string; tool: string; target: string; ok: number }

/** 操作の記録（本文は保存しない）。記録の失敗でツール呼び出しを失敗させない */
export async function recordAudit(db: D1Like, r: { at: string; email: string; client: string; tool: string; target: string; ok: boolean }): Promise<void> {
  try {
    await db.prepare("INSERT INTO mcp_audit(at,email,client,tool,target,ok) VALUES(?,?,?,?,?,?)").bind(r.at, r.email, r.client.slice(0, 100), r.tool, r.target.slice(0, 200), r.ok ? 1 : 0).run();
  } catch { /* 監査の失敗は握りつぶす（ログはWorkerのconsoleに出る） */ }
}
export async function recentAudit(db: D1Like, n = 100): Promise<AuditRow[]> {
  return (await db.prepare("SELECT id,at,email,client,tool,target,ok FROM mcp_audit ORDER BY id DESC LIMIT ?").bind(n).all<AuditRow>()).results;
}

/**
 * 固定ウィンドウ。読み取り失敗は拒否（fail closed）、書き込み失敗は許可する（KVは同一キー1回/秒の書き込み制限があり、
 * Claudeの連続呼び出しで429になっても正常な利用を止めない）。KVは非アトミックなので厳密な上限ではない。
 */
async function windowAllowed(kv: KvLike, key: string, limit: number, windowSec: number, nowMs: number): Promise<boolean> {
  let n = 0, exp = nowMs + windowSec * 1000;
  try {
    const raw = await kv.get(`rl:${key}`);
    if (raw) { const [c, e] = raw.split("|").map(Number); if (e > nowMs) { n = c; exp = e; } }
  } catch { return false; }
  if (n >= limit) return false;
  try { await kv.put(`rl:${key}`, `${n + 1}|${exp}`, { expirationTtl: Math.max(60, Math.ceil((exp - nowMs) / 1000)) }); } catch { /* 書き込み失敗は許可 */ }
  return true;
}

/** 全体で1分60回、書き込み系は加えて1時間200回（ユーザー別） */
export async function mcpAllowed(kv: KvLike, email: string, isWrite: boolean, nowMs = Date.now()): Promise<boolean> {
  if (!(await windowAllowed(kv, `mcp:${email}:m`, 60, 60, nowMs))) return false;
  return !isWrite || windowAllowed(kv, `mcp:${email}:w`, 200, 3600, nowMs);
}
