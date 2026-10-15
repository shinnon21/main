import { defineMiddleware } from "astro:middleware";
import { normalizeRequest } from "./lib/redirects.ts";
import { resolveLang } from "./lib/lang.ts";
import { isStagingHost } from "./lib/seo.ts";

// 確認用ホスト（*.workers.dev・localhost）は検索エンジンに載せない
const guard = async (host: string, res: Response | Promise<Response>) => {
  const r = await res;
  if (!isStagingHost(host)) return r;
  const out = new Response(r.body, r);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
};

export const onRequest = defineMiddleware((ctx, next) => {
  const r = normalizeRequest(ctx.url);
  if (r) return guard(ctx.url.host, ctx.redirect(r.location, r.status));
  const { lang, path } = resolveLang(ctx.url.pathname);
  const first = ctx.locals.lang === undefined;
  ctx.locals.lang ??= lang; // 書き換え再入場（Astro.rewrite）では最初の言語を保持
  if (first) ctx.locals.path = path; // 言語中立パス（hreflang・切替用）
  return guard(ctx.url.host, lang === "en" && first ? next(path + ctx.url.search) : next());
});
