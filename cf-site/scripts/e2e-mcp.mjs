// ローカルE2E: `npm run build` → `wrangler dev -c dist/server/wrangler.json --local --port 8790 --var DEV_ADMIN_EMAIL:dev --var ADMIN_EMAILS:dev`
// に対し、動的クライアント登録 → 認可(同意) → トークン → 公式SDKクライアントで /mcp を呼ぶ。使い方: node scripts/e2e-mcp.mjs [baseUrl]
import { createHash, randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const base = process.argv[2] ?? "http://localhost:8790";
const redirect = "https://claude.example/callback";
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  :", m); };
const b64 = (b) => b.toString("base64url");

// 0) 未認証の /mcp は 401
let r = await fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) });
ok(r.status === 401, `unauthenticated /mcp → 401 (got ${r.status})`);
const meta = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
ok(meta.token_endpoint?.endsWith("/oauth/token") && meta.registration_endpoint?.endsWith("/oauth/register"), "authorization server metadata advertises token/registration endpoints");

// 1) 動的クライアント登録
r = await fetch(`${base}/oauth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "E2E <b>Claude</b>", redirect_uris: [redirect], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }) });
const client = await r.json(); ok(r.status === 201 && client.client_id, "dynamic client registration");

// 2) 認可: GET で同意画面、POST で許可
const verifier = b64(randomBytes(32)), challenge = b64(createHash("sha256").update(verifier).digest());
const q = new URLSearchParams({ response_type: "code", client_id: client.client_id, redirect_uri: redirect, scope: "cms", state: "st1", code_challenge: challenge, code_challenge_method: "S256", resource: `${base}/mcp` });
r = await fetch(`${base}/admin/mcp/authorize?${q}`); const html = await r.text();
ok(r.status === 200 && html.includes('name="handle"'), "consent page renders");
ok(!html.includes("<b>Claude</b>") && html.includes("&lt;b&gt;"), "client name is HTML-escaped");
const handle = html.match(/name="handle" value="([^"]+)"/)[1];
const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
r = await fetch(`${base}/admin/mcp/authorize?${q}`, { method: "POST", redirect: "manual", headers: { Origin: base, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie }, body: new URLSearchParams({ handle, decision: "approve" }) });
ok(r.status === 302, `approve → 302 (got ${r.status})`);
const loc = new URL(r.headers.get("Location")); const code = loc.searchParams.get("code");
ok(code && loc.searchParams.get("state") === "st1" && loc.origin + loc.pathname === redirect, "redirect carries code and state");
r = await fetch(`${base}/admin/mcp/authorize?${q}`, { method: "POST", redirect: "manual", headers: { Origin: base, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie }, body: new URLSearchParams({ handle, decision: "approve" }) });
ok(r.status >= 400, `the consent handle works only once (replay → ${r.status})`);

// 3) トークン
r = await fetch(`${base}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect, client_id: client.client_id, code_verifier: verifier, resource: `${base}/mcp` }) });
const tok = await r.json(); ok(r.status === 200 && tok.access_token, "token exchange");

// 4) 公式SDKクライアントで /mcp
const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${tok.access_token}` } } });
const c = new Client({ name: "e2e", version: "1" }); await c.connect(transport);
const tools = (await c.listTools()).tools.map((t) => t.name).sort();
ok(tools.join() === "create_post,create_term,get_post,list_posts,list_terms,update_post,upload_media_from_url", `tools: ${tools.join(",")}`);
const created = await c.callTool({ name: "create_post", arguments: { type: "column", title: "E2E 下書き", content: "<h2>見出し</h2><p>本文</p><script>alert(1)</script>" } });
const id = JSON.parse(created.content[0].text).id; ok(!created.isError && id, `create_post → id ${id}`);
const got = JSON.parse((await c.callTool({ name: "get_post", arguments: { id } })).content[0].text);
ok(got.status === "draft" && !got.content.includes("<script"), "created as draft and content sanitized");
const upd = await c.callTool({ name: "update_post", arguments: { id, expected_modified_at: got.modified_at, title: "E2E 更新" } });
ok(!upd.isError, "update_post succeeds"); 
const stale = await c.callTool({ name: "update_post", arguments: { id, expected_modified_at: "1999-01-01 00:00:00", title: "x" } });
ok(stale.isError && /409/.test(stale.content[0].text), "stale update → 409 tool error");
const pub = await c.callTool({ name: "update_post", arguments: { id, expected_modified_at: got.modified_at, status: "publish" } });
ok(pub.isError, "passing status is rejected");
const ssrf = await c.callTool({ name: "upload_media_from_url", arguments: { url: "https://169.254.169.254/latest/meta-data" } });
ok(ssrf.isError, "metadata-IP media URL refused");
await c.close();

// 5) 接続管理API
r = await fetch(`${base}/admin/mcp/api/grants`); const gl = await r.json();
ok(r.status === 200 && gl.grants.length >= 1, "grants API lists the connection");
// 過去の実行で残った接続も含め、一覧の全接続を取り消す（取り消し対象の取り違えによる不安定さを避ける）
let allRevoked = true;
for (const g of gl.grants) {
  r = await fetch(`${base}/admin/mcp/api/revoke`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ id: g.id }) });
  if (r.status !== 200) allRevoked = false;
}
ok(allRevoked, `revoke succeeds for all ${gl.grants.length} grant(s)`);
r = await fetch(`${base}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) });
ok(r.status === 401, `revoked token is refused (got ${r.status})`);
// 認可コードの再利用は拒否される（注意: 再利用するとライブラリは発行済みトークンも失効させるため、最後に行う）
r = await fetch(`${base}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect, client_id: client.client_id, code_verifier: verifier, resource: `${base}/mcp` }) });
ok(r.status >= 400, `authorization code is single-use (replay → ${r.status})`);
console.log(process.exitCode ? "E2E FAILED" : "E2E PASSED");
