import { expect, test } from "vitest";
import { adminHeaders, isAdminPath, nowUtcMs } from "../src/admin/guard.ts";

test("isAdminPath matches /admin and children only", () => {
  for (const p of ["/admin", "/admin/", "/admin/works/3/", "/admin/api/posts"]) expect(isAdminPath(p), p).toBe(true);
  for (const p of ["/administrator/", "/en/admin/", "/adminx", "/", "/works/admin/"]) expect(isAdminPath(p), p).toBe(false);
});
test("adminHeaders adds noindex and no-store without losing the body/status", async () => {
  const r = adminHeaders(new Response("hi", { status: 401 }));
  expect(r.status).toBe(401); expect(await r.text()).toBe("hi");
  expect(r.headers.get("X-Robots-Tag")).toBe("noindex, nofollow"); expect(r.headers.get("Cache-Control")).toBe("no-store");
});
test("nowUtcMs formats as 'YYYY-MM-DD HH:MM:SS.mmm'", () => {
  expect(nowUtcMs(new Date("2026-10-15T01:02:03.456Z"))).toBe("2026-10-15 01:02:03.456");
});
