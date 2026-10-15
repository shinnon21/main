import type { D1Like } from "../lib/d1.ts";
import { type KvLike, rateLimit } from "../lib/ratelimit.ts";

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

/** 全体で1分60回、書き込み系は加えて1時間200回（ユーザー別）。KV障害時は拒否（fail closed）。KVは非アトミックなので厳密な上限ではない */
export async function mcpAllowed(kv: KvLike, email: string, isWrite: boolean, nowMs = Date.now()): Promise<boolean> {
  const all = await rateLimit(kv, `mcp:${email}:m`, 60, 60, nowMs, { failOpen: false });
  if (!all.allowed) return false;
  if (!isWrite) return true;
  return (await rateLimit(kv, `mcp:${email}:w`, 200, 3600, nowMs, { failOpen: false })).allowed;
}
