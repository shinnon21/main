import type { Lang } from "./i18n.ts";

export function resolveLang(pathname: string): { lang: Lang; path: string } {
  const m = pathname.match(/^\/en(\/.*)?$/);
  return m ? { lang: "en", path: m[1] ?? "/" } : { lang: "ja", path: pathname };
}
const SYSTEM = /^\/(media|assets|_astro)(\/|$)/;
export function l(lang: Lang, path: string): string {
  if (lang !== "en" || !path.startsWith("/") || path.startsWith("//") || SYSTEM.test(path)) return path;
  return path === "/" ? "/en/" : "/en" + path;
}
export function altPair(path: string): { ja: string; en: string } {
  return { ja: path, en: l("en", path) };
}
