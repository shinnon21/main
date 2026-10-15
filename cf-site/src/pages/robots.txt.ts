import type { APIRoute } from "astro";
import { isStagingHost, robotsTxt } from "../lib/seo.ts";

export const GET: APIRoute = ({ url }) =>
  new Response(robotsTxt(isStagingHost(url.host)), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
