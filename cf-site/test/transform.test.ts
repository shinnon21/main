import { expect, test } from "vitest";
import { rewriteUploads, findWpArtifacts } from "../scripts/lib/transform.ts";
const site = "https://shinnosuke-kobayashi.jp";
test("rewrites https and http absolute uploads URLs", () => {
  const html = `<img src="${site}/wp-content/uploads/2026/07/a.webp"><img src="http://shinnosuke-kobayashi.jp/wp-content/uploads/2026/07/b.png">`;
  expect(rewriteUploads(html, site)).toBe(`<img src="/media/2026/07/a.webp"><img src="/media/2026/07/b.png">`);
});
test("rewrites size-suffixed names to the original and handles srcset", () => {
  const html = `<img src="${site}/wp-content/uploads/2026/07/a-300x200.jpg" srcset="${site}/wp-content/uploads/2026/07/a-300x200.jpg 300w, ${site}/wp-content/uploads/2026/07/a-768x512.jpg 768w">`;
  expect(rewriteUploads(html, site)).toBe(`<img src="/media/2026/07/a.jpg" srcset="/media/2026/07/a.jpg 300w, /media/2026/07/a.jpg 768w">`);
});
test("relative /wp-content/uploads also rewritten; other URLs untouched", () => {
  expect(rewriteUploads(`<a href="/wp-content/uploads/x/y.pdf">p</a><a href="https://example.com/wp-content/uploads/z.png">q</a>`, site))
    .toBe(`<a href="/media/x/y.pdf">p</a><a href="https://example.com/wp-content/uploads/z.png">q</a>`);
});
test("detects shortcodes and block comments", () => {
  expect(findWpArtifacts(`a [gallery ids="1"] b <!-- wp:paragraph --> c`)).toEqual([`[gallery ids="1"]`, `<!-- wp:paragraph -->`]);
  expect(findWpArtifacts("plain [text] with brackets in prose?").length).toBe(0);
});
