import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { recentAudit, recordAudit, mcpAllowed } from "../src/mcp/audit.ts";

const kvOf = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { m.set(k, v); } }; };

test("audit rows store who/what/target/ok only (no body column), newest first, limited", async () => {
  const raw = newDb(); const db = d1(raw);
  for (let i = 0; i < 120; i++) await recordAudit(db, { at: `2026-10-15 00:00:${String(i % 60).padStart(2, "0")}`, email: "me@x", client: "Claude", tool: "update_post", target: `post:${i}`, ok: i % 2 === 0 });
  const rows = await recentAudit(db, 100);
  expect(rows).toHaveLength(100); expect(rows[0].target).toBe("post:119");
  expect(Object.keys(rows[0]).sort()).toEqual(["at", "client", "email", "id", "ok", "target", "tool"]);
});
test("audit failures never throw into the tool call", async () => {
  const bad = { prepare: () => { throw new Error("db down"); } } as any;
  await expect(recordAudit(bad, { at: "t", email: "e", client: "", tool: "x", target: "", ok: true })).resolves.toBeUndefined();
});
test("rate limit: 60 calls/min overall and 200 writes/hour, per user; KV failure denies", async () => {
  const kv = kvOf();
  for (let i = 0; i < 60; i++) expect(await mcpAllowed(kv, "me@x", false, 1000)).toBe(true);
  expect(await mcpAllowed(kv, "me@x", false, 1000)).toBe(false);
  expect(await mcpAllowed(kv, "other@x", false, 1000)).toBe(true);
  const kv2 = kvOf();
  let ok = 0; for (let i = 0; i < 300; i++) { if (await mcpAllowed(kv2, "w@x", true, 1000 + i * 2000)) ok++; }
  expect(ok).toBeLessThanOrEqual(200);
  const broken = { get: async () => { throw new Error("kv"); }, put: async () => { throw new Error("kv"); } };
  expect(await mcpAllowed(broken, "me@x", true, 1000)).toBe(false);
});
