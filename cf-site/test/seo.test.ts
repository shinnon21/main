import { expect, test } from "vitest";
import { canonicalPath, canonicalUrl, trimText, metaDescription, toIsoJst, personLd, articleLd, breadcrumbLd, websiteLd, robotsTxt, sitemapXml, llmsTxt, isStagingHost } from "../src/lib/seo.ts";

test("canonicalPath lowercases percent-escapes only (WP-compatible) and keeps the rest", () => {
  expect(canonicalPath("/works/%E6%97%A5%E6%9C%AC-X/")).toBe("/works/%e6%97%a5%e6%9c%ac-X/");
  expect(canonicalPath("/en/works/")).toBe("/en/works/");
  expect(canonicalUrl("/works/%E6%97%A5/")).toBe("https://shinnosuke-kobayashi.jp/works/%e6%97%a5/");
});
test("trimText strips tags, collapses whitespace and truncates with an ellipsis", () => {
  expect(trimText("<p>a  b\n</p><h2>c</h2>", 100)).toBe("a b c");
  expect(trimText("あいうえお", 3)).toBe("あいう…");
  expect(trimText("", 5)).toBe("");
});
test("metaDescription: excerpt > body > fallback per page kind, en/ja", () => {
  expect(metaDescription({ lang: "ja", kind: "post", excerpt: "抜粋", body: "<p>本文</p>" })).toBe("抜粋");
  expect(metaDescription({ lang: "ja", kind: "post", excerpt: "", body: "<p>本文です</p>" })).toBe("本文です");
  expect(metaDescription({ lang: "ja", kind: "term", name: "DX" })).toBe("DXに関する実績・記事の一覧です。");
  expect(metaDescription({ lang: "en", kind: "term", name: "DX" })).toBe("Works and articles related to DX.");
  expect(metaDescription({ lang: "en", kind: "archive", name: "Works" })).toBe("A list of Works by Shinnosuke Kobayashi.");
  expect(metaDescription({ lang: "ja", kind: "archive", name: "実績" })).toBe("実績の一覧です。");
  expect(metaDescription({ lang: "ja", kind: "site", siteDescription: "構想を、社会に実装する。" })).toBe("構想を、社会に実装する。");
  expect(metaDescription({ lang: "en", kind: "site", siteDescription: "x" })).toContain("official website of Shinnosuke Kobayashi");
});
test("toIsoJst converts WP GMT to +09:00", () => {
  expect(toIsoJst("2026-07-04 15:21:55")).toBe("2026-07-05T00:21:55+09:00");
});
test("JSON-LD builders mirror the theme", () => {
  const p = personLd({ lang: "ja", name: "小林 慎之助", bio: "<b>自己紹介</b>", sameAs: ["https://x.com/a"], image: "https://shinnosuke-kobayashi.jp/media/a.jpg" });
  expect(p).toMatchObject({ "@type": "Person", name: "小林 慎之助", alternateName: "Shinnosuke Kobayashi", url: "https://shinnosuke-kobayashi.jp/profile/", jobTitle: "共同創業者・代表取締役 CEO", sameAs: ["https://x.com/a"], image: "https://shinnosuke-kobayashi.jp/media/a.jpg" });
  expect(p.description).toBe("自己紹介");
  expect(personLd({ lang: "en", name: "S", bio: "", sameAs: [] })).toMatchObject({ alternateName: "小林 慎之助", url: "https://shinnosuke-kobayashi.jp/en/profile/", jobTitle: "Co-founder & CEO" });
  const a = articleLd({ lang: "ja", type: "news", title: "T", published: "2026-07-04 15:21:55", modified: "2026-07-05 00:00:00", path: "/news/x/", description: "d", image: "https://i/x.png", author: p });
  expect(a).toMatchObject({ "@type": "NewsArticle", headline: "T", datePublished: "2026-07-05T00:21:55+09:00", inLanguage: "ja", mainEntityOfPage: "https://shinnosuke-kobayashi.jp/news/x/", description: "d", image: "https://i/x.png" });
  expect(articleLd({ lang: "en", type: "works", title: "T", published: "2026-07-04 00:00:00", modified: "2026-07-04 00:00:00", path: "/en/works/x/", image: "i", author: p })).toMatchObject({ "@type": "Article", inLanguage: "en" });
  const b = breadcrumbLd({ lang: "en", listLabel: "Works", listPath: "/en/works/", title: "T" });
  expect(b.itemListElement.map((i: any) => [i.position, i.name, i.item])).toEqual([[1, "Home", "https://shinnosuke-kobayashi.jp/en/"], [2, "Works", "https://shinnosuke-kobayashi.jp/en/works/"], [3, "T", undefined]]);
  expect(websiteLd({ lang: "ja", name: "小林慎之助", description: "d" })).toMatchObject({ "@type": "WebSite", url: "https://shinnosuke-kobayashi.jp/", inLanguage: "ja", potentialAction: { target: { urlTemplate: "https://shinnosuke-kobayashi.jp/?s={search_term_string}" } } });
});
test("robotsTxt: production allows AI crawlers and points to the sitemap; staging disallows everything", () => {
  const prod = robotsTxt(false);
  expect(prod).toContain("User-agent: *");
  expect(prod).toContain("User-agent: GPTBot\nAllow: /");
  expect(prod).toContain("User-agent: ClaudeBot\nAllow: /");
  expect(prod).toContain("Sitemap: https://shinnosuke-kobayashi.jp/sitemap.xml");
  expect(prod).toContain("https://shinnosuke-kobayashi.jp/llms.txt");
  expect(robotsTxt(true)).toBe("User-agent: *\nDisallow: /\n");
  expect(isStagingHost("kb-site.curly-wave-c49f.workers.dev")).toBe(true);
  expect(isStagingHost("localhost:8787")).toBe(true);
  expect(isStagingHost("shinnosuke-kobayashi.jp")).toBe(false);
});
test("sitemapXml escapes, lists both languages with xhtml alternates and lastmod", () => {
  const xml = sitemapXml([{ path: "/works/a&b/", lastmod: "2026-07-04 15:21:55", alt: { ja: "/works/a&b/", en: "/en/works/a&b/" } }, { path: "/en/works/a&b/", lastmod: "2026-07-04 15:21:55", alt: { ja: "/works/a&b/", en: "/en/works/a&b/" } }]);
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  expect(xml).toContain("<loc>https://shinnosuke-kobayashi.jp/works/a&amp;b/</loc>");
  expect(xml).toContain("<lastmod>2026-07-04</lastmod>");
  expect(xml).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://shinnosuke-kobayashi.jp/en/works/a&amp;b/"/>');
  expect((xml.match(/<url>/g) ?? []).length).toBe(2);
});
test("llmsTxt follows the llmstxt.org layout used by the theme", () => {
  const t = llmsTxt({ name: "小林慎之助", description: "構想を、社会に実装する。", bio: "自己紹介", profileName: "小林 慎之助", kana: "こばやし", role: "CEO", research: "研究", works: [{ title: "実績A", path: "/works/a/", excerpt: "概要" }], columns: [{ title: "コラムB", path: "/column/b/", excerpt: "" }], sns: [{ label: "X", url: "https://x.com/a" }] });
  expect(t).toContain("# 小林慎之助\n\n> 構想を、社会に実装する。\n\n自己紹介");
  expect(t).toContain("- 名前: 小林 慎之助（こばやし）");
  expect(t).toContain("- [プロフィール](https://shinnosuke-kobayashi.jp/profile/): 経歴・スキル・研究テーマ・登壇歴");
  expect(t).toContain("## 実績\n\n- [実績A](https://shinnosuke-kobayashi.jp/works/a/): 概要");
  expect(t).toContain("## コラム\n\n- [コラムB](https://shinnosuke-kobayashi.jp/column/b/)");
  expect(t).toContain("## SNS\n\n- X: https://x.com/a");
});

import { sspOverrides } from "../src/lib/seo.ts";
test("sspOverrides reads SEO SIMPLE PACK custom fields for Japanese only, trims, ignores blanks", () => {
  const meta = { ssp_meta_title: " 独自タイトル｜小林慎之助 ", ssp_meta_description: "独自説明", ssp_meta_image: "/media/2026/07/a.jpeg" };
  expect(sspOverrides(meta, "ja")).toEqual({ title: "独自タイトル｜小林慎之助", description: "独自説明", image: "https://shinnosuke-kobayashi.jp/media/2026/07/a.jpeg" });
  expect(sspOverrides(meta, "en")).toEqual({});
  expect(sspOverrides({ ssp_meta_title: "  ", ssp_meta_image: 5 }, "ja")).toEqual({});
  expect(sspOverrides({ ssp_meta_image: "https://cdn.example/x.png" }, "ja")).toEqual({ image: "https://cdn.example/x.png" });
});
