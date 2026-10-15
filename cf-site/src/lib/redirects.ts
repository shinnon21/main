import { resolveLang } from "./lang.ts";

export function normalizeRequest(url: URL): { status: 301; location: string } | null {
  const { lang, path } = resolveLang(url.pathname);
  const prefix = lang === "en" ? "/en" : "";
  const search = url.search;
  if (/^\/wp-sitemap[^/]*\.xml$/.test(path)) return { status: 301, location: "/sitemap.xml" };
  if (path === "/favicon.ico") return { status: 301, location: "/assets/img/favicon-192.png" };
  const legacy = path.match(/^\/wp-content\/uploads\/(.+)$/);
  if (legacy) return { status: 301, location: `/media/${legacy[1]}${search}` };
  if (/^\/(media|assets|_astro)(\/|$)/.test(path)) return lang === "en" ? { status: 301, location: `${path}${search}` } : null;
  if (lang === "en" && url.pathname === "/en") return { status: 301, location: `/en/${search}` };
  const last = path.split("/").pop() ?? "";
  if (!path.endsWith("/") && !last.includes(".")) return { status: 301, location: `${prefix}${path}/${search}` };
  const p1 = path.match(/^\/((?:works|column|news)|(?:works_type|skill|industry|news_type)\/[^/]+)\/page\/1\/$/);
  if (p1) return { status: 301, location: `${prefix}/${p1[1]}/${search}` };
  return null;
}
