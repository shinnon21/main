import type { APIRoute } from "astro";
import { getEnv } from "../../lib/env.ts";

export const GET: APIRoute = async ({ params, rewrite }) => {
  const key = params.path ?? "";
  if (!key || key.split("/").includes("..")) return rewrite("/404/");
  const obj = await getEnv().MEDIA.get(key);
  if (!obj) return rewrite("/404/");
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: obj.httpEtag,
    },
  });
};
