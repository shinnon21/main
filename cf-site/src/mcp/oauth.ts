import { authorize, type AdminEnv } from "../admin/access.ts";
import { adminHeaders, nowUtcMs } from "../admin/guard.ts";
import type { KbEnv } from "../lib/env.ts";
import { mcpHttp } from "./server.ts";

/** workers-oauth-provider の OAuthHelpers のうち使う分（テストで差し替えやすいよう最小に絞る） */
export interface Provider {
  parseAuthRequest(r: Request): Promise<any>;
  describeConsent(a: any): Promise<{ clientName: string; redirectHost: string; redirectIsLoopback: boolean }>;
  beginConsent(a: any): Promise<{ handle: string; headers: Headers }>;
  approveConsent(r: Request, handle: string, o?: { scope?: string[] }): Promise<{ request: any; headers: Headers }>;
  denyConsent(r: Request, handle: string): Promise<{ redirectTo: string; headers: Headers }>;
  completeAuthorization(o: any): Promise<{ redirectTo: string }>;
  listUserGrants(userId: string): Promise<{ items: { id: string; clientId: string; scope: string[]; metadata: any; createdAt: number; expiresAt?: number }[] }>;
  revokeGrant(id: string, userId: string): Promise<void>;
}
type OEnv = KbEnv & AdminEnv & { OAUTH_PROVIDER: Provider };

const SCOPE = ["cms"];
const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const text = (status: number, msg: string) => adminHeaders(new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
const json = (status: number, data: unknown) => adminHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));

/** MCPは許可リスト必須（空なら誰も使えない）。管理画面と違い「リスト未設定＝全員可」にしない */
export function isMcpAdmin(email: string, allow: string | undefined): boolean {
  const list = (allow ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length > 0 && list.includes(email.toLowerCase());
}

/** Access（前段のJWT）で本人確認し、MCP許可リストにも入っていること */
async function requireAdmin(req: Request, env: OEnv): Promise<{ email: string } | Response> {
  const a = await authorize(req, env);
  if (!a.ok) return text(a.status, a.message);
  if (!isMcpAdmin(a.email, env.ADMIN_EMAILS)) return text(403, "Forbidden");
  return { email: a.email };
}
const sameOrigin = (req: Request) => req.headers.get("Origin") === new URL(req.url).origin;

const page = (body: string) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Claudeの接続を許可 | 管理画面</title>
<style>body{font:16px/1.7 system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#1a1a1a}.card{border:1px solid #e6dcde;border-radius:12px;padding:24px}button{font:inherit;padding:10px 20px;border-radius:8px;border:1px solid #e6dcde;background:#fff;cursor:pointer}button.ok{background:#c22740;border-color:#c22740;color:#fff}.row{display:flex;gap:12px;margin-top:20px}code{background:#faf8f9;padding:2px 6px;border-radius:4px}</style></head><body><div class="card">${body}</div></body></html>`;

/** GET: 同意画面（ライブラリが発行するCSRF束縛付きhandleを埋め込む）。POST: 許可/拒否 */
export async function handleAuthorize(req: Request, env: OEnv): Promise<Response> {
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "POST") return text(405, "Method Not Allowed");
  const who = await requireAdmin(req, env);
  if (who instanceof Response) return who;
  const p = env.OAUTH_PROVIDER;
  try {
    if (method === "GET") {
      const authReq = await p.parseAuthRequest(req);
      const d = await p.describeConsent(authReq);
      const t = await p.beginConsent(authReq);
      const headers = new Headers(t.headers); headers.set("Content-Type", "text/html; charset=utf-8");
      const html = page(`<h1 style="margin-top:0">Claudeの接続を許可しますか？</h1>
<p><strong>${esc(d.clientName)}</strong>（${esc(d.redirectHost)}）が、サイトの記事を<strong>下書きの作成・編集</strong>できるようになります。</p>
<ul><li>できること: 記事・実績・お知らせ・固定ページの閲覧、下書き作成、本文などの更新、分類の追加、画像の登録</li><li>できないこと: 公開・非公開の切替、削除、サイト設定、お問い合わせの閲覧</li></ul>
<p>ログイン中のアカウント: <code>${esc(who.email)}</code></p>
<form method="post"><input type="hidden" name="handle" value="${esc(t.handle)}"><div class="row"><button class="ok" name="decision" value="approve">許可する</button><button name="decision" value="deny">拒否する</button></div></form>`);
      return adminHeaders(new Response(html, { status: 200, headers }));
    }
    if (!sameOrigin(req)) return text(403, "bad origin");
    const f = await req.formData();
    const handle = String(f.get("handle") ?? ""), decision = String(f.get("decision") ?? "");
    if (!handle || (decision !== "approve" && decision !== "deny")) return text(400, "bad request");
    if (decision === "deny") {
      const r = await p.denyConsent(req, handle);
      const h = new Headers(r.headers); h.set("Location", r.redirectTo);
      return adminHeaders(new Response(null, { status: 302, headers: h }));
    }
    const approved = await p.approveConsent(req, handle, { scope: SCOPE });
    let client = "Claude";
    try { client = (await p.describeConsent(approved.request)).clientName.slice(0, 100) || client; } catch { /* 名前が取れなくても続行 */ }
    const done = await p.completeAuthorization({ request: approved.request, userId: who.email, metadata: { clientName: client }, scope: SCOPE, props: { email: who.email, client } });
    const h = new Headers(approved.headers); h.set("Location", done.redirectTo);
    return adminHeaders(new Response(null, { status: 302, headers: h }));
  } catch (e) {
    console.error("mcp authorize failed", e instanceof Error ? e.message : String(e));
    return text(400, "invalid authorization request");
  }
}

/** 接続中のClaude一覧と取り消し（管理画面 /admin/mcp/ のクライアントJSが使う） */
export async function handleGrantsApi(req: Request, env: OEnv): Promise<Response> {
  const who = await requireAdmin(req, env);
  if (who instanceof Response) return who;
  const url = new URL(req.url), method = req.method.toUpperCase();
  if (url.pathname.endsWith("/grants")) {
    if (method !== "GET") return text(405, "Method Not Allowed");
    const r = await env.OAUTH_PROVIDER.listUserGrants(who.email);
    return json(200, { grants: r.items.map((g) => ({ id: g.id, client: String(g.metadata?.clientName ?? g.clientId), createdAt: g.createdAt, expiresAt: g.expiresAt ?? null })) });
  }
  if (method !== "POST") return text(405, "Method Not Allowed");
  if (!sameOrigin(req)) return text(403, "bad origin");
  if (!/^application\/json(\s*;|$)/i.test(req.headers.get("Content-Type") ?? "")) return text(415, "content-type must be application/json");
  let id: unknown; try { id = ((await req.json()) as { id?: unknown })?.id; } catch { return text(400, "invalid JSON"); }
  if (typeof id !== "string" || !id) return text(400, "id is required");
  await env.OAUTH_PROVIDER.revokeGrant(id, who.email);
  return json(200, { ok: true });
}

/** /mcp（有効なBearerトークンの要求はライブラリが済ませている）。トークンのpropsを再確認し、許可リストから外れたメールは拒否する */
export async function mcpEndpoint(req: Request, env: KbEnv & AdminEnv, ctx: { props?: { email?: string; client?: string } }): Promise<Response> {
  const email = ctx.props?.email;
  if (typeof email !== "string" || !isMcpAdmin(email, env.ADMIN_EMAILS)) return text(403, "Forbidden");
  return mcpHttp(req, { db: env.DB, media: env.MEDIA, kv: env.CACHE, email, client: String(ctx.props?.client ?? "Claude").slice(0, 100), now: nowUtcMs });
}
