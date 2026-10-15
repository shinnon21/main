import type { APIRoute } from "astro";
import { handleContactSubmit } from "../../lib/contact-api.ts";
import { getEnv } from "../../lib/env.ts";
import { SITE_URL } from "../../lib/format.ts";
import { nowUtcMs } from "../../admin/guard.ts";

export const ALL: APIRoute = ({ request, locals }) => {
  const env = getEnv();
  return handleContactSubmit(request, {
    db: env.DB, kv: env.CACHE, mail: env.EMAIL,
    cfg: { turnstileSecret: env.TURNSTILE_SECRET, to: env.CONTACT_TO || "contact@shinnosuke-kobayashi.jp", from: env.CONTACT_FROM || "noreply@shinnosuke-kobayashi.jp", ipSalt: env.IP_SALT || env.TURNSTILE_SECRET || "", siteUrl: SITE_URL },
    nowUtc: nowUtcMs(),
    waitUntil: (p) => { if (locals.cfContext) locals.cfContext.waitUntil(p); else p.catch(() => {}); },
  });
};
