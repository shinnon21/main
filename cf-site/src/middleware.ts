import { defineMiddleware } from "astro:middleware";
import { normalizeRequest, wwwRedirect } from "./lib/redirects.ts";
import { resolveLang } from "./lib/lang.ts";
import { isStagingHost } from "./lib/seo.ts";
import { authorize } from "./admin/access.ts";
import { adminHeaders, classifyRequest } from "./admin/guard.ts";
import { getEnv } from "./lib/env.ts";

// 確認用ホスト（*.workers.dev・localhost）は検索エンジンに載せない
const guard = async (host: string, res: Response | Promise<Response>) => {
  const r = await res;
  if (!isStagingHost(host)) return r;
  const out = new Response(r.body, r);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
};

export const onRequest = defineMiddleware(async (ctx, next) => {
  // www は管理画面を含め最初にwwwなしへ転送（Accessの保護対象ホストと一致させる）
  const www = wwwRedirect(ctx.url);
  if (www) return ctx.redirect(www, 301);
  // 管理画面: Access認証（fail closed）。言語・URL正規化は適用しない。
  // /admin に解決しうるあらゆる綴り（%エンコード・//・大文字）を classifyPath で検出し、/en/admin… は存在しない（404）
  const kind = classifyRequest(ctx.request.url);
  if (kind === "blocked") return adminHeaders(new Response("Not found", { status: 404 }));
  if (kind === "admin") {
    const a = await authorize(ctx.request, getEnv());
    if (!a.ok) return adminHeaders(new Response(a.message, { status: a.status }));
    ctx.locals.adminEmail = a.email;
    return guard(ctx.url.host, adminHeaders(await next()));
  }
  const r = normalizeRequest(ctx.url);
  if (r) return guard(ctx.url.host, ctx.redirect(r.location, r.status));
  const { lang, path } = resolveLang(ctx.url.pathname);
  const first = ctx.locals.lang === undefined;
  ctx.locals.lang ??= lang; // 書き換え再入場（Astro.rewrite）では最初の言語を保持
  if (first) ctx.locals.path = path; // 言語中立パス（hreflang・切替用）
  // /?s=キーワード（フリーワード検索）は内部の /search/ へ書き換える（URLは変えない）。空のsはトップのまま
  const isSearch = path === "/" && (ctx.url.searchParams.get("s") ?? "").trim() !== "";
  if (isSearch && first) return guard(ctx.url.host, next("/search/" + ctx.url.search));
  return guard(ctx.url.host, lang === "en" && first ? next(path + ctx.url.search) : next());
});
