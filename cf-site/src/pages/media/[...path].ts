import type { APIRoute } from "astro";
import { getEnv } from "../../lib/env.ts";
import { mediaHeaders } from "../../lib/media-serve.ts";

export const GET: APIRoute = async ({ params, rewrite }) => {
  const key = params.path ?? "";
  if (!key || key.split("/").includes("..")) return rewrite("/404/");
  const obj = await getEnv().MEDIA.get(key);
  if (!obj) return rewrite("/404/");
  return new Response(obj.body, { headers: mediaHeaders(obj.httpMetadata?.contentType, obj.httpEtag) });
};
