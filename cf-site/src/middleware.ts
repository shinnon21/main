import { defineMiddleware } from "astro:middleware";
import { normalizeRequest } from "./lib/redirects.ts";
import { resolveLang } from "./lib/lang.ts";

export const onRequest = defineMiddleware((ctx, next) => {
  const r = normalizeRequest(ctx.url);
  if (r) return ctx.redirect(r.location, r.status);
  const { lang, path } = resolveLang(ctx.url.pathname);
  const first = ctx.locals.lang === undefined;
  ctx.locals.lang ??= lang; // 書き換え再入場（Astro.rewrite）では最初の言語を保持
  if (first) ctx.locals.path = path; // 言語中立パス（hreflang・切替用）
  return lang === "en" && first ? next(path + ctx.url.search) : next();
});
