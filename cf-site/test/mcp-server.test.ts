import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { TOOL_DEFS, mcpHttp } from "../src/mcp/server.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3]);
function setup(over: Record<string, unknown> = {}) {
  const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s);
  const store = new Map<string, string>();
  const kv = { get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => { store.set(k, v); } };
  const puts: string[] = [];
  const deps = { db: d1(raw), media: { put: async (k: string) => { puts.push(k); }, delete: async () => {} }, kv, email: "me@x", client: "Claude", now: () => "2026-10-15 00:00:00",
    fetcher: (async () => new Response(png, { headers: { "Content-Type": "image/png" } })) as typeof fetch, ...over };
  return { raw, deps, puts, store };
}
const post = (s: ReturnType<typeof setup>, body: unknown, headers: Record<string, string> = {}) =>
  mcpHttp(new Request("https://x.test/mcp", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), s.deps as any);
const rpc = async (s: ReturnType<typeof setup>, method: string, params?: unknown, id: number | undefined = 1) => (await post(s, { jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), method, params })).json() as Promise<any>;
const call = (s: ReturnType<typeof setup>, name: string, args: unknown) => rpc(s, "tools/call", { name, arguments: args });
const text = (r: any) => r.result.content[0].text as string;

test("exposes exactly the seven tools — no publish/delete/settings/contacts tool exists", () => {
  expect(TOOL_DEFS.map((t) => t.name).sort()).toEqual(["create_post", "create_term", "get_post", "list_posts", "list_terms", "update_post", "upload_media_from_url"]);
});
test("initialize negotiates the protocol version and advertises only tools", async () => {
  const s = setup(); const r = await rpc(s, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  expect(r.result.protocolVersion).toBe("2025-03-26"); expect(Object.keys(r.result.capabilities)).toEqual(["tools"]); expect(r.result.serverInfo.name).toBe("kobayashi-hp");
  expect((await rpc(s, "initialize", { protocolVersion: "1999-01-01" })).result.protocolVersion).toBe("2025-06-18");
});
test("tools/list returns JSON Schemas; create/update schemas have no status/published_at property and are strict", async () => {
  const s = setup(); const r = await rpc(s, "tools/list");
  expect(r.result.tools).toHaveLength(7);
  for (const t of r.result.tools) expect(t.inputSchema.type).toBe("object");
  for (const n of ["create_post", "update_post"]) { const t = r.result.tools.find((x: any) => x.name === n); expect(Object.keys(t.inputSchema.properties)).not.toContain("status"); expect(Object.keys(t.inputSchema.properties)).not.toContain("published_at"); expect(t.inputSchema.additionalProperties).toBe(false); }
});
test("create_post makes a draft and writes an audit row; passing status is rejected without creating anything", async () => {
  const s = setup();
  const ok = await call(s, "create_post", { type: "column", title: "下書き" });
  expect(ok.result.isError).toBeFalsy(); const { id } = JSON.parse(text(ok));
  expect(s.raw.prepare("select status from posts where id=?").get(id)).toEqual({ status: "draft" });
  const before = (s.raw.prepare("select count(*) c from posts").get() as any).c;
  const bad = await call(s, "create_post", { type: "column", title: "x", status: "publish" });
  expect(bad.result.isError).toBe(true); expect((s.raw.prepare("select count(*) c from posts").get() as any).c).toBe(before);
  const audit = s.raw.prepare("select email,client,tool,ok from mcp_audit order by id").all() as any[];
  expect(audit[0]).toEqual({ email: "me@x", client: "Claude", tool: "create_post", ok: 1 }); expect(audit[1].ok).toBe(0);
});
test("update_post keeps the post's status, and tool errors surface as isError with the HTTP status", async () => {
  const s = setup(); const id = (s.raw.prepare("select id from posts where slug='site-a'").get() as any).id;
  const cur = JSON.parse(text(await call(s, "get_post", { id })));
  expect((await call(s, "update_post", { id, expected_modified_at: cur.modified_at, title: "新" })).result.isError).toBeFalsy();
  expect(s.raw.prepare("select status,title from posts where id=?").get(id)).toEqual({ status: "publish", title: "新" });
  const stale = await call(s, "update_post", { id, expected_modified_at: "1999-01-01 00:00:00", title: "x" });
  expect(stale.result.isError).toBe(true); expect(text(stale)).toMatch(/409/);
});
test("upload_media_from_url uses the SSRF-guarded fetcher and registers the image", async () => {
  const s = setup(); const r = await call(s, "upload_media_from_url", { url: "https://example.com/p.png", alt: "a" });
  expect(r.result.isError).toBeFalsy(); expect(JSON.parse(text(r)).url).toMatch(/^\/media\//); expect(s.puts).toHaveLength(1);
  const internal = await call(s, "upload_media_from_url", { url: "https://169.254.169.254/x" }); expect(internal.result.isError).toBe(true);
});
test("protocol errors: unknown tool/method, bad JSON, wrong content-type, GET, oversize, notification", async () => {
  const s = setup();
  expect((await call(s, "nope", {})).error.code).toBe(-32602);
  expect((await rpc(s, "bogus/method")).error.code).toBe(-32601);
  expect((await (await post(s, "{not json")).json() as any).error.code).toBe(-32700);
  expect((await mcpHttp(new Request("https://x.test/mcp", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" }), s.deps as any)).status).toBe(415);
  expect((await mcpHttp(new Request("https://x.test/mcp", { method: "GET" }), s.deps as any)).status).toBe(405);
  expect((await post(s, "x".repeat(4 * 1024 * 1024))).status).toBe(413);
  expect((await post(s, { jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
  expect((await post(s, [{ jsonrpc: "2.0", id: 1, method: "ping" }])).status).toBe(400);
});
test("rate limit: the 61st call within a minute is refused as a tool error and not executed", async () => {
  const s = setup();
  for (let i = 0; i < 60; i++) await call(s, "list_terms", {});
  const r = await call(s, "create_post", { type: "column", title: "limited" });
  expect(r.result.isError).toBe(true); expect(text(r)).toMatch(/rate limit/i);
  expect(s.raw.prepare("select count(*) c from posts where title='limited'").get()).toEqual({ c: 0 });
});
