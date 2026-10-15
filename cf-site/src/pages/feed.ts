import type { APIRoute } from "astro";
import { getEnv } from "../lib/env.ts";
import { feedPosts } from "../lib/queries.ts";
import { rssXml } from "../lib/seo.ts";

export const GET: APIRoute = async () => {
  const db = getEnv().DB;
  const name = (await db.prepare("SELECT value FROM settings WHERE key='blogname'").bind().first<{ value: string }>())?.value;
  const desc = (await db.prepare("SELECT value FROM settings WHERE key='blogdescription'").bind().first<{ value: string }>())?.value;
  const parse = (v: string | undefined, d: string) => { try { return (JSON.parse(v ?? "") as string) || d; } catch { return d; } };
  const xml = rssXml({ title: parse(name, "小林慎之助"), description: parse(desc, "構想を、社会に実装する。"), items: await feedPosts(db, 30) });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
};
