import { expect, test } from "vitest";
import { t } from "../src/lib/i18n.ts";
import { formatDate, autop, hrefFor, mediaSrc, docTitle, paginationModel, mediaEmbedIds } from "../src/lib/format.ts";

test("t picks language", () => { expect(t("ja", "実績", "Works")).toBe("実績"); expect(t("en", "実績", "Works")).toBe("Works"); });

test("formatDate converts UTC to JST at the day boundary", () => {
  expect(formatDate("2026-06-30 16:00:00")).toBe("2026.07.01");
  expect(formatDate("2026-06-30 14:59:59")).toBe("2026.06.30");
  expect(formatDate("2026-07-01T00:00:00")).toBe("2026.07.01");
  expect(formatDate("2026-07-01T00:00:00+00:00")).toBe("2026.07.01");
});

test("autop wraps bare text lines between headings and lists", () => {
  const src = "<h2>概要</h2>\n本文A\n続き\n<h2>取り組み</h2>\n<ul>\n \t<li>x</li>\n</ul>\n成果です。";
  expect(autop(src)).toBe("<h2>概要</h2>\n<p>本文A<br>\n続き</p>\n<h2>取り組み</h2>\n<ul>\n \t<li>x</li>\n</ul>\n<p>成果です。</p>");
});
test("autop leaves existing paragraphs alone and handles blank-line paragraphs", () => {
  expect(autop("<p>a</p>\n<p>b</p>")).toBe("<p>a</p>\n<p>b</p>");
  expect(autop("一つ目\n\n二つ目")).toBe("<p>一つ目</p>\n<p>二つ目</p>");
  expect(autop("<p>multi\nline</p>")).toBe("<p>multi\nline</p>");
  expect(autop("")).toBe("");
});

test("hrefFor encodes Japanese slugs and ends with a slash", () => {
  expect(hrefFor("works", "日本-x")).toBe("/works/%E6%97%A5%E6%9C%AC-x/");
  expect(hrefFor()).toBe("/");
  expect(decodeURIComponent(hrefFor("skill", "コミュニティ構築"))).toBe("/skill/コミュニティ構築/");
});
test("mediaSrc", () => {
  expect(mediaSrc(null)).toBeNull();
  expect(mediaSrc("2026/07/a b.jpg")).toBe("/media/2026/07/a%20b.jpg");
});
test("docTitle", () => {
  expect(docTitle(null)).toBe("小林慎之助 | 構想を、社会に実装する。");
  expect(docTitle("実績")).toBe("実績 | 小林慎之助");
});

test("paginationModel mirrors WP paginate_links (end_size=1, mid_size=1)", () => {
  const s = (a: ReturnType<typeof paginationModel>) => a.map((i) => (i.kind === "page" || i.kind === "current" ? `${i.kind === "current" ? "[" : ""}${i.n}${i.kind === "current" ? "]" : ""}` : i.kind === "dots" ? "…" : i.kind === "prev" ? "‹" : "›")).join(" ");
  expect(paginationModel(1, 1)).toEqual([]);
  expect(s(paginationModel(1, 3))).toBe("[1] 2 3 ›");
  expect(s(paginationModel(2, 3))).toBe("‹ 1 [2] 3 ›");
  expect(s(paginationModel(5, 10))).toBe("‹ 1 … 4 [5] 6 … 10 ›");
  expect(s(paginationModel(1, 10))).toBe("[1] 2 … 10 ›");
});

test("mediaEmbedIds extracts YouTube/Spotify ids from URLs or raw ids, rejects junk", () => {
  expect(mediaEmbedIds("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk")).toEqual({ yt: "dQw4w9WgXcQ", sp: "4rOoJ6Egrf8K2IrywzwOMk" });
  expect(mediaEmbedIds("https://youtu.be/dQw4w9WgXcQ", "")).toEqual({ yt: "dQw4w9WgXcQ", sp: "" });
  expect(mediaEmbedIds("dQw4w9WgXcQ", "4rOoJ6Egrf8K2IrywzwOMk")).toEqual({ yt: "dQw4w9WgXcQ", sp: "4rOoJ6Egrf8K2IrywzwOMk" });
  expect(mediaEmbedIds("javascript:alert(1)", undefined)).toEqual({ yt: "", sp: "" });
});

import { gradientClass } from "../src/lib/format.ts";
test("gradientClass keeps the WP theme's wp_id%6 mapping", () => {
  expect(gradientClass(10)).toBe("g5");
  expect(gradientClass(12)).toBe("g1");
});

test("autop: existing <br> is not doubled; multi-line headings, split opening tags and HTML5 sections stay intact", () => {
  expect(autop("a<br>\nb")).toBe("<p>a<br>\nb</p>");
  expect(autop("<h2>\nTitle\n</h2>\nafter")).toBe("<h2>\nTitle\n</h2>\n<p>after</p>");
  expect(autop('<div\n class="x">\nin\n</div>')).toBe('<div\n class="x">\nin\n</div>');
  expect(autop("<section>\nx\n</section>\ntail")).toBe("<section>\nx\n</section>\n<p>tail</p>");
});

test("docTitle in English", () => {
  expect(docTitle(null, "en")).toBe("Shinnosuke Kobayashi Official Website");
  expect(docTitle("Works", "en")).toBe("Works | Shinnosuke Kobayashi Official Website");
  expect(docTitle("実績", "ja")).toBe("実績 | 小林慎之助");
});
