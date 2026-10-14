import { defineMiddleware } from "astro:middleware";
import { normalizeRequest } from "./lib/redirects.ts";

export const onRequest = defineMiddleware((ctx, next) => {
  const r = normalizeRequest(ctx.url);
  return r ? ctx.redirect(r.location, r.status) : next();
});
