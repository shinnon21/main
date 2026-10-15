import { expect, test } from "vitest";
import { resolveLang, l, altPair } from "../src/lib/lang.ts";

test("resolveLang detects the /en prefix on segment boundaries only", () => {
  expect(resolveLang("/en")).toEqual({ lang: "en", path: "/" });
  expect(resolveLang("/en/")).toEqual({ lang: "en", path: "/" });
  expect(resolveLang("/en/works/")).toEqual({ lang: "en", path: "/works/" });
  expect(resolveLang("/en/works/%E6%97%A5/")).toEqual({ lang: "en", path: "/works/%E6%97%A5/" });
  for (const p of ["/", "/works/", "/enfoo/", "/english/", "/entry/", "/works/en/"]) expect(resolveLang(p), p).toEqual({ lang: "ja", path: p });
});
test("l prefixes internal paths for en and leaves external/anchor/query-only untouched", () => {
  expect(l("en", "/")).toBe("/en/");
  expect(l("en", "/works/")).toBe("/en/works/");
  expect(l("en", "/profile/#research")).toBe("/en/profile/#research");
  expect(l("ja", "/works/")).toBe("/works/");
  expect(l("en", "https://x.test/a")).toBe("https://x.test/a");
  expect(l("en", "#top")).toBe("#top");
  expect(l("en", "/media/a.jpg")).toBe("/media/a.jpg");
  expect(l("en", "/assets/main.js")).toBe("/assets/main.js");
});
test("altPair builds both language URLs from a neutral path", () => {
  expect(altPair("/")).toEqual({ ja: "/", en: "/en/" });
  expect(altPair("/works/x/")).toEqual({ ja: "/works/x/", en: "/en/works/x/" });
});
