import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { handle } from "@astrojs/cloudflare/handler";
import { wwwRedirect } from "./lib/redirects.ts";
import { capBody } from "./mcp/limits.ts";
import { handleAuthorize, handleGrantsApi, mcpEndpoint } from "./mcp/oauth.ts";

/**
 * Worker入口。/mcp（Bearer必須）・/oauth/*・/.well-known/* は OAuthProvider が処理し、
 * それ以外は従来どおり Astro。OAuthのヘルパー（env.OAUTH_PROVIDER）が要る認可画面と接続管理APIだけ、
 * Astro の前でここから直接処理する（パスは完全一致のみ。他の綴りは Astro のミドルウェアが従来どおり扱う）。
 */
const defaultHandler = {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/admin/mcp/authorize") return handleAuthorize(request, env);
    if (pathname === "/admin/mcp/api/grants" || pathname === "/admin/mcp/api/revoke") return handleGrantsApi(request, env);
    return handle(request, env, ctx) as Promise<Response>;
  },
};

// OAuthProvider は保護対象リソースの正規URL（resource）を構築時に要求する。正規オリジンは env.SITE_ORIGIN（本番は https://shinnosuke-kobayashi.jp）
const providers = new Map<string, OAuthProvider<any>>();
function providerFor(origin: string): OAuthProvider<any> {
  let p = providers.get(origin);
  if (!p) {
    p = new OAuthProvider<any>({
      apiRoute: "/mcp",
      apiHandler: { fetch: (request: Request, env: any, ctx: any) => mcpEndpoint(request, env, ctx) },
      defaultHandler,
      authorizeEndpoint: "/admin/mcp/authorize",
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      scopesSupported: ["cms"],
      requiredScopes: ["cms"],
      resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin], resource_name: "小林慎之助 公式サイト CMS" },
      accessTokenTTL: 3600,
    });
    providers.set(origin, p);
  }
  return p;
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const www = wwwRedirect(new URL(request.url));
    if (www) return new Response(null, { status: 301, headers: { Location: www } });
    // 認証なしで書き込みが発生する動的クライアント登録は、巨大なボディを前段で拒否する（書き込み量の増幅対策。IP別のレート制限はWAF側で設定）
    const u = new URL(request.url);
    if (request.method === "POST" && u.pathname === "/oauth/register") {
      const capped = await capBody(request, 8 * 1024);
      if (capped instanceof Response) return capped;
      request = capped;
    }
    const origin = String(env.SITE_ORIGIN || "https://shinnosuke-kobayashi.jp").replace(/\/+$/, "");
    return providerFor(origin).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<any>;
