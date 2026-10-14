import { expect, test } from "vitest";
import { urlsFor, extractHead, diffPage } from "../scripts/lib/urls.ts";
import { exp } from "./fixtures/export.ts";
test("urlsFor lists published posts, ja and en, no drafts, no duplicates", () => {
  const u = urlsFor(exp);
  expect(u).toContain("/"); expect(u).toContain("/en/");
  expect(u).toContain("/works/site-a/"); expect(u).toContain("/en/works/site-a/"); expect(u).toContain("/profile/");
  expect(new Set(u).size).toBe(u.length);
  expect(u.join()).not.toContain("draft-col");
  expect(u.join()).not.toContain("secret");
});
test("extractHead", () => {
  expect(extractHead(`<head><title>A | B</title><link rel="canonical" href="https://x/y/"></head>`)).toEqual({ title: "A | B", canonical: "https://x/y/" });
  expect(extractHead("<p>none</p>")).toEqual({ title: null, canonical: null });
});
test("diffPage compares status/title/canonical path", () => {
  expect(diffPage({ status: 200, title: "T", canonical: "https://a/x/" }, { status: 200, title: "T", canonical: "https://b/x/" })).toEqual([]);
  expect(diffPage({ status: 200, title: "T", canonical: null }, { status: 404, title: "T2", canonical: null })).toEqual(["status: 200 vs 404", "title: T vs T2"]);
});
