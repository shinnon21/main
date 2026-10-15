import type { APIRoute } from "astro";
import { getEnv } from "../lib/env.ts";
import { sitemapEntries } from "../lib/queries.ts";
import { sitemapXml } from "../lib/seo.ts";

export const GET: APIRoute = async () =>
  new Response(sitemapXml(await sitemapEntries(getEnv().DB)), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
