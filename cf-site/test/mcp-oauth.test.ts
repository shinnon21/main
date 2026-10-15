import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { handleAuthorize, handleGrantsApi, isMcpAdmin, mcpEndpoint } from "../src/mcp/oauth.ts";

const L = "http://localhost:4321";
function provider() {
  const calls: Record<string, unknown[]> = { complete: [], approve: [], deny: [], revoke: [] };
  return { calls, p: {
    parseAuthRequest: async () => ({ clientId: "c1", redirectUri: "https://claude.ai/cb", scope: ["cms"], state: "s", responseType: "code" }),
    describeConsent: async () => ({ clientId: "c1", clientName: `<img src=x onerror=alert(1)>Claude`, redirectUri: "https://claude.ai/cb", redirectHost: "claude.ai", redirectIsLoopback: false }),
    beginConsent: async () => ({ handle: "H123", headers: new Headers({ "Set-Cookie": "bind=1; HttpOnly" }) }),
    approveConsent: async (_r: Request, h: string, o: unknown) => { calls.approve.push([h, o]); return { request: { clientId: "c1", state: "s" }, headers: new Headers({ "Set-Cookie": "bind=; Max-Age=0" }) }; },
    denyConsent: async (_r: Request, h: string) => { calls.deny.push(h); return { redirectTo: "https://claude.ai/cb?error=access_denied", headers: new Headers({ "Set-Cookie": "bind=; Max-Age=0" }) }; },
    completeAuthorization: async (o: unknown) => { calls.complete.push(o); return { redirectTo: "https://claude.ai/cb?code=abc" }; },
    listUserGrants: async () => ({ items: [{ id: "g1", clientId: "c1", userId: "dev", scope: ["cms"], metadata: { clientName: "Claude" }, createdAt: 1 }] }),
    revokeGrant: async (id: string, user: string) => { calls.revoke.push([id, user]); },
  } };
}
const env = (over: Record<string, unknown> = {}) => ({ DEV_ADMIN_EMAIL: "dev", ADMIN_EMAILS: "dev", ...over });
const get = (path: string) => new Request(L + path);
const form = (path: string, fields: Record<string, string>, headers: Record<string, string> = { Origin: L }) =>
  new Request(L + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams(fields).toString() });

test("isMcpAdmin requires a non-empty allow list containing the email (case-insensitive)", () => {
  expect(isMcpAdmin("A@x.com", "a@x.com, b@x.com")).toBe(true);
  expect(isMcpAdmin("c@x.com", "a@x.com")).toBe(false);
  expect(isMcpAdmin("a@x.com", "")).toBe(false); expect(isMcpAdmin("a@x.com", undefined)).toBe(false);
});
test("authorize GET: 503/401 without Access config or JWT; 403 for an email outside the allow list; never calls the provider", async () => {
  const { p, calls } = provider();
  const prod = (e: Record<string, unknown>) => ({ ...e, OAUTH_PROVIDER: p });
  expect((await handleAuthorize(new Request("https://shinnosuke-kobayashi.jp/admin/mcp/authorize"), prod({}) as any)).status).toBe(503);
  expect((await handleAuthorize(new Request("https://shinnosuke-kobayashi.jp/admin/mcp/authorize"), prod({ ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", ACCESS_AUD: "aud" }) as any)).status).toBe(401);
  expect((await handleAuthorize(get("/admin/mcp/authorize"), { ...env({ ADMIN_EMAILS: "someone@else.com" }), OAUTH_PROVIDER: p } as any)).status).toBe(403);
  expect((await handleAuthorize(get("/admin/mcp/authorize"), { ...env({ ADMIN_EMAILS: "" }), OAUTH_PROVIDER: p } as any)).status).toBe(403);
  expect(calls.complete).toHaveLength(0);
});
test("authorize GET renders a consent form with the handle, escaped client name, no-store/noindex/frame headers and the binding cookie", async () => {
  const { p } = provider();
  const res = await handleAuthorize(get("/admin/mcp/authorize?client_id=c1"), { ...env(), OAUTH_PROVIDER: p } as any);
  expect(res.status).toBe(200); const html = await res.text();
  expect(html).toContain('name="handle" value="H123"'); expect(html).not.toContain("<img src=x"); expect(html).toContain("&lt;img src=x");
  expect(res.headers.get("Set-Cookie")).toContain("bind=1"); expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(res.headers.get("X-Robots-Tag")).toMatch(/noindex/); expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
});
test("authorize POST: wrong/missing Origin → 403; approve → completeAuthorization with userId/email/cms scope/props then 302; deny → redirect with error", async () => {
  const { p, calls } = provider(); const e = { ...env(), OAUTH_PROVIDER: p } as any;
  expect((await handleAuthorize(form("/admin/mcp/authorize", { handle: "H", decision: "approve" }, { Origin: "https://evil.example" }), e)).status).toBe(403);
  expect((await handleAuthorize(form("/admin/mcp/authorize", { handle: "H", decision: "approve" }, {}), e)).status).toBe(403);
  expect(calls.complete).toHaveLength(0);
  const ok = await handleAuthorize(form("/admin/mcp/authorize", { handle: "H123", decision: "approve" }), e);
  expect(ok.status).toBe(302); expect(ok.headers.get("Location")).toBe("https://claude.ai/cb?code=abc"); expect(ok.headers.get("Set-Cookie")).toContain("Max-Age=0");
  expect(calls.approve[0]).toEqual(["H123", { scope: ["cms"] }]);
  const c = calls.complete[0] as any; expect(c.userId).toBe("dev"); expect(c.scope).toEqual(["cms"]); expect(c.props).toEqual({ email: "dev", client: expect.any(String) });
  const no = await handleAuthorize(form("/admin/mcp/authorize", { handle: "H123", decision: "deny" }), e);
  expect(no.status).toBe(302); expect(no.headers.get("Location")).toContain("access_denied"); expect(calls.complete).toHaveLength(1);
  expect((await handleAuthorize(form("/admin/mcp/authorize", { handle: "H123", decision: "weird" }), e)).status).toBe(400);
  expect((await handleAuthorize(new Request(L + "/admin/mcp/authorize", { method: "PUT", headers: { Origin: L } }), e)).status).toBe(405);
});
test("grants API: needs Access auth; lists the caller's grants; revoke needs Origin + JSON and only revokes for the caller's userId", async () => {
  const { p, calls } = provider(); const e = { ...env(), OAUTH_PROVIDER: p } as any;
  expect((await handleGrantsApi(new Request("https://shinnosuke-kobayashi.jp/admin/mcp/api/grants"), { OAUTH_PROVIDER: p } as any)).status).toBe(503);
  const list = await (await handleGrantsApi(get("/admin/mcp/api/grants"), e)).json() as any; expect(list.grants[0]).toMatchObject({ id: "g1", client: "Claude" });
  const json = (h: Record<string, string>) => new Request(L + "/admin/mcp/api/revoke", { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify({ id: "g1" }) });
  expect((await handleGrantsApi(json({ Origin: "https://evil.example" }), e)).status).toBe(403);
  expect((await handleGrantsApi(new Request(L + "/admin/mcp/api/revoke", { method: "POST", headers: { Origin: L, "Content-Type": "text/plain" }, body: "{}" }), e)).status).toBe(415);
  expect(calls.revoke).toHaveLength(0);
  expect((await handleGrantsApi(json({ Origin: L }), e)).status).toBe(200); expect(calls.revoke).toEqual([["g1", "dev"]]);
});
test("mcpEndpoint: no/invalid props → 403 (also when the token's email left the allow list); allowed email reaches the MCP handler", async () => {
  const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s);
  const store = new Map<string, string>();
  const e = { DB: d1(raw), MEDIA: { put: async () => {}, delete: async () => {} }, CACHE: { get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => { store.set(k, v); } }, ADMIN_EMAILS: "me@x.com" } as any;
  const req = () => new Request("https://shinnosuke-kobayashi.jp/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) });
  expect((await mcpEndpoint(req(), e, { props: undefined } as any)).status).toBe(403);
  expect((await mcpEndpoint(req(), e, { props: { email: "gone@x.com" } } as any)).status).toBe(403);
  expect((await mcpEndpoint(req(), { ...e, ADMIN_EMAILS: "" }, { props: { email: "me@x.com" } } as any)).status).toBe(403);
  const ok = await mcpEndpoint(req(), e, { props: { email: "me@x.com", client: "Claude" } } as any); expect(ok.status).toBe(200);
  expect(await ok.json()).toMatchObject({ result: {} });
});
