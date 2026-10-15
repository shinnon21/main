# サブプロジェクト2c「英語版」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2a/2bで公開した全ページの英語版を `/en/…` で提供する（日本語版は壊さない）。

**Architecture:** ミドルウェアが `/en/…` を検出して `locals.lang="en"` を設定し内部的に `/…` へ書き換える。日英は同一ページファイルを共有し、言語は `Astro.locals.lang` で切り替える。内容の英語化は純粋関数（`pick`/訳語表）とクエリ層の `*_en` 利用で行う。

**Tech Stack:** Astro 7 SSR（Cloudflare）、D1、TypeScript、vitest（`node:sqlite` シム）、PHP CLI（プロフィール英語初期値の機械抽出用）。

**Spec:** `docs/superpowers/specs/2026-10-15-cf-public-site-2c-design.md`

## Global Constraints

- 移植元 `kobayashi-theme/` は読み取り専用。デザイントークン・CSS・main.js は変更しない。
- URLは現行 `/en/…` パスを維持（`/en/` `/en/works/` `/en/works/<slug>/` `/en/works/page/2/` `/en/works_type/<slug>/` `/en/skill/<slug>/` `/en/profile/` `/en/about/` `/en/privacy/` ほか）。現行WPは `works_type` を `/en/works/type/<slug>/` にしていたが、新サイトの日本語版URL（`/works_type/<slug>/`）に揃え、新サイトの英語版は `/en/works_type/<slug>/` とする。
- 日英ともに `contact` `chat` `searches` は404のまま（サブプロジェクト4）。404ページ・存在しないURLにはhreflangを出さない。
- 言語切替はフッター下部と `.gnav-extra`（モバイルメニュー）のみ（ヘッダーには置かない）。マークアップは `kb_lang_switcher()` と同一: 日本語ページ `<a class="lang-switch" href="{enURL}" hreflang="en" rel="alternate"><span class="on">JA</span><span class="sep">/</span><span>English</span></a>`、英語ページ `<a class="lang-switch" href="{jaURL}" hreflang="ja" rel="alternate"><span class="on">EN</span><span class="sep">/</span><span>日本語</span></a>`。
- hreflang: `ja` / `en` / `x-default`（=日本語URL）。英語`<title>`は `<タイトル> | Shinnosuke Kobayashi Official Website`、ENトップは `Shinnosuke Kobayashi Official Website`。
- 英語データが無い項目は日本語へフォールバック。
- 本番ドメイン・GCP・DNSには触れない。デプロイは確認用Workerのみ。D1への書き込みは確認用D1（自分のCloudflareアカウント）のみ。
- テストコマンド: `npm --prefix cf-site test`。`bash -c` を含むコマンドは使わない。

## Review Focus

- `/en`・`/en/works`（スラッシュ無し）・`/en/works/page/1/` が正しく301され、`/enfoo/` `/english/` は英語として扱われない（Task 1）
- `Astro.rewrite("/404/")` が英語リクエストで言語を失わず、英語の404ページになる（Task 1, 6）
- 英語フィールドが空の記事・タグ名が日本語へフォールバックし、訳語表に無い名前は日本語のまま（Task 2）
- `/en/media/…` と `/en/wp-content/uploads/…` が `/media/…` へ301される（Task 1）
- 英語ページに日本語の固定UI文言が残らない（Task 7）
- 日本語版のURL・表示が変わらない（既存テスト＋Task 7の比較）

## File Structure

```
cf-site/
  src/env.d.ts                      # App.Locals { lang, path }
  src/lib/lang.ts                   # resolveLang, l, altPair, docTitle(en)
  src/lib/l10n.ts                   # pick, termName, scopeLabel, newsTypeName
  src/lib/redirects.ts              # /en 対応
  src/middleware.ts                 # lang設定＋rewrite
  src/lib/queries.ts, posts.ts      # excerpt_en 追加、profileFull(db, lang)
  scripts/seed-profile-en.ts        # functions.php から英語初期値→D1メタ
  src/components/*                  # lang対応（hrefはl()経由）
  src/pages/*                       # lang対応（Astro.locals.lang）
  test/lang.test.ts, l10n.test.ts   # 新規
```

---

### Task 1: 言語判定・URL変換・リダイレクト・ミドルウェア

**Files:**
- Create: `cf-site/src/env.d.ts`, `cf-site/src/lib/lang.ts`, `cf-site/test/lang.test.ts`
- Modify: `cf-site/src/lib/redirects.ts`, `cf-site/src/middleware.ts`, `cf-site/test/redirects.test.ts`, `cf-site/src/lib/format.ts`（`docTitle` に lang 引数）, `cf-site/test/format.test.ts`

**Interfaces:**
- Produces（`lang.ts`）:
```ts
import type { Lang } from "./i18n.ts";
export function resolveLang(pathname: string): { lang: Lang; path: string };  // '/en'→{en,'/'}, '/en/'→{en,'/'}, '/en/works/'→{en,'/works/'}, '/enfoo/'→{ja,'/enfoo/'}
export function l(lang: Lang, path: string): string;                           // en: '/en'+path ('/'→'/en/'); ja: path。外部URL/アンカー/クエリのみは素通し
export function altPair(path: string): { ja: string; en: string };            // path は言語中立（'/works/'）
```
- `docTitle(title: string | null, lang?: Lang)`: ja は従来どおり。en は `null`→`Shinnosuke Kobayashi Official Website`、それ以外→`${title} | Shinnosuke Kobayashi Official Website`。
- `normalizeRequest(url)` の挙動（言語プレフィックス `/en` を除去して従来規則を適用し、結果のlocationに `/en` を戻す）:
  - `/en` → `/en/`、`/en/works` → `/en/works/`、`/en/works/page/1/` → `/en/works/`、`/en/skill/x/page/1/` → `/en/skill/x/`
  - `/en/media/…` と `/en/wp-content/uploads/…` → `/media/…`（`/en` を付けない）
  - `/en/` `/en/works/` `/en/media/a.jpg` は `null`（ループなし）
- `App.Locals`: `{ lang?: Lang; path?: string }`。ミドルウェアは最初の入場で `lang`（`??=`）と言語中立 `path` を設定し、`/en/…` は `next(path+search)` で書き換える。書き換え再入場（`Astro.rewrite("/404/")`）では既存の `locals.lang` を保持する。

- [ ] **Step 1: 失敗するテストを書く**

`test/lang.test.ts`:
```ts
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
```
追記 `test/redirects.test.ts`:
```ts
test("language-prefixed URLs get the same normalization and keep the /en prefix", () => {
  expect(n(u("/en"))).toEqual({ status: 301, location: "/en/" });
  expect(n(u("/en/works"))).toEqual({ status: 301, location: "/en/works/" });
  expect(n(u("/en/works/page/1/"))).toEqual({ status: 301, location: "/en/works/" });
  expect(n(u("/en/skill/dx/page/1/?a=1"))).toEqual({ status: 301, location: "/en/skill/dx/?a=1" });
  expect(n(u("/en/media/2026/07/a.jpg"))).toEqual({ status: 301, location: "/media/2026/07/a.jpg" });
  expect(n(u("/en/wp-content/uploads/2026/07/a.jpg"))).toEqual({ status: 301, location: "/media/2026/07/a.jpg" });
  for (const p of ["/en/", "/en/works/", "/enfoo", "/en/works/page/2/"]) expect(n(u(p)), p).toEqual(p === "/enfoo" ? { status: 301, location: "/enfoo/" } : null);
});
```
追記 `test/format.test.ts`:
```ts
test("docTitle in English", () => {
  expect(docTitle(null, "en")).toBe("Shinnosuke Kobayashi Official Website");
  expect(docTitle("Works", "en")).toBe("Works | Shinnosuke Kobayashi Official Website");
  expect(docTitle("実績", "ja")).toBe("実績 | 小林慎之助");
});
```
- [ ] **Step 2: 失敗を確認** — `npm --prefix cf-site test` → 新規3ファイル分がFAIL
- [ ] **Step 3: 実装**

`src/lib/lang.ts`:
```ts
import type { Lang } from "./i18n.ts";

export function resolveLang(pathname: string): { lang: Lang; path: string } {
  const m = pathname.match(/^\/en(\/.*)?$/);
  return m ? { lang: "en", path: m[1] ?? "/" } : { lang: "ja", path: pathname };
}
const SYSTEM = /^\/(media|assets|_astro)(\/|$)/;
export function l(lang: Lang, path: string): string {
  if (lang !== "en" || !path.startsWith("/") || path.startsWith("//") || SYSTEM.test(path)) return path;
  return path === "/" ? "/en/" : "/en" + path;
}
export function altPair(path: string): { ja: string; en: string } {
  return { ja: path, en: l("en", path) };
}
```
`src/lib/redirects.ts` 全体を置換（既存規則は言語中立パスに対して適用し、最後に `/en` を戻す）:
```ts
import { resolveLang } from "./lang.ts";

export function normalizeRequest(url: URL): { status: 301; location: string } | null {
  const { lang, path } = resolveLang(url.pathname);
  const prefix = lang === "en" ? "/en" : "";
  const search = url.search;
  const legacy = path.match(/^\/wp-content\/uploads\/(.+)$/);
  if (legacy) return { status: 301, location: `/media/${legacy[1]}${search}` };
  if (lang === "en" && /^\/(media|assets|_astro)(\/|$)/.test(path)) return { status: 301, location: `${path}${search}` };
  if (/^\/(media|assets|_astro)(\/|$)/.test(path)) return null;
  if (lang === "en" && !url.pathname.includes("/", 1)) return { status: 301, location: `/en/${search}` }; // '/en'
  const last = path.split("/").pop() ?? "";
  if (!path.endsWith("/") && !last.includes(".")) return { status: 301, location: `${prefix}${path}/${search}` };
  const p1 = path.match(/^\/((?:works|column|news)|(?:works_type|skill|industry|news_type)\/[^/]+)\/page\/1\/$/);
  if (p1) return { status: 301, location: `${prefix}/${p1[1]}/${search}` };
  return null;
}
```
（`/en` 単独は `resolveLang("/en")` が path="/" になり末尾スラッシュ判定をすり抜けるため専用分岐で `/en/` へ。`/en/media/…` は拡張子付きファイルでも先に301。）

`src/lib/format.ts` の `docTitle` を差し替え:
```ts
export function docTitle(title: string | null, lang: "ja" | "en" = "ja"): string {
  if (lang === "en") return title ? `${title} | Shinnosuke Kobayashi Official Website` : "Shinnosuke Kobayashi Official Website";
  return title ? `${title} | 小林慎之助` : "小林慎之助 | 構想を、社会に実装する。";
}
```
`src/env.d.ts`:
```ts
/// <reference types="astro/client" />
declare namespace App {
  interface Locals { lang?: "ja" | "en"; path?: string }
}
```
`src/middleware.ts`:
```ts
import { defineMiddleware } from "astro:middleware";
import { normalizeRequest } from "./lib/redirects.ts";
import { resolveLang } from "./lib/lang.ts";

export const onRequest = defineMiddleware((ctx, next) => {
  const r = normalizeRequest(ctx.url);
  if (r) return ctx.redirect(r.location, r.status);
  const { lang, path } = resolveLang(ctx.url.pathname);
  const first = ctx.locals.lang === undefined;
  ctx.locals.lang ??= lang;          // 書き換え再入場（Astro.rewrite）では最初の言語を保持
  if (first) ctx.locals.path = path;  // 言語中立パス（hreflang・切替用）
  return lang === "en" && first ? next(path + ctx.url.search) : next();
});
```
- [ ] **Step 4: 成功確認** — `npm --prefix cf-site test` → 全PASS。`npm --prefix cf-site run build` が成功。
- [ ] **Step 5: Commit** — `feat(cf-site): language resolution, /en redirects and middleware`

---

### Task 2: 英語化ライブラリ（pick・訳語表）

**Files:**
- Create: `cf-site/src/lib/l10n.ts`, `cf-site/test/l10n.test.ts`

**Interfaces:**
- Produces:
```ts
export function pick(lang: Lang, ja: string | null | undefined, en: string | null | undefined): string; // en かつ trim後非空なら en、無ければ ja ?? ""
export function termName(lang: Lang, name: string): string;      // タグ/実績種別（現行 kb_term_en）。未知は素通し
export function scopeLabel(lang: Lang, v: string): string;       // 担当領域（現行 kb_scope_label）
export function newsTypeName(lang: Lang, name: string): string;  // お知らせ種別
```

- [ ] **Step 1: 失敗するテストを書く**
```ts
import { expect, test } from "vitest";
import { pick, termName, scopeLabel, newsTypeName } from "../src/lib/l10n.ts";

test("pick prefers non-empty English in en, never in ja", () => {
  expect(pick("en", "日本語", "English")).toBe("English");
  expect(pick("en", "日本語", "  ")).toBe("日本語");
  expect(pick("en", "日本語", null)).toBe("日本語");
  expect(pick("ja", "日本語", "English")).toBe("日本語");
  expect(pick("en", null, undefined)).toBe("");
});
test("termName maps known Japanese names in en and passes unknown through", () => {
  expect(termName("en", "DX支援")).toBe("DX Support");
  expect(termName("en", "起業・経営")).toBe("Founding & Management");
  expect(termName("en", "政治・行政")).toBe("Politics & Government");
  expect(termName("en", "未知のタグ")).toBe("未知のタグ");
  expect(termName("ja", "DX支援")).toBe("DX支援");
});
test("scopeLabel and newsTypeName", () => {
  expect(scopeLabel("en", "要件定義")).toBe("Requirements");
  expect(scopeLabel("en", "講師・登壇")).toBe("Lecturing & Talks");
  expect(scopeLabel("ja", "運用")).toBe("運用");
  expect(newsTypeName("en", "メディア掲載")).toBe("Media");
  expect(newsTypeName("en", "登壇・イベント")).toBe("Talks & Events");
  expect(newsTypeName("en", "不明")).toBe("不明");
});
```
- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 実装**
```ts
import type { Lang } from "./i18n.ts";

export function pick(lang: Lang, ja: string | null | undefined, en: string | null | undefined): string {
  return lang === "en" && typeof en === "string" && en.trim() !== "" ? en : ja ?? "";
}

const TERMS: Record<string, string> = {
  "起業・経営": "Founding & Management", "DX支援": "DX Support", "国際事業開発": "Global Business Development", "マーケティング": "Marketing", "登壇・講師": "Talks & Lectures",
  "政治DX": "Political DX", "データ分析": "Data Analysis", "事業開発": "Business Development", "東南アジア": "Southeast Asia", "コミュニティ構築": "Community Building",
  "経営工学": "Management Science", "サプライチェーン": "Supply Chain", "生成AI活用": "Generative AI", "スタートアップ": "Startup", "政治・行政": "Politics & Government",
};
const SCOPES: Record<string, string> = {
  "戦略立案": "Strategy", "要件定義": "Requirements", "設計": "System Design", "デザイン": "Design", "実装": "Implementation", "運用": "Operations",
  "データ分析": "Data Analysis", "リサーチ・調査": "Research", "マーケティング・広報": "Marketing & PR", "コミュニティ運営": "Community Management", "講師・登壇": "Lecturing & Talks",
};
const NEWS: Record<string, string> = { "お知らせ": "News", "登壇・イベント": "Talks & Events", "メディア掲載": "Media", "リリース": "Release" };

const look = (m: Record<string, string>, lang: Lang, k: string) => (lang === "en" && Object.hasOwn(m, k) ? m[k] : k);
export const termName = (lang: Lang, name: string) => look(TERMS, lang, name);
export const scopeLabel = (lang: Lang, v: string) => look(SCOPES, lang, v);
export const newsTypeName = (lang: Lang, name: string) => look(NEWS, lang, name);
```
- [ ] **Step 4: 成功確認** → PASS
- [ ] **Step 5: Commit** — `feat(cf-site): l10n helpers (pick, term/scope/news maps)`

---

### Task 3: クエリ層の英語対応とプロフィール英語データ投入

**Files:**
- Modify: `cf-site/src/lib/posts.ts`（`PostRow` と `COLS` に `excerpt_en` を追加）, `cf-site/src/lib/queries.ts`（`COLS` に `p.excerpt_en`、`profileFull(db, lang)`、`profileSummary(db, lang)`）, `cf-site/test/queries.test.ts`
- Create: `cf-site/scripts/seed-profile-en.ts`, `cf-site/test/seed-profile-en.test.ts`

**Interfaces:**
- Consumes: `pick`（Task 2）。
- Produces:
  - `PostRow.excerpt_en: string | null`
  - `profileFull(db, lang?: Lang)` は `lang==="en"` のとき各項目を `profile_*_en` メタ → 空なら日本語の順で返す（name/kana/role の初期値は日本語のまま）。戻り値の形は従来と同じ。
  - `profileSummary(db, lang?: Lang)` も同様。
  - `scripts/seed-profile-en.ts`: `node scripts/seed-profile-en.ts > data/seed-profile-en.sql`。`kobayashi-theme/functions.php` の `kb_profile_defaults_en()` を **PHP CLI で評価** して JSON 化し、profileページの `post_meta` に `profile_kana_en` `profile_name_en` `profile_role_en` `profile_bio_en` `profile_career_en` `profile_skills_en` `profile_research_title_en` `profile_research_body_en` `profile_activities_en` を `INSERT OR REPLACE` するSQLを出力する。純粋関数 `buildSeedSql(en: Record<string,string>): string[]` をexportしテストする。

- [ ] **Step 1: 失敗するテストを書く**

`test/queries.test.ts` に追記:
```ts
test("profileFull(en) prefers profile_*_en per field and falls back to Japanese", async () => {
  const q = db((e) => { e.posts[4].meta = { profile_name: "名", profile_name_en: "Name", profile_bio: "和文", profile_bio_en: "", profile_career: "2025 | A | b", profile_career_en: "2025 | A-en | b-en" }; });
  const en = await profileFull(q, "en");
  expect(en).toMatchObject({ name: "Name", bio: "和文", career: "2025 | A-en | b-en" });
  const ja = await profileFull(q, "ja");
  expect(ja).toMatchObject({ name: "名", career: "2025 | A | b" });
  expect((await profileSummary(q, "en")).name).toBe("Name");
});
test("listPage rows carry excerpt_en", async () => {
  const q = db((e) => { e.posts[0].meta.excerpt_en = "EN excerpt"; });
  expect((await listPage(q, "works", 1)).posts.find((p) => p.slug === "site-a")?.excerpt_en).toBe("EN excerpt");
});
```
`test/seed-profile-en.test.ts`:
```ts
import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { buildSeedSql } from "../scripts/seed-profile-en.ts";
test("seed SQL writes profile_*_en meta for the profile page and is idempotent", () => {
  const db = newDb();
  db.exec("insert into posts(wp_id,type,slug,title,published_at,modified_at) values(20,'page','profile','p','2026-01-01','2026-01-01')");
  const sql = buildSeedSql({ profile_name: "Shinnosuke O'Kobayashi", profile_career: "2025 | A | b\n2024 | C | d" });
  for (const s of [...sql, ...sql]) db.exec(s);
  const rows = db.prepare("select key,value from post_meta order by key").all() as { key: string; value: string }[];
  expect(rows.map((r) => r.key)).toEqual(["profile_career_en", "profile_name_en"]);
  expect(JSON.parse(rows[1].value)).toBe("Shinnosuke O'Kobayashi");
  expect(JSON.parse(rows[0].value)).toBe("2025 | A | b\n2024 | C | d");
});
```
- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 実装**
  - `posts.ts`/`queries.ts` の `COLS` と `PostRow` に `excerpt_en` を追加（`excerpt_en` は `posts` テーブルの既存列）。
  - `profileFull`/`profileSummary` に `lang` 引数を追加:
```ts
const raw = (k: string) => parse(m.find((x) => x.key === k)?.value ?? '""').trim();
const f = (k: string) => (lang === "en" ? raw(k + "_en") : "") || raw(k);
```
    取得SQLは `key LIKE 'profile\_%'` のまま（`_en` も含まれる）。name/kana/role の初期値フォールバックは従来どおり（`f("profile_name") || PROFILE_DEFAULTS.name`）。
  - `scripts/seed-profile-en.ts`:
```ts
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export function buildSeedSql(en: Record<string, string>): string[] {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  return Object.entries(en).map(
    ([k, v]) => `INSERT OR REPLACE INTO post_meta(post_id,key,value) VALUES((SELECT id FROM posts WHERE type='page' AND slug='profile'),${q(k + "_en")},${q(JSON.stringify(v))});`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = readFileSync(new URL("../../kobayashi-theme/functions.php", import.meta.url), "utf8");
  const fn = src.match(/function kb_profile_defaults_en\(\)[\s\S]*?\n\}\n/)?.[0];
  if (!fn) throw new Error("kb_profile_defaults_en not found");
  const json = execFileSync("php", ["-r", `${fn} echo json_encode(kb_profile_defaults_en(), JSON_UNESCAPED_UNICODE);`], { encoding: "utf8" });
  const en = JSON.parse(json) as Record<string, string>;
  if (!en.profile_bio || !en.profile_career) throw new Error("unexpected PHP output");
  process.stdout.write(buildSeedSql(en).join("\n") + "\n");
}
```
    （PHPは `function` 定義と `echo` だけを実行する。ファイル全体は読み込まない。）
- [ ] **Step 4: 成功確認** — `npm --prefix cf-site test` → PASS
- [ ] **Step 5: 英語データの投入**
```bash
cd cf-site && node scripts/seed-profile-en.ts > data/seed-profile-en.sql && wc -l data/seed-profile-en.sql
npx wrangler d1 execute DB --local --file data/seed-profile-en.sql   # ローカル
npx wrangler d1 execute DB --remote --file data/seed-profile-en.sql  # 確認用D1（自分のアカウント）
npx wrangler d1 execute DB --remote --json --command "select count(*) c from post_meta where key like 'profile\_%\_en' escape '\\'"
```
Expected: 行数9、リモートの件数9。（`import.ts` の再取込でこの9行は消えるので、再取込後は必ずこのSQLを再適用する。`CLAUDE.md` に追記する。）
- [ ] **Step 6: Commit** — `feat(cf-site): English fields in queries and profile EN seed`

---

### Task 4: Layout（lang属性・リンク・hreflang・言語切替・title）

**Files:**
- Modify: `cf-site/src/components/Layout.astro`, `cf-site/src/components/PageHero.astro`, `cf-site/src/components/Crumbs.astro`
- Create: `cf-site/src/components/LangSwitch.astro`

**Interfaces:**
- Consumes: `l`, `altPair`（Task 1）。
- Produces:
  - `Layout` props: `{ title: string; description?: string; lang?: Lang; bodyClass?: string; pair?: boolean }`。`lang` 未指定時は `Astro.locals.lang ?? "ja"`。`pair`（既定 true）が true のとき、`<link rel="alternate" hreflang="ja|en|x-default">` を出力し言語切替を出す。切替・hreflang の元になるパスは `Astro.locals.path ?? "/"`。`pair={false}`（404）ではhreflangを出さず、切替の宛先は `/en/`（日本語ページ上）または `/`（英語ページ上）。
  - `Layout` 内のすべての内部リンク（ロゴ、ナビ6項目、検索フォームaction、フッター、CTA、`.gnav-extra` 内）を `l(lang, path)` 経由にする。サイト名は英語時 `Shinnosuke Kobayashi`（`<img alt>`・フッター`.jp`）。フッター説明文は既に `t(lang, siteDesc, "From political…")`。
  - `LangSwitch.astro` props `{ lang: Lang; ja: string; en: string }`（上記Global Constraintsのマークアップ）。`Layout` のフッター `.bottom`（© の右）と `.gnav-extra` の先頭に配置。
  - `PageHero` / `Crumbs` に `lang?: Lang` を追加し、トップ `<a href="/">top</a>` を `l(lang,"/")` に、各 `crumbs[].href` は呼び出し側が `l()` 済みの値を渡す前提で素通し。

- [ ] **Step 1: 実装**（`altPair`・`l` を使用。`Astro.locals` を読むのは `Layout` のみ。ページ側は `lang` を `Layout`/各コンポーネントへ明示的に渡す）
- [ ] **Step 2: 検証** — `npm --prefix cf-site run build` が成功。テストは全PASS（既存の日本語出力は不変）。
- [ ] **Step 3: Commit** — `feat(cf-site): language-aware Layout (hreflang, switcher, links)`

---

### Task 5: コンポーネントの言語対応

**Files:**
- Modify: `cf-site/src/components/{Thumb,Chips,WorksCard,ColumnCard,Pagination,SideRanking,TagBox,Share,Dates,Avatar,ArchiveView,TermArchive,WorksDetail,ColumnDetail,NewsDetail,PageView}.astro`

**Interfaces:**
- Consumes: `l`, `pick`, `termName`, `scopeLabel`, `newsTypeName`、`PostRow.title_en/excerpt_en/content_en`、`Lang`。
- 規則（全ファイル共通）:
  1. `lang` prop（既定 "ja"）を持たないコンポーネントには追加し、呼び出し側から渡す。
  2. 内部リンクは `l(lang, hrefFor(...))` / `l(lang, "/works/")`。`Pagination` の `basePath` は呼び出し側が `l()` 済みを渡し、コンポーネント内では加工しない。`Share` の `url` は `SITE_URL + l(lang, path)`。
  3. 記事の表示文字列は `pick(lang, post.title, post.title_en)` / `pick(lang, post.excerpt, post.excerpt_en)` / `pick(lang, post.content, post.content_en)`。実績概要は `pick(lang, str("client_name"), str("client_name_en"))`（role・tech_stack も同様）、`kpi_results` は英語なら `kpi_results_en`（配列で value を持つものがあればそれ、無ければ日本語）。
  4. タグ・実績種別・お知らせ種別・担当領域・Thumb のラベルは `termName`/`newsTypeName`/`scopeLabel` を通す（`Chips`/`WorksCard`/`Thumb`/`ColumnCard`/`TagBox`/`WorksDetail`/`NewsDetail`、ティッカー、ArchiveView のフィルタピル）。
  5. `Avatar` の `alt` は呼び出し側から。ColumnDetail の著者紹介は `t(lang, …)`（文言は既存）。
  6. ColumnCard の種別名は既に `t(lang,…)`。`ArchiveView`/`TermArchive` の `docTitle` は `docTitle(name, lang)`、パンくず `crumbs` の `href` は `l()`、works絞り込みフォーム `action` は `l(lang,"/searches/")`。
  7. 英語では `docTitle(title, "en")` を使う（各 Detail/PageView/ArchiveView/TermArchive/404/profile/index）。

- [ ] **Step 1: 実装**（各ファイルを開き上記規則を適用。日本語の出力は不変であること）
- [ ] **Step 2: 検証** — `npm --prefix cf-site test` 全PASS、`npm --prefix cf-site run build` 成功。
- [ ] **Step 3: Commit** — `feat(cf-site): language-aware components`

---

### Task 6: ページの言語対応と英語文言

**Files:**
- Modify: `cf-site/src/pages/index.astro`, `cf-site/src/pages/profile.astro`, `cf-site/src/pages/404.astro`, `cf-site/src/pages/[type]/index.astro`, `cf-site/src/pages/[type]/page/[n].astro`, `cf-site/src/pages/[type]/[slug].astro`, `cf-site/src/pages/{works_type,skill,industry,news_type}/[slug].astro`, `cf-site/src/pages/{works_type,skill,industry,news_type}/[slug]/page/[n].astro`

**Interfaces:**
- 各ページの先頭で `const lang = Astro.locals.lang ?? "ja";` を取り、`Layout`/各コンポーネントへ `lang={lang}` を渡す。固定の `"ja" as const` は削除。
- `index.astro`（トップ）の英語文言は `front-page.php` の `kb_t` の英語を使う: ヒーロー h1 `Vision,<br><span class="u">implemented in society.</span>`、リード `From DX support for politics and government to research on pharmaceutical supply chains — the official website of Shinnosuke Kobayashi, an aspiring coordinator who delivers Japanese technology to society.`、ボタン `View works →` / `Profile`、見出し `Selected Works` / `All works →`、`News` / `All news →`、`Latest Columns` / `All columns →`、プロフィール抜粋 `A student entrepreneur studying management science and engineering at the University of Tsukuba while working on DX and social challenges across politics, government, and business. With strengths in data-driven strategy and community building, I am committed to implementing ideas as systems that actually work in the field — not leaving them as concepts.`、`Full profile →` / `Research theme`、CTA見出し `Work Inquiries`、本文 `For consulting on DX, data analysis, or business development, interview and speaking requests, or collaboration proposals — feel free to reach out via the contact form.`、`Contact →`。ヒーロー写真の `alt` は `Shinnosuke Kobayashi`。`front-page.php` を開いて残りの `kb_t` の英語も転記する。`<title>` は `docTitle(null, lang)`。ニュース行の種別バッジは `newsTypeName`、ティッカーとカードのタグは `termName`。
- `profile.astro`: `profileFull(db, lang)`、英語の見出しは既存の `t(lang,…)`。`/profile/#research` 等のリンクは `l()`。
- 固定ページ（`[type]/index.astro` の PageView 経路）: `pick(lang, post.title, post.title_en)` / `pick(lang, post.content, post.content_en)` を `PageView` に渡す（`PageView` 側で処理）。`PageHero` の label はスラッグ、title は英語タイトル。
- `404.astro`: `lang = Astro.locals.lang ?? "ja"`、英語文言 `The page you are looking for could not be found.<br />It may have been moved or deleted.`、ボタン `Back to top` / `Works` / `Advanced search`。`Layout` に `pair={false}`。
- `Astro.rewrite("/404/")` は言語を保持する（Task 1 のミドルウェアが保証）。

- [ ] **Step 1: 実装**
- [ ] **Step 2: ビルドと全テスト** — `npm --prefix cf-site test` / `npm --prefix cf-site run build`
- [ ] **Step 3: Commit** — `feat(cf-site): English pages`

---

### Task 7: デプロイ・検証・文書

**Files:**
- Create: `cf-site/scripts/check-en.ts`（日本語UI文言の取りこぼし点検）
- Update: `CLAUDE.md`

- [ ] **Step 1: デプロイ** — `npm --prefix cf-site run build && cd cf-site && npx wrangler deploy`、約15秒待つ。
- [ ] **Step 2: ステータス確認**
```bash
U=https://kb-site.curly-wave-c49f.workers.dev
for p in /en /en/ /en/works/ /en/works /en/column/ /en/news/ /en/profile/ /en/about/ /en/privacy/ /en/works/page/1/ /en/foo/ /en/contact/ /enfoo/ /en/media/2026/07/Shinnosuke_Face.jpg /works/ /; do echo "$(curl -s -o /dev/null -w '%{http_code}' $U$p) $p"; done
```
Expected: `301 200 200 301 200 200 200 200 200 301 404 404 404 301 200 200`。
- [ ] **Step 3: 日本語の取りこぼし点検** — `scripts/check-en.ts <url…>`: 各英語ページのHTMLから `<script>`/`<style>`/記事本文（`.entry-content`）を除いた本文テキストに、ひらがな・カタカナ・漢字が残るか点検し、残った文字列を一覧表示（許容: 日本語固有名詞のみのタグ・記事データ側の英語未入力）。出力を確認し、UI固定文言の残りは修正してから次へ。
- [ ] **Step 4: 構造確認** — `/en/` の `<html lang="en">`、`<title>`、hreflang 3本、`.lang-switch` 2か所、内部リンクがすべて `/en/…`（`/works/` など非英語リンクが無い）をcurl+grepで確認。日本語版 `/` は `<html lang="ja">`、hreflang 3本、`.lang-switch`（JA / English）。
- [ ] **Step 5: 視覚比較** — `scripts/shot.sh` で旧 `https://shinnosuke-kobayashi.jp/en/`・`/en/works/<slug>/`・`/en/profile/` と新サイトの同URLを撮影し目視比較（差異があれば修正）。
- [ ] **Step 6: 新旧URL比較** — `scripts/compare-urls.ts data/export.json https://shinnosuke-kobayashi.jp <staging>` で、`/en/…` を含む対象のstatus差分が contact/chat/searches（とその英語版）以外で0。
- [ ] **Step 7: `CLAUDE.md` 更新とCommit** — 「2c完了」、英語プロフィール初期値の投入手順（`seed-profile-en.ts`、再取込後に再適用）を追記。

---

## Self-Review

- **Spec coverage**: §4.1ルーティング→Task 1、§4.2内容の英語化→Task 2/3/5、§4.3 UI・メタ→Task 4/6、§5検証→Task 7、§6リスク（rewrite/301→Task 1のテスト、日本語取りこぼし→Task 7 Step 3、データ欠落→`pick`のフォールバック）。
- **Placeholder scan**: コードはlib・ミドルウェア・シードを実コードで記載。Task 4〜6のAstro編集は規則と具体的な文言を列挙（既存ファイルを開いて適用する手順）。`front-page.php` の「残りの `kb_t`」はファイルを開いて機械的に転記する指示。
- **Type consistency**: `Lang`（`i18n.ts`）、`resolveLang/l/altPair`（`lang.ts`）、`pick/termName/scopeLabel/newsTypeName`（`l10n.ts`）、`profileFull(db, lang?)`、`docTitle(title, lang?)`、`App.Locals`。Task間で同名・同シグネチャ。
- **Review Focus**: 6項目すべてが Task 1/2/7 のテストまたは検証に対応。
