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
  for (const p of ["/admin", "/admin/", "/admin/api/posts", "/ADMIN/x", "/Admin", "/%61dmin/", "/%41DMIN/api", "//admin/", "//admin//api//posts", "/admin%2Fapi/posts", "/admin%2fapi"])
    expect(classifyPath(p), p).toBe("admin");
  for (const p of ["/en/admin", "/en/admin/", "/en/admin/api/posts", "/en//admin/", "/en/%61dmin/", "/EN/admin/", "/en/ADMIN/x", "//en/admin/"])
    expect(classifyPath(p), p).toBe("blocked");
  for (const p of ["/", "/works/", "/administrator/", "/adminx", "/works/admin/", "/en/", "/en/works/admin/", "/en/administrator/"])
    expect(classifyPath(p), p).toBe("public");
});
test("classifyPath treats undecodable paths as admin (fail closed)", () => {
  expect(classifyPath("/%E0%A4%A")).toBe("admin");
});

import { classifyRequest } from "../src/admin/guard.ts";
test("I1: classifyRequest looks at both the resolved URL and the raw (router-view) path; dot-segments are never served", () => {
  const u = (p: string) => `https://kb.example${p}`;
  for (const p of ["/admin/api/%252e%252e/%252e%252e/foo/", "/admin/%252e%252e/x/", "/x/%252e%252e/admin/", "/x/%2e%2e/admin/", "/./admin/", "/works/%252e%252e/admin/"])
    expect(classifyRequest(u(p)), p).not.toBe("public");
  for (const p of ["/admin/", "/%2561dmin/", "/%252561dmin/api/posts"]) expect(classifyRequest(u(p)), p).toBe("admin");
  for (const p of ["/en/admin/", "/en/%252561dmin/"]) expect(classifyRequest(u(p)), p).toBe("blocked");
  for (const p of ["/", "/works/", "/works/%E6%97%A5%E6%9C%AC/", "/en/works/page/2/?x=%252e", "/media/2026/07/a.jpg"]) expect(classifyRequest(u(p)), p).toBe("public");
});

test("classifyPath: dot-segments are blocked, never public", () => {
  for (const p of ["/%2e%2e/admin/", "/a/../b/", "/./x/", "/x/%2e%2e/", "/x/.."]) expect(classifyPath(p), p).toBe("blocked");
});
