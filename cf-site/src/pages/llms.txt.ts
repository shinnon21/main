import type { APIRoute } from "astro";
import { getEnv } from "../lib/env.ts";
import { llmsInputs } from "../lib/queries.ts";
import { llmsTxt } from "../lib/seo.ts";
import { SNS } from "../lib/sns.ts";

export const GET: APIRoute = async () => {
  const i = await llmsInputs(getEnv().DB);
  return new Response(llmsTxt({ ...i, sns: SNS.filter((s) => s.url).map((s) => ({ label: s.label, url: s.url })) }), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "public, max-age=3600" },
  });
};
