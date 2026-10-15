import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { rssXml } from "../src/lib/seo.ts";
import { feedPosts } from "../src/lib/queries.ts";

test("rssXml: valid RSS 2.0 with escaped text, absolute links, RFC-822 dates and an atom self link", () => {
  const x = rssXml({ title: "A & B", description: "d<>", items: [{ title: `T "q" <b>`, path: "/works/a/", excerpt: "e & f", published_at: "2026-07-01 03:04:05", type: "works" }] });
  expect(x).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0" xmlns:atom=/);
  expect(x).toContain("<title>A &amp; B</title>"); expect(x).toContain("<description>d&lt;&gt;</description>");
  expect(x).toContain("<title>T &quot;q&quot; &lt;b&gt;</title>");
  expect(x).toContain("<link>https://shinnosuke-kobayashi.jp/works/a/</link>"); expect(x).toContain('<guid isPermaLink="true">https://shinnosuke-kobayashi.jp/works/a/</guid>');
  expect(x).toContain("<pubDate>Wed, 01 Jul 2026 03:04:05 GMT</pubDate>"); expect(x).toContain('<atom:link href="https://shinnosuke-kobayashi.jp/feed/" rel="self" type="application/rss+xml"/>');
  expect(x).toContain("<category>works</category>");
});
test("rssXml: an empty feed is still valid", () => {
  expect(rssXml({ title: "t", description: "d", items: [] })).toContain("</channel></rss>");
});
test("feedPosts: published works/column/news only, newest first, limited, with encoded paths", async () => {
  const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s);
  const items = await feedPosts(d1(raw), 2);
  expect(items).toHaveLength(2);
  expect(items.map((i) => i.published_at)).toEqual([...items.map((i) => i.published_at)].sort().reverse());
  expect(items.every((i) => /^\/(works|column|news)\/[^/]+\/$/.test(i.path))).toBe(true);
  expect(items.some((i) => i.path.includes("/page/") || i.path.includes("profile"))).toBe(false);
});
