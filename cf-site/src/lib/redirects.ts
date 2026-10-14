export function normalizeRequest(url: URL): { status: 301; location: string } | null {
  const { pathname, search } = url;
  const legacy = pathname.match(/^\/wp-content\/uploads\/(.+)$/);
  if (legacy) return { status: 301, location: `/media/${legacy[1]}${search}` };
  if (/^\/(media|assets|_astro)(\/|$)/.test(pathname)) return null;
  const last = pathname.split("/").pop() ?? "";
  if (!pathname.endsWith("/") && !last.includes(".")) return { status: 301, location: `${pathname}/${search}` };
  const p1 = pathname.match(/^\/(works|column|news)\/page\/1\/$/);
  if (p1) return { status: 301, location: `/${p1[1]}/${search}` };
  return null;
}
