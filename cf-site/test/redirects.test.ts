import { expect, test } from "vitest";
import { normalizeRequest as n } from "../src/lib/redirects.ts";
const u = (p: string) => new URL("https://x.test" + p);
test("legacy uploads move to /media and keep the query", () => {
  expect(n(u("/wp-content/uploads/2026/07/a.jpg?x=1"))).toEqual({ status: 301, location: "/media/2026/07/a.jpg?x=1" });
});
test("adds a trailing slash to extension-less paths and keeps the query", () => {
  expect(n(u("/works"))).toEqual({ status: 301, location: "/works/" });
  expect(n(u("/works/%E6%97%A5%E6%9C%AC?a=b"))).toEqual({ status: 301, location: "/works/%E6%97%A5%E6%9C%AC/?a=b" });
});
test("does not loop or touch files and system paths", () => {
  for (const p of ["/", "/works/", "/media/2026/07/a.jpg", "/media/noext", "/assets/main.js", "/_astro/x.css", "/favicon.ico", "/sitemap.xml"]) expect(n(u(p)), p).toBeNull();
});
test("page 1 redirects to the list root", () => {
  expect(n(u("/works/page/1/"))).toEqual({ status: 301, location: "/works/" });
  expect(n(u("/works/page/2/"))).toBeNull();
});
test("taxonomy page 1 redirects to the term root", () => {
  expect(n(u("/skill/dx/page/1/"))).toEqual({ status: 301, location: "/skill/dx/" });
  expect(n(u("/works_type/%E8%B5%B7/page/1/?a=1"))).toEqual({ status: 301, location: "/works_type/%E8%B5%B7/?a=1" });
  expect(n(u("/skill/dx/page/2/"))).toBeNull();
});
test("language-prefixed URLs get the same normalization and keep the /en prefix", () => {
  expect(n(u("/en"))).toEqual({ status: 301, location: "/en/" });
  expect(n(u("/en/works"))).toEqual({ status: 301, location: "/en/works/" });
  expect(n(u("/en/works/page/1/"))).toEqual({ status: 301, location: "/en/works/" });
  expect(n(u("/en/skill/dx/page/1/?a=1"))).toEqual({ status: 301, location: "/en/skill/dx/?a=1" });
  expect(n(u("/en/media/2026/07/a.jpg"))).toEqual({ status: 301, location: "/media/2026/07/a.jpg" });
  expect(n(u("/en/wp-content/uploads/2026/07/a.jpg"))).toEqual({ status: 301, location: "/media/2026/07/a.jpg" });
  for (const p of ["/en/", "/en/works/", "/en/works/page/2/"]) expect(n(u(p)), p).toBeNull();
  expect(n(u("/enfoo"))).toEqual({ status: 301, location: "/enfoo/" });
});
