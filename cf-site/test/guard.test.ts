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

import { classifyPath } from "../src/admin/guard.ts";
test("classifyPath: every spelling that can reach /admin is 'admin'; /en/admin variants are 'blocked'; others 'public'", () => {
  for (const p of ["/admin", "/admin/", "/admin/api/posts", "/ADMIN/x", "/Admin", "/%61dmin/", "/%41DMIN/api", "//admin/", "//admin//api//posts", "/admin%2Fapi/posts", "/admin%2fapi", "/%2e%2e/admin/"])
    expect(classifyPath(p), p).toBe("admin");
  for (const p of ["/en/admin", "/en/admin/", "/en/admin/api/posts", "/en//admin/", "/en/%61dmin/", "/EN/admin/", "/en/ADMIN/x", "//en/admin/"])
    expect(classifyPath(p), p).toBe("blocked");
  for (const p of ["/", "/works/", "/administrator/", "/adminx", "/works/admin/", "/en/", "/en/works/admin/", "/en/administrator/"])
    expect(classifyPath(p), p).toBe("public");
});
test("classifyPath treats undecodable paths as admin (fail closed)", () => {
  expect(classifyPath("/%E0%A4%A")).toBe("admin");
});
