import { SITE_URL, toJst } from "./format.ts";
import type { Lang } from "./i18n.ts";
import { l } from "./lang.ts";

/** WordPress が出力する canonical と揃えるため、%XX の16進だけ小文字にする（既にインデックス済みのURLと一致させる） */
export const canonicalPath = (path: string) => path.replace(/%[0-9A-Fa-f]{2}/g, (m) => m.toLowerCase());
export const canonicalUrl = (path: string) => SITE_URL + canonicalPath(path);

export function trimText(text: string, max: number): string {
  const s = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join("") + "…" : s;
}

type DescInput =
  | { lang: Lang; kind: "post"; excerpt?: string | null; body?: string | null }
  | { lang: Lang; kind: "term" | "archive"; name: string }
  | { lang: Lang; kind: "site"; siteDescription: string };
export function metaDescription(i: DescInput): string {
  const en = i.lang === "en";
  if (i.kind === "post") return i.excerpt?.trim() ? i.excerpt.trim() : trimText(i.body ?? "", 120);
  if (i.kind === "term") return en ? `Works and articles related to ${i.name}.` : `${i.name}に関する実績・記事の一覧です。`;
  if (i.kind === "archive") return en ? `A list of ${i.name} by Shinnosuke Kobayashi.` : `${i.name}の一覧です。`;
  return en ? "From political and governmental DX to pharmaceutical supply chain research — the official website of Shinnosuke Kobayashi." : i.siteDescription;
}

export function toIsoJst(utc: string): string {
  const d = toJst(utc);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+09:00`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ld = Record<string, any>;

export function personLd(i: { lang: Lang; name: string; bio: string; sameAs: string[]; image?: string | null }): Ld {
  const en = i.lang === "en";
  const person: Ld = {
    "@type": "Person",
    name: i.name,
    alternateName: en ? "小林 慎之助" : "Shinnosuke Kobayashi",
    url: canonicalUrl(l(i.lang, "/profile/")),
    jobTitle: en ? "Co-founder & CEO" : "共同創業者・代表取締役 CEO",
    description: trimText(i.bio, 120),
    affiliation: [{ "@type": "Organization", name: en ? "Weeave Inc." : "Weeave株式会社", url: "https://www.weeave.co.jp/" }],
    alumniOf: { "@type": "CollegeOrUniversity", name: en ? "University of Tsukuba" : "筑波大学" },
    knowsAbout: en
      ? ["Political & governmental DX", "Data analysis", "Business development", "Management science", "Pharmaceutical supply chains", "Election simulation", "Marketing & PR", "Community building"]
      : ["政治・行政のDX", "データ分析", "事業開発", "経営工学", "医薬品サプライチェーン", "選挙シミュレーション", "マーケティング・広報", "コミュニティ構築"],
    sameAs: i.sameAs,
  };
  if (i.image) person.image = i.image;
  return person;
}

export function articleLd(i: { lang: Lang; type: "works" | "column" | "news"; title: string; published: string; modified: string; path: string; description?: string; image: string; author: Ld }): Ld {
  const a: Ld = {
    "@type": i.type === "news" ? "NewsArticle" : "Article",
    headline: i.title,
    datePublished: toIsoJst(i.published),
    dateModified: toIsoJst(i.modified),
    inLanguage: i.lang,
    mainEntityOfPage: canonicalUrl(i.path),
    author: i.author,
  };
  if (i.description) a.description = i.description;
  a.image = i.image;
  return a;
}

export function breadcrumbLd(i: { lang: Lang; listLabel: string; listPath: string; title: string }): Ld {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: i.lang === "en" ? "Home" : "ホーム", item: canonicalUrl(l(i.lang, "/")) },
      { "@type": "ListItem", position: 2, name: i.listLabel, item: canonicalUrl(i.listPath) },
      { "@type": "ListItem", position: 3, name: i.title },
    ],
  };
}

export function websiteLd(i: { lang: Lang; name: string; description: string }): Ld {
  return {
    "@type": "WebSite",
    name: i.name,
    url: canonicalUrl(l(i.lang, "/")),
    inLanguage: i.lang,
    description: i.description,
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: canonicalUrl(l(i.lang, "/")) + "?s={search_term_string}" }, "query-input": "required name=search_term_string" },
  };
}

export const isStagingHost = (host: string) => /(^|\.)workers\.dev(:\d+)?$/.test(host) || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);

const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "CCBot", "meta-externalagent"];
export function robotsTxt(staging: boolean): string {
  if (staging) return "User-agent: *\nDisallow: /\n";
  let out = "User-agent: *\nAllow: /\nDisallow: /admin/\n\n# AIクローラーを明示的に許可（AI検索・アシスタントからの参照を歓迎）\n";
  for (const b of AI_BOTS) out += `User-agent: ${b}\nAllow: /\n\n`;
  out += `# LLM向けサイト概要: ${SITE_URL}/llms.txt\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export interface SitemapEntry { path: string; lastmod?: string; alt?: { ja: string; en: string } }
export function sitemapXml(entries: SitemapEntry[]): string {
  const rows = entries.map((e) => {
    const alt = e.alt ? `\n    <xhtml:link rel="alternate" hreflang="ja" href="${esc(canonicalUrl(e.alt.ja))}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${esc(canonicalUrl(e.alt.en))}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(canonicalUrl(e.alt.ja))}"/>` : "";
    const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : "";
    return `  <url>\n    <loc>${esc(canonicalUrl(e.path))}</loc>${lastmod}${alt}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join("\n")}\n</urlset>\n`;
}

export interface LlmsItem { title: string; path: string; excerpt?: string | null }
export function llmsTxt(i: { name: string; description: string; bio: string; profileName: string; kana: string; role: string; research: string; works: LlmsItem[]; columns: LlmsItem[]; sns: { label: string; url: string }[] }): string {
  const link = (x: LlmsItem) => `- [${x.title}](${canonicalUrl(x.path)})${x.excerpt ? ": " + x.excerpt : ""}`;
  const lines = [
    `# ${i.name}`, "", `> ${i.description}`, "", i.bio, "",
    `- 名前: ${i.profileName}（${i.kana}）`, `- 肩書: ${i.role}`, `- 研究テーマ: ${i.research}`, "",
    "## 主要ページ", "",
    `- [プロフィール](${SITE_URL}/profile/): 経歴・スキル・研究テーマ・登壇歴`,
    `- [実績一覧](${SITE_URL}/works/): プロジェクト実績のケーススタディ`,
    `- [コラム一覧](${SITE_URL}/column/): 政治・行政DXや社会実装に関する発信`,
    `- [お問い合わせ](${SITE_URL}/contact/)`,
  ];
  if (i.works.length) lines.push("", "## 実績", "", ...i.works.map(link));
  if (i.columns.length) lines.push("", "## コラム", "", ...i.columns.map(link));
  lines.push("", "## SNS", "", ...i.sns.map((s) => `- ${s.label}: ${s.url}`));
  return lines.join("\n") + "\n";
}

/** SEO SIMPLE PACK の個別設定（ssp_meta_*）。旧サイトは日本語ページでのみ出力していたため ja のみ適用する */
export function sspOverrides(meta: Record<string, unknown>, lang: Lang): { title?: string; description?: string; image?: string } {
  if (lang !== "ja") return {};
  const s = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string).trim() : "");
  const out: { title?: string; description?: string; image?: string } = {};
  if (s("ssp_meta_title")) out.title = s("ssp_meta_title");
  if (s("ssp_meta_description")) out.description = s("ssp_meta_description");
  const img = s("ssp_meta_image");
  if (img) out.image = img.startsWith("/") ? SITE_URL + img : img;
  return out;
}
