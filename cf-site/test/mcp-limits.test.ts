import { expect, test } from "vitest";
import { capBody } from "../src/mcp/limits.ts";

const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request("https://x.test/oauth/register", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });

test("capBody passes a small body through unchanged (the returned request can still be read)", async () => {
  const r = await capBody(post(JSON.stringify({ client_name: "c" })), 8192);
  expect(r instanceof Request).toBe(true); expect(await (r as Request).json()).toEqual({ client_name: "c" });
});
test("capBody refuses an oversize body with 413 — by Content-Length and by streamed bytes (chunked / lying header)", async () => {
  const big = "x".repeat(9000);
  expect(((await capBody(post(big, { "Content-Length": "9000" }), 8192)) as Response).status).toBe(413);
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
  const chunked = new Request("https://x.test/oauth/register", { method: "POST", body: stream, duplex: "half" } as any);
  expect(((await capBody(chunked, 8192)) as Response).status).toBe(413);
});

import { registrationAllowed } from "../src/mcp/limits.ts";
const kvOf = () => { const m = new Map<string, string>(); let writes = 0; return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { writes++; m.set(k, v); }, writes: () => writes }; };

test("registrationAllowed: at most N registrations per UTC day; once the cap is hit it stops writing to KV entirely", async () => {
  const kv = kvOf(); const day = Date.UTC(2026, 9, 15, 3);
  for (let i = 0; i < 20; i++) expect(await registrationAllowed(kv, day, 20)).toBe(true);
  const writesAtCap = kv.writes();
  for (let i = 0; i < 500; i++) expect(await registrationAllowed(kv, day, 20)).toBe(false);
  expect(kv.writes()).toBe(writesAtCap);
  expect(await registrationAllowed(kv, day + 24 * 3600 * 1000, 20)).toBe(true); // 翌日は再び許可
});
test("registrationAllowed fails closed when KV cannot be read", async () => {
  expect(await registrationAllowed({ get: async () => { throw new Error("kv"); }, put: async () => {} }, Date.now(), 20)).toBe(false);
});
