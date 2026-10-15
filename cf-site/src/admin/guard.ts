export const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

export function adminHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  out.headers.set("Cache-Control", "no-store");
  return out;
}

export const nowUtcMs = (d = new Date()) => d.toISOString().replace("T", " ").replace("Z", "");
