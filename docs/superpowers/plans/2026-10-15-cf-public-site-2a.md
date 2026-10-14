# サブプロジェクト2a「見た目の土台と主要ページ」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 確認用サイトで、日本語のトップ・実績/コラム/お知らせの一覧と詳細・タクソノミー一覧・404 を、現行WordPressテーマと同じ見た目で表示する。

**Architecture:** 既存の `style.css` と `main.js`・画像を無改変で移植し、PHPテンプレートをAstroコンポーネントに1対1で移す。データ取得・整形は `src/lib/` の純粋関数（`D1Like` を受け取る）に切り出してvitestで検証する。ページは薄いAstroファイルに留める。

**Tech Stack:** Astro 7 SSR（@astrojs/cloudflare 14）、D1/R2、TypeScript、vitest（`node:sqlite` シム）、Node 24。

**Spec:** `docs/superpowers/specs/2026-10-15-cf-public-site-2a-design.md`（親: `2026-10-14-cf-foundation-migration-design.md`）

## Global Constraints

- デザイントークン（`--crimson:#C22740` `--crimson-dark:#A61F35` `--deep:#84192A` `--tint:#F6D8DD` `--tint-light:#FBECEE` `--bg:#FDF9F9` `--ink:#1A1A1A` `--gray:#5C5C5C` `--line:#E6DCDE`）・ロゴ・CSS値は変更禁止。`style.css` は先頭のWPテーマヘッダーコメントを除き無改変で移植する。
- 移植元は `kobayashi-theme/`（読み取り専用。変更しない）。移植先は `cf-site/`。
- 2aは日本語のみ。文言は `t(lang, ja, en)` 形式で書き、ページは `lang="ja"` を渡す。
- 本番ドメイン・GCP・DNSには触れない。デプロイ先は確認用 `https://kb-site.curly-wave-c49f.workers.dev` のみ。
- 条件検索・お問い合わせ・/chat/・固定ページ・英語版・SEO詳細・閲覧数の書き込み・CMSは対象外（リンクは現行どおり出力し、リンク先404は許容）。
- URLは現行パスを維持: `/works/…` `/column/…` `/news/…` `/works_type/<slug>/` `/skill/<slug>/` `/industry/<slug>/` `/news_type/<slug>/`、ページネーションは `/<type>/page/<n>/`。
- 日本語スラッグはDB上デコード済み。`href` ではパーセントエンコードして出力する。
- 日時はDBがUTC（WP `post_date_gmt`）。表示はJST（+9h）で `YYYY.MM.DD`。
- 件数: 実績一覧12/ページ、コラム10、お知らせ15、トップ（主な実績4・お知らせ3・新着コラム4・ティッカー14）、ランキング5。
- テストコマンド: `npm --prefix cf-site test`。`bash -c` を含むコマンドは使わない。

## Review Focus

- 本文が `<p>` を含まず、見出し・リストと素のテキスト行が混在する記事（works 11/13、news 17）→ 素のテキストが `<p>` で包まれる（Task 2）
- アイキャッチ未設定の記事（25件中11件）→ グラデーション代替＋ラベルで崩れない（Task 6）
- 日本語スラッグの記事・タームへのリンクがパーセントエンコードされ、そのURLで200になる（Task 2, 9）
- 範囲外のページ番号（`/works/page/99/`）は404、`/works/page/1/` は `/works/` へ301（Task 4, 8）
- UTC→JSTの日付境界（2026-06-30T16:00Z は 2026.07.01）（Task 2）
- 主な実績がフラグ0件のときは新着へフォールバック／お知らせ・コラムが0件でもセクションを出さずに落ちない（Task 3, 7）
- 旧uploads URLの301でクエリ・パスが保たれ、`/media/…` や拡張子付きパスはループしない（Task 4）

## File Structure

```
cf-site/
  public/assets/main.js, public/assets/img/*            # 無改変コピー
  src/styles/global.css                                   # style.css（ヘッダーコメント除去）
  src/lib/i18n.ts           # Lang, t()
  src/lib/format.ts         # formatDate, autop, hrefFor, mediaSrc, docTitle, paginationModel, mediaEmbedIds
  src/lib/posts.ts          # 既存: 列追加（wp_id, excerpt, modified_at）
  src/lib/queries.ts        # 一覧/トップ/ランキング/関連/ターム/プロフィール
  src/lib/redirects.ts      # normalizeRequest(url)
  src/lib/sns.ts            # SNSアカウント＋SVG（functions.phpから生成）
  src/middleware.ts         # redirects.ts を適用
  src/components/Layout.astro, Thumb.astro, WorksCard.astro, ColumnCard.astro,
                 PageHero.astro, Pagination.astro, SideRanking.astro, TagBox.astro, SnsLinks.astro, Share.astro
  src/pages/index.astro
  src/pages/[type]/index.astro, [type]/page/[n].astro, [type]/[slug].astro
  src/pages/works_type/[slug].astro, skill/[slug].astro, industry/[slug].astro, news_type/[slug].astro
  src/pages/404.astro
  test/format.test.ts, queries.test.ts, redirects.test.ts, assets.test.ts, sns.test.ts
```

---

### Task 1: 資産の無改変移植

**Files:**
- Create: `cf-site/src/styles/global.css`, `cf-site/public/assets/main.js`, `cf-site/public/assets/img/*`, `cf-site/test/assets.test.ts`

**Interfaces:**
- Produces: `/assets/main.js`、`/assets/img/<file>`（logo-horizontal.svg, logo-mark.png, favicon-32.png, favicon-192.png, apple-touch-icon.png, kobayashi-hero.webp, og-default.png, kb-avatar-face.jpg）、`src/styles/global.css`。

- [ ] **Step 1: 失敗するテストを書く**

`test/assets.test.ts`:
```ts
import { expect, test } from "vitest";
import { readFileSync, existsSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

test("global.css equals theme style.css minus the WP header comment", () => {
  const theme = read("kobayashi-theme/style.css");
  const body = theme.replace(/^\/\*[\s\S]*?\*\/\s*/, "");
  expect(read("cf-site/src/styles/global.css")).toBe(body);
});
test("design tokens are unchanged", () => {
  const css = read("cf-site/src/styles/global.css");
  for (const tok of ["--crimson:#C22740", "--crimson-dark:#A61F35", "--deep:#84192A", "--tint:#F6D8DD", "--tint-light:#FBECEE", "--bg:#FDF9F9", "--ink:#1A1A1A", "--gray:#5C5C5C", "--line:#E6DCDE"]) expect(css).toContain(tok);
});
test("main.js and images are copied byte-for-byte", () => {
  expect(read("cf-site/public/assets/main.js")).toBe(read("kobayashi-theme/assets/main.js"));
  for (const f of ["logo-horizontal.svg", "logo-mark.png", "favicon-32.png", "favicon-192.png", "apple-touch-icon.png", "kobayashi-hero.webp", "og-default.png", "kb-avatar-face.jpg"])
    expect(existsSync(new URL(`cf-site/public/assets/img/${f}`, root)), f).toBe(true);
});
```
- [ ] **Step 2: 失敗を確認** — `npm --prefix cf-site test -- assets` → FAIL（ファイルなし）
- [ ] **Step 3: コピーを実行**
```bash
cd cf-site && mkdir -p src/styles public/assets/img
perl -0pe 's/^\/\*[\s\S]*?\*\/\s*//' ../kobayashi-theme/style.css > src/styles/global.css
cp ../kobayashi-theme/assets/main.js public/assets/main.js
cp ../kobayashi-theme/assets/img/* public/assets/img/
```
- [ ] **Step 4: 成功を確認** — `npm --prefix cf-site test -- assets` → PASS（3件）
- [ ] **Step 5: Commit** — `git add cf-site && git commit -m "feat(cf-site): port theme CSS, main.js and images verbatim"`（Co-Authored-By付き）

---

### Task 2: 整形ライブラリ（i18n・日付・autop・リンク・ページネーション・埋め込みID）

**Files:**
- Create: `cf-site/src/lib/i18n.ts`, `cf-site/src/lib/format.ts`, `cf-site/test/format.test.ts`

**Interfaces:**
- Produces:
```ts
// i18n.ts
export type Lang = "ja" | "en";
export const t: (lang: Lang, ja: string, en: string) => string;
// format.ts
export const SITE_URL = "https://shinnosuke-kobayashi.jp";
export function toJst(utc: string): Date;                       // 'YYYY-MM-DD HH:MM:SS' or ISO (UTC) -> Date shifted +9h (read with getUTC*)
export function formatDate(utc: string): string;               // 'YYYY.MM.DD' (JST)
export function autop(html: string): string;
export function hrefFor(...segments: string[]): string;        // '/works/日本語/' -> encoded, trailing slash
export function mediaSrc(thumbnail: string | null): string | null; // '/media/<key>' (each segment encoded)
export function docTitle(title: string | null): string;        // null -> '小林慎之助 | 構想を、社会に実装する。', else `${title} | 小林慎之助`
export interface PageItem { kind: "prev" | "next" | "page" | "current" | "dots"; n?: number }
export function paginationModel(current: number, total: number, mid?: number): PageItem[]; // WP paginate_links(end_size=1, mid_size=1)
export function mediaEmbedIds(youtube: unknown, spotify: unknown): { yt: string; sp: string };
```

- [ ] **Step 1: 失敗するテストを書く**

`test/format.test.ts`:
```ts
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
```
- [ ] **Step 2: 失敗を確認** — `npm --prefix cf-site test -- format` → FAIL（モジュールなし）
- [ ] **Step 3: 実装**

`src/lib/i18n.ts`:
```ts
export type Lang = "ja" | "en";
export const t = (lang: Lang, ja: string, en: string): string => (lang === "en" ? en : ja);
```
`src/lib/format.ts`:
```ts
export const SITE_URL = "https://shinnosuke-kobayashi.jp";

export function toJst(utc: string): Date {
  const iso = utc.includes("T") ? utc : utc.replace(" ", "T");
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : iso + "Z");
  return new Date(d.getTime() + 9 * 3600_000);
}
export function formatDate(utc: string): string {
  const d = toJst(utc);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

const CONTAINERS = "ul|ol|table|blockquote|figure|div|pre|dl|iframe|script|style|p";
const BLOCK_START = new RegExp(`^\\s*<(?:h[1-6]|hr|${CONTAINERS})\\b`, "i");
const delta = (line: string): number => {
  const open = (line.match(new RegExp(`<(?:${CONTAINERS})\\b[^>]*[^/]>|<(?:${CONTAINERS})>`, "gi")) ?? []).length;
  const close = (line.match(new RegExp(`</(?:${CONTAINERS})>`, "gi")) ?? []).length;
  return open - close;
};
export function autop(html: string): string {
  const out: string[] = [];
  let buf: string[] = [];
  let depth = 0;
  const flush = () => { if (buf.length) { out.push(`<p>${buf.join("<br>\n")}</p>`); buf = []; } };
  for (const raw of html.replace(/\r\n?/g, "\n").split("\n")) {
    if (depth > 0) { out.push(raw); depth += delta(raw); continue; }
    if (raw.trim() === "") { flush(); continue; }
    if (BLOCK_START.test(raw)) { flush(); out.push(raw); depth = Math.max(0, delta(raw)); continue; }
    buf.push(raw.trim());
  }
  flush();
  return out.join("\n");
}

export function hrefFor(...segments: string[]): string {
  return "/" + segments.map((s) => encodeURIComponent(s) + "/").join("");
}
export function mediaSrc(thumbnail: string | null): string | null {
  return thumbnail ? "/media/" + thumbnail.split("/").map(encodeURIComponent).join("/") : null;
}
export function docTitle(title: string | null): string {
  return title ? `${title} | 小林慎之助` : "小林慎之助 | 構想を、社会に実装する。";
}

export interface PageItem { kind: "prev" | "next" | "page" | "current" | "dots"; n?: number }
export function paginationModel(current: number, total: number, mid = 1): PageItem[] {
  if (total <= 1) return [];
  const items: PageItem[] = [];
  if (current > 1) items.push({ kind: "prev", n: current - 1 });
  let dots = false;
  for (let n = 1; n <= total; n++) {
    if (n === current) { items.push({ kind: "current", n }); dots = true; }
    else if (n <= 1 || (n >= current - mid && n <= current + mid) || n > total - 1) { items.push({ kind: "page", n }); dots = true; }
    else if (dots) { items.push({ kind: "dots" }); dots = false; }
  }
  if (current < total) items.push({ kind: "next", n: current + 1 });
  return items;
}

const YT = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|watch\?(?:[^\s"']*&)?v=))([A-Za-z0-9_-]{11})/;
const SP = /open\.spotify\.com\/(?:embed\/)?episode\/([A-Za-z0-9]{22})/;
export function mediaEmbedIds(youtube: unknown, spotify: unknown): { yt: string; sp: string } {
  const y = typeof youtube === "string" ? youtube.trim() : "";
  const s = typeof spotify === "string" ? spotify.trim() : "";
  const yt = y.match(YT)?.[1] ?? (/^[A-Za-z0-9_-]{11}$/.test(y) ? y : "");
  const sp = s.match(SP)?.[1] ?? (/^[A-Za-z0-9]{22}$/.test(s) ? s : "");
  return { yt, sp };
}
```
- [ ] **Step 4: 成功確認** — `npm --prefix cf-site test -- format` → PASS。autopのテストが落ちる場合は `delta`/`BLOCK_START` を調整してから次へ（テストを弱めない）。
- [ ] **Step 5: Commit** — `feat(cf-site): format helpers (JST dates, autop, hrefs, pagination, embeds)`

---

### Task 3: クエリ層

**Files:**
- Modify: `cf-site/src/lib/posts.ts`（`PostRow` に `wp_id`, `excerpt`, `modified_at` を追加し `COLS` に反映）
- Create: `cf-site/src/lib/queries.ts`, `cf-site/test/queries.test.ts`
- Modify: `cf-site/test/posts.test.ts`（必要なら列追加に追従。既存アサーションは弱めない）

**Interfaces:**
- Consumes: `D1Like`、`PostRow`（Task 8 of sub-project 1）。
- Produces:
```ts
export interface TermRef { taxonomy: string; slug: string; name: string }
export interface CardPost extends PostRow { terms: TermRef[]; meta: { period_start?: string; period_end?: string } }
export const PER_PAGE: Record<"works" | "column" | "news", number>;           // 12 / 10 / 15
export function listPage(db: D1Like, type: string, page: number): Promise<{ posts: CardPost[]; total: number; pages: number }>;
export function featuredWorks(db: D1Like, n?: number): Promise<CardPost[]>;      // is_featured, 0件なら新着へフォールバック
export function latest(db: D1Like, type: string, n: number): Promise<CardPost[]>;
export function topSkills(db: D1Like, n: number): Promise<TermRef[]>;            // 件数降順
export function allSkills(db: D1Like): Promise<TermRef[]>;
export function ranking(db: D1Like, n?: number): Promise<CardPost[]>;            // works+column, views降順
export function relatedByTerm(db: D1Like, post: { id: number; type: string }, taxonomy: string, n?: number): Promise<CardPost[]>;
export function termBySlug(db: D1Like, taxonomy: string, slug: string): Promise<TermRef | null>;
export function listByTerm(db: D1Like, taxonomy: string, slug: string, page: number, perPage: number): Promise<{ posts: CardPost[]; total: number; pages: number }>;
export function profileSummary(db: D1Like): Promise<{ kana: string; name: string; role: string; avatar: string | null }>;
export function postTerms(db: D1Like, postId: number): Promise<TermRef[]>;
```

- [ ] **Step 1: 失敗するテストを書く**

`test/queries.test.ts` は `buildImportSql` でフィクスチャを投入し `d1()` シムで検証する。フィクスチャ（`test/fixtures/export.ts`）に、このタスクのために次を**追加**する（既存の投稿・件数は変えない。新規投稿は別fixtureとしてテスト内で `structuredClone(exp)` に足す）:
```ts
import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { listPage, featuredWorks, latest, topSkills, ranking, relatedByTerm, termBySlug, listByTerm, profileSummary, PER_PAGE } from "../src/lib/queries.ts";

function db(mut?: (e: typeof exp) => void) {
  const e = structuredClone(exp); mut?.(e);
  const raw = newDb(); for (const s of buildImportSql(e).statements) raw.exec(s);
  return d1(raw);
}
const mk = (id: number, type: string, slug: string, date: string, extra: object = {}) =>
  ({ ...exp.posts[1], id, type, slug, title: slug, date, modified: date, thumbnail_id: null, terms: [], meta: {}, views: 0, ...extra });

test("PER_PAGE matches the WP theme", () => { expect(PER_PAGE).toEqual({ works: 12, column: 10, news: 15 }); });

test("listPage paginates newest-first and reports totals", async () => {
  const q = db((e) => { for (let i = 0; i < 13; i++) e.posts.push(mk(100 + i, "works", `w${i}`, `2026-0${1 + (i % 9)}-15T00:00:00`)); });
  const p1 = await listPage(q, "works", 1);
  expect(p1.total).toBe(15); expect(p1.pages).toBe(2); expect(p1.posts).toHaveLength(12);
  const p2 = await listPage(q, "works", 2);
  expect(p2.posts).toHaveLength(3);
  expect((await listPage(q, "works", 3)).posts).toEqual([]);
});
test("listPage attaches terms and period meta for cards", async () => {
  const q = db((e) => { e.posts[0].meta.period_start = "2025.09"; });
  const a = (await listPage(q, "works", 1)).posts.find((p) => p.slug === "site-a")!;
  expect(a.terms.map((t) => t.slug).sort()).toEqual(["seo", "web"]);
  expect(a.meta.period_start).toBe("2025.09");
});
test("featuredWorks uses is_featured and falls back to newest when none flagged", async () => {
  const flagged = db((e) => { e.posts[1].meta.is_featured = "1"; });
  expect((await featuredWorks(flagged)).map((p) => p.slug)).toEqual(["site-b"]);
  const none = db();
  expect((await featuredWorks(none)).map((p) => p.slug)).toEqual(["site-a", "site-b"]);
});
test("latest returns [] for empty types and never throws", async () => {
  expect(await latest(db(), "column", 4)).toEqual([]);
  expect((await latest(db(), "works", 1))).toHaveLength(1);
});
test("topSkills orders by usage count", async () => {
  const q = db((e) => {
    e.terms.push({ taxonomy: "skill", slug: "dx", name: "DX", description: "" });
    e.posts[0].terms.push({ taxonomy: "skill", slug: "dx" });
    e.posts[1].terms.push({ taxonomy: "skill", slug: "dx" });
  });
  expect((await topSkills(q, 14))[0].slug).toBe("dx");
});
test("ranking orders works+column by views and excludes news/page", async () => {
  const q = db((e) => { e.posts[1].views = 99; });
  const r = await ranking(q, 5);
  expect(r.map((p) => p.slug)).toEqual(["site-b", "site-a"]);
});
test("relatedByTerm returns same-term posts excluding itself", async () => {
  const q = db((e) => { e.posts[1].terms.push({ taxonomy: "works_type", slug: "web" }); });
  const a = (await listPage(q, "works", 1)).posts.find((p) => p.slug === "site-a")!;
  expect((await relatedByTerm(q, a, "works_type", 3)).map((p) => p.slug)).toEqual(["site-b"]);
});
test("termBySlug / listByTerm", async () => {
  const q = db();
  expect(await termBySlug(q, "skill", "seo")).toMatchObject({ slug: "seo", name: "SEO" });
  expect(await termBySlug(q, "skill", "nope")).toBeNull();
  const r = await listByTerm(q, "skill", "seo", 1, 10);
  expect(r.total).toBe(1); expect(r.posts[0].slug).toBe("site-a");
});
test("profileSummary falls back to defaults when meta is empty and uses meta when present", async () => {
  const empty = await profileSummary(db((e) => { e.posts[4].meta = {}; }));
  expect(empty.name).toBe("小林 慎之助");
  const set = await profileSummary(db());
  expect(set.name).toBe("小林慎之助");
});
```
（フィクスチャの `profile` ページは `meta: { profile_name: "小林慎之助" }` を持つ。アバターはprofileページの `thumbnail`。）
- [ ] **Step 2: 失敗を確認** — `npm --prefix cf-site test -- queries` → FAIL
- [ ] **Step 3: `posts.ts` の列を拡張**: `PostRow` に `wp_id: number; excerpt: string | null; modified_at: string;` を追加し、`COLS` を `"id,wp_id,type,slug,title,title_en,excerpt,content,content_en,thumbnail,published_at,modified_at"` に更新。
- [ ] **Step 4: `queries.ts` を実装**

```ts
import type { D1Like } from "./d1.ts";
import type { PostRow } from "./posts.ts";

export interface TermRef { taxonomy: string; slug: string; name: string }
export interface CardPost extends PostRow { terms: TermRef[]; meta: { period_start?: string; period_end?: string } }
export const PER_PAGE = { works: 12, column: 10, news: 15 } as const;

const COLS = "p.id,p.wp_id,p.type,p.slug,p.title,p.title_en,p.excerpt,p.content,p.content_en,p.thumbnail,p.published_at,p.modified_at";
const ph = (n: number) => Array(n).fill("?").join(",");

async function rows<T>(db: D1Like, sql: string, ...args: unknown[]): Promise<T[]> {
  return (await db.prepare(sql).bind(...args).all<T>()).results;
}
const one = async <T>(db: D1Like, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args).first<T>();
const parse = (v: string) => { try { const x = JSON.parse(v); return typeof x === "string" ? x : String(x ?? ""); } catch { return ""; } };

async function decorate(db: D1Like, posts: PostRow[]): Promise<CardPost[]> {
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const terms = await rows<TermRef & { post_id: number }>(db,
    `SELECT pt.post_id, t.taxonomy, t.slug, t.name FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id IN (${ph(ids.length)}) ORDER BY t.id`, ...ids);
  const metas = await rows<{ post_id: number; key: string; value: string }>(db,
    `SELECT post_id,key,value FROM post_meta WHERE post_id IN (${ph(ids.length)}) AND key IN ('period_start','period_end')`, ...ids);
  return posts.map((p) => ({
    ...p,
    terms: terms.filter((t) => t.post_id === p.id).map(({ taxonomy, slug, name }) => ({ taxonomy, slug, name })),
    meta: Object.fromEntries(metas.filter((m) => m.post_id === p.id).map((m) => [m.key, parse(m.value)])),
  }));
}

export async function listPage(db: D1Like, type: string, page: number) {
  const per = PER_PAGE[type as keyof typeof PER_PAGE] ?? 12;
  const total = (await one<{ c: number }>(db, "SELECT COUNT(*) c FROM posts p WHERE p.type=? AND p.status='publish'", type))?.c ?? 0;
  const posts = await rows<PostRow>(db,
    `SELECT ${COLS} FROM posts p WHERE p.type=? AND p.status='publish' ORDER BY p.published_at DESC, p.id DESC LIMIT ? OFFSET ?`, type, per, (Math.max(1, page) - 1) * per);
  return { posts: await decorate(db, posts), total, pages: Math.max(1, Math.ceil(total / per)) };
}

export async function latest(db: D1Like, type: string, n: number): Promise<CardPost[]> {
  return decorate(db, await rows<PostRow>(db,
    `SELECT ${COLS} FROM posts p WHERE p.type=? AND p.status='publish' ORDER BY p.published_at DESC, p.id DESC LIMIT ?`, type, n));
}

export async function featuredWorks(db: D1Like, n = 4): Promise<CardPost[]> {
  const flagged = await rows<PostRow>(db,
    `SELECT ${COLS} FROM posts p JOIN post_meta m ON m.post_id=p.id AND m.key='is_featured'
     WHERE p.type='works' AND p.status='publish' AND m.value IN ('"1"','1','true') ORDER BY p.published_at DESC, p.id DESC LIMIT ?`, n);
  return flagged.length ? decorate(db, flagged) : latest(db, "works", n);
}

export async function topSkills(db: D1Like, n: number): Promise<TermRef[]> {
  return rows<TermRef>(db,
    `SELECT t.taxonomy,t.slug,t.name FROM terms t JOIN post_terms pt ON pt.term_id=t.id JOIN posts p ON p.id=pt.post_id AND p.status='publish'
     WHERE t.taxonomy='skill' GROUP BY t.id ORDER BY COUNT(*) DESC, t.id LIMIT ?`, n);
}
export async function allSkills(db: D1Like): Promise<TermRef[]> { return topSkills(db, 1000); }

export async function ranking(db: D1Like, n = 5): Promise<CardPost[]> {
  return decorate(db, await rows<PostRow>(db,
    `SELECT ${COLS} FROM posts p JOIN views v ON v.post_id=p.id WHERE p.type IN ('works','column') AND p.status='publish' ORDER BY v.count DESC, p.id LIMIT ?`, n));
}

export async function relatedByTerm(db: D1Like, post: { id: number; type: string }, taxonomy: string, n = 3): Promise<CardPost[]> {
  return decorate(db, await rows<PostRow>(db,
    `SELECT DISTINCT ${COLS} FROM posts p JOIN post_terms pt ON pt.post_id=p.id JOIN terms t ON t.id=pt.term_id
     WHERE p.type=? AND p.status='publish' AND p.id<>? AND t.taxonomy=?
       AND t.id IN (SELECT pt2.term_id FROM post_terms pt2 JOIN terms t2 ON t2.id=pt2.term_id WHERE pt2.post_id=? AND t2.taxonomy=?)
     ORDER BY p.published_at DESC LIMIT ?`, post.type, post.id, taxonomy, post.id, taxonomy, n));
}

export const termBySlug = (db: D1Like, taxonomy: string, slug: string) =>
  one<TermRef>(db, "SELECT taxonomy,slug,name FROM terms WHERE taxonomy=? AND slug=?", taxonomy, slug);

export async function listByTerm(db: D1Like, taxonomy: string, slug: string, page: number, perPage: number) {
  const from = `FROM posts p JOIN post_terms pt ON pt.post_id=p.id JOIN terms t ON t.id=pt.term_id WHERE t.taxonomy=? AND t.slug=? AND p.status='publish'`;
  const total = (await one<{ c: number }>(db, `SELECT COUNT(*) c ${from}`, taxonomy, slug))?.c ?? 0;
  const posts = await rows<PostRow>(db, `SELECT ${COLS} ${from} ORDER BY p.published_at DESC, p.id DESC LIMIT ? OFFSET ?`, taxonomy, slug, perPage, (Math.max(1, page) - 1) * perPage);
  return { posts: await decorate(db, posts), total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export const postTerms = (db: D1Like, postId: number) =>
  rows<TermRef>(db, "SELECT t.taxonomy,t.slug,t.name FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id=? ORDER BY t.id", postId);

const PROFILE_DEFAULTS = {
  kana: "こばやし しんのすけ",
  name: "小林 慎之助",
  role: "Weeave株式会社 共同創業者・代表取締役 CEO ／ 筑波大学 理工学群 社会工学類 経営工学主専攻",
};
export async function profileSummary(db: D1Like) {
  const p = await one<{ id: number; thumbnail: string | null }>(db, "SELECT id,thumbnail FROM posts WHERE type='page' AND slug='profile' AND status='publish'");
  const m = p ? await rows<{ key: string; value: string }>(db, "SELECT key,value FROM post_meta WHERE post_id=? AND key IN ('profile_kana','profile_name','profile_role')", p.id) : [];
  const get = (k: string, d: string) => { const v = parse(m.find((x) => x.key === k)?.value ?? '""').trim(); return v || d; };
  return { kana: get("profile_kana", PROFILE_DEFAULTS.kana), name: get("profile_name", PROFILE_DEFAULTS.name), role: get("profile_role", PROFILE_DEFAULTS.role), avatar: p?.thumbnail ?? null };
}
```
- [ ] **Step 5: 成功確認** — `npm --prefix cf-site test` → 全PASS
- [ ] **Step 6: Commit** — `feat(cf-site): query layer for lists, home, ranking, terms, profile`

---

### Task 4: リダイレクト規則とミドルウェア

**Files:**
- Create: `cf-site/src/lib/redirects.ts`, `cf-site/src/middleware.ts`, `cf-site/test/redirects.test.ts`
- Modify: `cf-site/astro.config.mjs`（`trailingSlash: "ignore"` は維持）

**Interfaces:**
- Produces: `normalizeRequest(url: URL): { status: 301; location: string } | null`。規則（上から順）:
  1. `/wp-content/uploads/<rest>` → `/media/<rest>`（クエリ保持）
  2. パス末尾が `/` でなく、最終セグメントに `.` を含まない（拡張子なし）→ 末尾 `/` 付き（クエリ保持）
  3. `/<type>/page/1/`（type∈works,column,news）→ `/<type>/`
  4. 上記に当たらなければ `null`。`/media/…`、`/assets/…`、`/_astro/…`、拡張子付きパスは対象外（2・3を適用しない）。

- [ ] **Step 1: 失敗するテストを書く**
```ts
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
```
- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 実装**
```ts
export function normalizeRequest(url: URL): { status: 301; location: string } | null {
  const { pathname, search } = url;
  const legacy = pathname.match(/^\/wp-content\/uploads\/(.+)$/);
  if (legacy) return { status: 301, location: `/media/${legacy[1]}${search}` };
  if (/^\/(media|assets|_astro)(\/|$)/.test(pathname)) return null;
  const last = pathname.split("/").pop() ?? "";
  if (!pathname.endsWith("/") && !last.includes(".")) return { status: 301, location: `${pathname}/${search}` };
  const p1 = pathname.match(/^\/(works|column|news)\/page\/1\/$/);
  if (p1) return { status: 301, location: `/${p1[1]}/${search}` };
  return null;
}
```
`src/middleware.ts`:
```ts
import { defineMiddleware } from "astro:middleware";
import { normalizeRequest } from "./lib/redirects.ts";

export const onRequest = defineMiddleware((ctx, next) => {
  const r = normalizeRequest(ctx.url);
  return r ? ctx.redirect(r.location, r.status) : next();
});
```
- [ ] **Step 4: 成功確認** — `npm --prefix cf-site test -- redirects` → PASS
- [ ] **Step 5: Commit** — `feat(cf-site): URL normalization middleware`

---

### Task 5: SNSデータ生成とLayout

**Files:**
- Create: `cf-site/scripts/gen-sns.ts`（一度きり実行）, `cf-site/src/lib/sns.ts`（生成物）, `cf-site/test/sns.test.ts`, `cf-site/src/components/SnsLinks.astro`, `cf-site/src/components/Layout.astro`

**Interfaces:**
- Produces:
  - `sns.ts`: `export const SNS: { key: "linkedin"|"facebook"|"x"|"instagram"|"note"; label: string; url: string; svg: string }[]`（`kb_sns_accounts()`＋`kb_sns_links()` のSVG文字列を `functions.php` から機械的に転記）
  - `SnsLinks.astro`: props `{ style?: "pill" | "icons" }`（HTMLは `kb_sns_links` と同一: `.sns-row[.sns-icons] > a.sns-btn[href,target=_blank,rel=noopener,aria-label(icons時)] > svg + span(pill時)`。Instagramグラデーションidは `kbIgGrad<連番>` で重複回避）
  - `Layout.astro`: props `{ title: string; description?: string; lang?: Lang; bodyClass?: string }`。`<head>` に charset/viewport/`<title>`/description、Google Fonts（`https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans+JP:wght@400;500;700;900&display=swap`）、favicon（`/assets/img/favicon-32.png` `sizes=32x32`、`/assets/img/favicon-192.png` `sizes=192x192`、`apple-touch-icon.png`）、`global.css` をimport、`<script src="/assets/main.js" defer>`。`<header class="site">` はheader.php、`<footer class="site-footer">` はfooter.phpと同一マークアップ（検索フォームの`action="/"`、ロゴは`/assets/img/logo-horizontal.svg`（width/heightは`header.php`の値をそのまま）、ナビは`kb_default_nav()`の6項目: 実績 works / コラム column / お知らせ news / AIチャット chat / プロフィール profile / About このサイトについて、各`<li><a href><文字><small>英語or日本語</small></a></li>`、モバイル用`.gnav-extra`は検索・SNS(pill)・CTAを含む。言語切替(`kb_lang_switcher`)は2cまで出力しない。フッターのサイト名は「小林慎之助 公式ホームページ」、サブは`shinnosuke-kobayashi.jp`、説明文は`footer.php`の日本語文をそのまま、年は実行時の西暦）

- [ ] **Step 1: 失敗するテストを書く**
```ts
import { expect, test } from "vitest";
import { SNS } from "../src/lib/sns.ts";
test("SNS list mirrors kb_sns_accounts with inline SVG", () => {
  expect(SNS.map((s) => s.key)).toEqual(["linkedin", "facebook", "x", "instagram", "note"]);
  expect(SNS.find((s) => s.key === "x")!.url).toBe("https://x.com/snnnuke");
  for (const s of SNS) { expect(s.svg).toMatch(/^<svg[\s\S]*<path[\s\S]*<\/svg>$/); expect(s.url).toMatch(/^https:\/\//); }
});
```
- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 生成スクリプトを書いて実行**

`scripts/gen-sns.ts`:
```ts
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("../../kobayashi-theme/functions.php", import.meta.url), "utf8");
const accounts = [...src.matchAll(/'(\w+)'\s*=>\s*array\(\s*'label'\s*=>\s*'([^']+)',\s*'url'\s*=>\s*'([^']+)'\s*\)/g)].map((m) => ({ key: m[1], label: m[2], url: m[3] }));
const svgs = Object.fromEntries([...src.matchAll(/'(linkedin|facebook|instagram|x|note)'\s*=>\s*'(<svg[\s\S]*?<\/svg>)',/g)].map((m) => [m[1], m[2]]));
if (accounts.length !== 5 || Object.keys(svgs).length !== 5) throw new Error(`parse failed: ${accounts.length} accounts, ${Object.keys(svgs).length} svgs`);
const out = accounts.map((a) => ({ ...a, svg: svgs[a.key] }));
writeFileSync(new URL("../src/lib/sns.ts", import.meta.url), `// 生成物: scripts/gen-sns.ts（kobayashi-theme/functions.php の kb_sns_accounts / kb_sns_links より）\nexport const SNS: { key: "linkedin" | "facebook" | "x" | "instagram" | "note"; label: string; url: string; svg: string }[] = ${JSON.stringify(out, null, 2)} as never;\n`);
```
`node cf-site/scripts/gen-sns.ts` を実行（生成した `sns.ts` はコミットする）。
- [ ] **Step 4: SnsLinks.astro と Layout.astro を実装**（上記Interfaces記載のマークアップ。`header.php`/`footer.php` を並べて読み、クラス名・構造を一致させる。`Astro.url.pathname` でナビのactive表現は現行に無いので付けない）
- [ ] **Step 5: 検証** — `npm --prefix cf-site test` → 全PASS。`npm --prefix cf-site run build` がエラー無しで完了すること。
- [ ] **Step 6: Commit** — `feat(cf-site): Layout, SNS links`

---

### Task 6: 共通コンポーネント

**Files:**
- Create: `cf-site/src/components/Thumb.astro`, `WorksCard.astro`, `ColumnCard.astro`, `PageHero.astro`, `Pagination.astro`, `SideRanking.astro`, `TagBox.astro`, `Share.astro`, `Chips.astro`

**Interfaces:**
- Consumes: `CardPost`, `TermRef`, `ranking()`, `formatDate`, `hrefFor`, `mediaSrc`, `paginationModel`, `t`。
- Produces（すべて既存PHPと同一のクラス/構造）:
  - `Thumb.astro` props `{ post: CardPost; cls?: string }` → `<div class="{cls ?? 'thumb'} g{wp_id%6+1}"><img src=mediaSrc loading="lazy" alt=""> (画像がある場合のみ)<span class="ph-label">{最初のworks_type名 or type大文字}</span></div>`
  - `Chips.astro` props `{ terms: TermRef[]; limit?: number; linked?: boolean }` → skillのみ。`<div class="tags">` 内に `linked ? <a class="chip" href=/skill/<slug>/># name</a> : <span class="chip"># name</span>`。skillが0件なら何も出さない。
  - `WorksCard.astro` props `{ post: CardPost; lang? }` → `<a class="card" href=hrefFor("works",slug)>` + Thumb + `.body > .meta(type badge `<span class="badge accent">` + 期間 `<span>{period_start} – {period_end||現在}</span>`) + `<h3>` + `<Chips limit=3 linked=false>`
  - `ColumnCard.astro` props `{ post: CardPost; lang? }` → `<a class="article">` + Thumb(cls `a-thumb`) + `.a-body > .meta(dates + <span class="badge accent" style="font-size:10px">{種別名}</span>) + h3 + Chips`。dates: 更新日≠公開日なら `<span>更新日 X</span><span>公開日 Y</span>`、同じなら公開日のみ。種別名: works=実績/column=コラム/news=お知らせ。
  - `PageHero.astro` props `{ label: string; title: string; crumbs: { label: string; href?: string }[] }` → `<div class="page-mv" data-en={label}><div class="container"><p class="lbl">{label}</p><h1>{title}</h1><nav class="breadcrumbs" aria-label="パンくず"><a href="/">top</a>{crumbs: <span class="sep">›</span> + (href ? <a> : <span>)}</nav></div></div>`
  - `Pagination.astro` props `{ basePath: string; current: number; total: number }` → `paginationModel` を `<div class="pagination"><div class="nav-links">` に。page n のhrefは n=1 なら `basePath`、他は `${basePath}page/${n}/`。current は `<span aria-current="page" class="page-numbers current">`、dots は `<span class="page-numbers dots">…</span>`、prev/next は `<a class="prev page-numbers">‹</a>` / `next`。0件/1ページなら出力なし。
  - `SideRanking.astro` props `{ items: CardPost[] }` → items空なら出力なし。`side-ranking.php` と同一（`.side-box > .sb-head(.lbl "ranking" + h3 "人気コンテンツ") + a.rank-item(span.no + title)`）。
  - `TagBox.astro` props `{ skills: TermRef[] }` → works一覧サイドバー「タグから探す」（`.side-box` `.sb-head` `span.lbl "tags"` `h3 "タグから探す"` + `a.chip` 全件）。
  - `Share.astro` props `{ url: string; title: string }` → `kb_share_buttons()` と同一（LinkedIn/Facebook/X/URLコピー。`button.js-copy-url data-copied="コピーしました"`）。`url` は `SITE_URL + path`。

- [ ] **Step 1: テスト（純粋部分）** — `Thumb` のグラデーション番号規則は関数に切り出してテストする: `format.ts` に `gradientClass(wpId: number): string` を追加（`g${(wpId % 6) + 1}`）。`test/format.test.ts` に `expect(gradientClass(10)).toBe("g5"); expect(gradientClass(12)).toBe("g1")` を先に追加→FAIL→実装→PASS。
- [ ] **Step 2: コンポーネントを実装**（各PHPパーツ `parts/*.php` を開いて対応するクラス・属性を完全一致させる。エスケープはAstroの式展開に任せる。本文は触らない）
- [ ] **Step 3: 検証** — `npm --prefix cf-site test` PASS、`npm --prefix cf-site run build` 成功
- [ ] **Step 4: Commit** — `feat(cf-site): shared components (thumb, cards, hero, pagination, ranking, share)`

---

### Task 7: トップページ

**Files:**
- Create/Replace: `cf-site/src/pages/index.astro`

**Interfaces:**
- Consumes: `featuredWorks(db,4)`, `latest(db,"news",3)`, `latest(db,"column",4)`, `topSkills(db,14)`, `ranking(db,5)`, `profileSummary(db)`, `Layout`, 各Card。
- Produces: `/` が200。`front-page.php` の7セクション（hero／ticker／selected works／news／column＋ranking／profile digest／contact CTA）を同一マークアップで出力。heroの `<svg id="heroNet">` 静的パスは `front-page.php` から**そのまま**コピー（`#heroWaves` `#heroLinks` `#heroDots` `#heroCursor` のIDを保つ）。ヒーロー写真は `/assets/img/kobayashi-hero.webp`、`alt="小林慎之助"`。ティッカーは `#tickerLane` に `<a href=hrefFor("skill",slug)># {name}</a>`、0件なら出さない。works/news/columnセクションは0件なら出さない（`front-page.php` と同じ条件）。メイン実績カードは1件目が `a.card.main`（概要 excerpt があれば `p.desc`）で、2件目以降は `.f-side` 内の小カード。ニュース行: `a.news-item > span.d(YYYY.MM.DD) + 種別バッジ + span.t`。種別バッジは `news_type` タームの最初の名前を `<span class="badge">`。プロフィール抜粋文は `front-page.php` 日本語文を転記。
- title は `docTitle(null)`。

- [ ] **Step 1: 実装**（`front-page.php` を並べて転記。PHP固有部のみAstroに置換）
- [ ] **Step 2: ローカル検証**
```bash
cd cf-site && npm run build && (npx astro preview --port 8787 > data/preview.log 2>&1 &)
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:8787/ && break; sleep 1; done
curl -s http://localhost:8787/ | grep -c 'id="heroNet"\|id="tickerLane"\|class="featured"\|class="news-list"\|class="prof"\|class="contact-cta"'
```
Expected: `6`（ローカルD1は実データ投入済み。Chromiumでの見た目確認はTask 11）。
- [ ] **Step 3: Commit** — `feat(cf-site): home page`

---

### Task 8: 一覧ページ（実績・コラム・お知らせ・タクソノミー）

**Files:**
- Create/Replace: `cf-site/src/pages/[type]/index.astro`, `cf-site/src/pages/[type]/page/[n].astro`, `cf-site/src/components/ArchiveView.astro`, `cf-site/src/pages/works_type/[slug].astro`, `skill/[slug].astro`, `industry/[slug].astro`, `news_type/[slug].astro`

**Interfaces:**
- Consumes: `listPage`, `listByTerm`, `termBySlug`, `allSkills`, `topSkills`, `ranking`, `PER_PAGE`、Task 6 のコンポーネント。
- Produces: `ArchiveView.astro` props `{ type: "works"|"column"|"news"; page: number }`（`[type]/index` は page=1、`[type]/page/[n]` は n。範囲外=ページ番号が1未満/整数でない/総ページ超過は404応答 `new Response("Not found",{status:404})`）。
  - works: `archive-works.php` と同一（PageHero label `works` title `実績` crumbs `[{label:"実績"}]`、skillフィルタ `.filter-box`（`/searches/` へのGETフォーム、skill上位12のチェックピル、「条件から実績を探す」「条件をリセット」ボタン）、`.col-wrap > div > .grid2` に WorksCard、`Pagination basePath=/works/`、サイドバー: SideRanking＋TagBox）
  - column: `archive-column.php`（ColumnCard縦並び、Pagination、サイドバー: ランキング＋「条件から探す」ボックス）
  - news: `archive-news.php`（`.container style="max-width:820px"`、`.news-list` の `a.news-item`）
  - 0件時の文言: works「該当する実績はまだありません。」/ column「コラムはまだありません。」/ news「お知らせはまだありません。」
  - `works_type/[slug]`: works一覧レイアウトを流用（title=ターム名、crumbs `[{label:"実績",href:"/works/"},{label:ターム名}]`、12件/ページ）。存在しないスラッグは404。
  - `skill|industry|news_type/[slug]`: `taxonomy.php`（PageHero label `tag` title `# ${ターム名}`、`.col-wrap` に ColumnCard（全種別混在）＋ランキング。件数10/ページ、1ページ目のみ。crumbs `[{label: ターム名}]`）。存在しないスラッグは404。
  - `[type]` が works|column|news 以外は404（`works_type` 等の静的ルートが優先されるため衝突しない）。

- [ ] **Step 1: 実装**
- [ ] **Step 2: ローカル検証**
```bash
cd cf-site && npm run build && (npx astro preview --port 8787 > data/preview.log 2>&1 &)
for p in /works/ /column/ /news/ /works/page/2/ /works/page/99/ /works/page/1/ /works_type/nope/ /skill/nope/ /foo/; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8787$p)"; done
```
Expected: `200 200 200 404 404 301 404 404 404`（実データは works 7件=1ページのため `/works/page/2/` も404）。実データの実在タームURL（例 `/works_type/<slug>/`）も `curl` で200を確認。
- [ ] **Step 3: Commit** — `feat(cf-site): archive and taxonomy pages`

---

### Task 9: 詳細ページ

**Files:**
- Replace: `cf-site/src/pages/[type]/[slug].astro`
- Create: `cf-site/src/components/WorksDetail.astro`, `ColumnDetail.astro`, `NewsDetail.astro`

**Interfaces:**
- Consumes: `getPostBySlug`（posts.ts）、`postTerms`, `relatedByTerm`, `profileSummary`, `autop`, `mediaEmbedIds`, `formatDate`, `Share`, `Chips`, `PageHero`系。
- Produces: `/works/<slug>/` `/column/<slug>/` `/news/<slug>/` が200。
  - 共通: `<div class="sec"><div class="container" style="max-width:900px">`（newsは820px）＋パンくず `<nav class="breadcrumbs">`（top › 種別一覧 › タイトル）＋ `<article class="entry-wrap" style="margin-top:18px;max-width:none">`。本文は `<div class="entry-content" set:html={autop(content)}>`。アイキャッチは `post.thumbnail` があれば `<div class="entry-thumb"><img src=mediaSrc></div>`。タイトルは `post.title`。
  - works（`single-works.php`）: `.entry-head`（meta: 種別バッジ＋dates／h1／excerptがあれば `p.standfirst`／skill chips(6, linked)）、概要 `dl.ov`（クライアント=client_name、業界=industryターム、期間=period_start–period_end、役割=role、担当領域=scope配列を「／」区切り、使用技術=tech_stack、ウェブサイト=site_url）、本文、KPI（`kpi_results` 配列があれば `.blk-head` + `.kpi-grid`）、シェア、`.entry-cta`、関連実績（同works_type 3件、`.grid3`）。**ギャラリーは実データに無いため2aでは出力しない**（ledgerにminorとして記録）。
  - column（`single-column.php`）: head（dates＋バッジ「コラム」／h1／skill chips）、本文、シェア、`.author-box`（アバター: プロフィール写真 `kb-avatar-face` ではなく `profileSummary().avatar` があればその画像、無ければ `<span class="init">SK</span>`／名前／肩書／`single-column.php` の日本語紹介文と「プロフィールを見る」リンクを転記）、関連記事（同skill 3件 ColumnCard）。
  - news（`single.php`）: head（種別バッジ＋dates／h1）、`mediaEmbedIds(meta.media_youtube, meta.media_spotify)` があれば `.media-embeds`（`kb_media_embeds` と同一のiframe属性）、本文、「一覧へ戻る」`.center-btn`。
  - 存在しない slug は404。published/modifiedの日付は `formatDate`。

- [ ] **Step 1: 実装**（`single-*.php` を並べて転記）
- [ ] **Step 2: ローカル検証**
```bash
S=$(node -e 'const e=require("./cf-site/data/export.json");console.log(e.posts.find(p=>p.type==="works"&&p.slug.startsWith("jsip")).slug)')
for p in "/works/$S/" /column/founding-weeave/ /works/zzz/ ; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8787$p")"; done
curl -s "http://localhost:8787/works/$S/" | grep -c 'class="ov"\|class="entry-content"\|class="share"\|class="entry-cta"'
```
（日本語スラッグはパーセントエンコード形式のURLでも200になること。Expected: `200 200 404` と `4`。）
works 11（`<p>`無し本文）の詳細で `<p>` が生成されていること: `curl ... | grep -c '<p>'` が1以上。
- [ ] **Step 3: Commit** — `feat(cf-site): detail pages (works, column, news)`

---

### Task 10: 404ページ

**Files:**
- Create: `cf-site/src/pages/404.astro`

**Interfaces:**
- Produces: 未定義パスで404ステータス＋`404.php` と同一のマークアップ（`.notfound > .code.en "404" + p(日本語2行 br区切り) + .links > a.btn.primary(トップへ戻る) + a.btn.ghost(実績一覧) + a.btn.ghost(条件から探す)`）をLayout付きで返す。`[type]/[slug]` 等で `new Response("Not found",{status:404})` を返している箇所は、`Astro.rewrite("/404")` に置き換えて同じ404ページを表示する（ステータスは404を維持）。

- [ ] **Step 1: 実装し、各ページの404応答を `Astro.rewrite("/404")` に統一**
- [ ] **Step 2: 検証** — `curl -s -w '%{http_code}' http://localhost:8787/foo/` が404で本文に `class="notfound"` を含む。`/works/zzz/` も同様。
- [ ] **Step 3: Commit** — `feat(cf-site): 404 page`

---

### Task 11: 視覚比較とデプロイ

**Files:**
- Create: `cf-site/scripts/shot.sh`（スクリーンショット用ラッパ）
- 更新: `CLAUDE.md`（2a完了の記載）

- [ ] **Step 1: スクリーンショット環境確認** — `ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`。無い場合は `npx playwright install chromium` ではなくユーザーに報告して手動比較に切り替える。
- [ ] **Step 2: 撮影** — デスクトップ(1440×900)とスマホ(390×844)で、新（`http://localhost:8787`）と旧（`https://shinnosuke-kobayashi.jp`）の `/`・`/works/`・`/column/`・`/news/`・works詳細1件・column詳細1件を撮影。
```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless --disable-gpu --hide-scrollbars --window-size=1440,2400 --screenshot=data/shots/new-home-d.png http://localhost:8787/
"$CH" --headless --disable-gpu --hide-scrollbars --window-size=1440,2400 --screenshot=data/shots/old-home-d.png https://shinnosuke-kobayashi.jp/
```
（同様にURLとサイズを変えて繰り返す。`data/` はgit管理外。）
- [ ] **Step 3: 目視比較** — 各ペアを `Read` で画像として開き、ヘッダー/ヒーロー/カード/フッターの差異を列挙。CSSの移植漏れ・マークアップ差があれば修正して再撮影（Task 5〜9のコンポーネントを直す）。差異が既知の未実装（検索/チャット等のリンク先、ランキングの内容）のみになるまで繰り返す。
- [ ] **Step 4: 全テスト＋ビルド＋デプロイ** — `npm --prefix cf-site test`、`npm --prefix cf-site run build`、`cd cf-site && npx wrangler deploy`。
- [ ] **Step 5: 確認用サイトで比較** — `node scripts/compare-urls.ts data/export.json https://shinnosuke-kobayashi.jp https://kb-site.curly-wave-c49f.workers.dev` を実行し、2a対象URL（`/`、works/column/newsの一覧・詳細）の status 差分が0であることを確認（title/canonical差分と固定ページ・/en/は許容）。
- [ ] **Step 6: `CLAUDE.md` を更新してCommit** — Cloudflare移行節に「2a完了（トップ・一覧・詳細・タクソノミー・404、確認用URLで公開）」を追記。`git commit -m "docs: 2a complete"`

---

## Self-Review

- **Spec coverage**: §3構成→Task 1/5/6、§3関数移植→Task 2/3/6、§3英語版準備(t())→Task 2、§4取得・ページネーション→Task 3/8、§4ランキング(読み取り)→Task 3/6、§4ミドルウェア→Task 4、§4 hrefエンコード→Task 2/6、§5検証(スクショ/compare-urls/vitest/curl)→Task 11と各Task、§6リスク(本文クラス崩れ→Task 11目視、main.jsのID→Task 7のgrepとTask 1のbyte一致、webフォント→Task 5のhead、ランキング固定→範囲外)、§7成功条件→Task 11。
- **Placeholder scan**: コードはlib・クエリ・リダイレクト・autop等すべて実コード。Astroマークアップは移植元PHPの該当ファイルを一対一転記する手順とクラス名・構造を列挙（移植元が正）。
- **Type consistency**: `CardPost`/`TermRef`/`PER_PAGE`/`listPage`/`paginationModel`/`hrefFor`/`mediaSrc`/`formatDate`/`autop`/`gradientClass` は定義タスクと使用タスクで同名・同シグネチャ。`PostRow` は Task 3 で列を拡張し、既存 `getPostBySlug` も同じ `COLS` を使う。
- **Review Focus**: 7項目が Task 2/3/4/6/8/9 のテストまたは検証コマンドに対応。
