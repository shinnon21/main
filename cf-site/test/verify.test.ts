import { expect, test } from "vitest";
import { expectedCounts, compareCounts, findBrokenMediaLinks } from "../scripts/lib/verify.ts";
import { exp } from "./fixtures/export.ts";
test("expected counts exclude draft/protected", () => {
  const c = expectedCounts(exp);
  expect(c.posts).toEqual({ works: 2, page: 1 });
  expect(c.postTerms).toBe(2);
  expect(c.attachmentsReferenced).toBe(1);
});
test("compareCounts reports differences", () => {
  expect(compareCounts({ posts: { works: 2 }, postTerms: 2, attachmentsReferenced: 0 }, { posts: { works: 1 }, postTerms: 2, attachmentsReferenced: 0 }))
    .toEqual(["posts.works: expected 2, actual 1"]);
  expect(compareCounts(expectedCounts(exp), expectedCounts(exp))).toEqual([]);
});
test("broken media links", () => {
  expect(findBrokenMediaLinks(`<img src="/media/a.webp"><img src="/media/gone.png">`, new Set(["a.webp"]))).toEqual(["gone.png"]);
});
