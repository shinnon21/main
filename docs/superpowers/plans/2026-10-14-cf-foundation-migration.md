# Cloudflare移行 サブプロジェクト1「基盤とデータ移行」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WordPressの全公開コンテンツをD1/R2へ再実行可能に移行し、`wrangler dev` で最小の一覧・詳細がD1から描画できる基盤を作る。

**Architecture:** 純粋なTypeScriptモジュール（変換・SQL生成・検証・URL比較）をAstroから独立させてNode(vitest)でテストする。D1アクセスは `src/lib/env.ts` の1箇所に閉じ込め、クエリ関数は `D1Like` インターフェース（`prepare().bind().all()/first()`）を受け取る。テストでは `node:sqlite` の薄いシムでD1を代替し、import→queryを通しで検証する。

**Tech Stack:** Astro 7.x + @astrojs/cloudflare 14.x（Workers）、wrangler 4.x、D1/R2/KV、TypeScript、vitest、Node 24（`node file.ts` で直接実行）、WP-CLI（VM側の書き出し）。

**Spec:** `docs/superpowers/specs/2026-10-14-cf-foundation-migration-design.md`

**仕様からの1点の調整:** プロフィールの日英項目（`profile_*`）はACFがprofileページの投稿メタとして保持しているため、`settings` ではなく `post_meta`（slug=`profile` のpage）にそのまま移す。`settings` はWPオプション（サイト名・キャッチフレーズ等）とSNSリンクのみ。

## Global Constraints

- GCPのVM・DNS・課金は本プランでは一切変更しない（VMでの読み取り専用コマンドとスナップショット取得のみ）。gcloudは必ず `--account=hello@shinnosuke-kobayashi.jp`。
- AIチャット・Phase 2は実装しない。
- 現行URLパスを維持: `/works/<slug>/` `/column/<slug>/` `/news/<slug>/` `/en/…` `/sitemap.xml` `/llms.txt` `/robots.txt` `/favicon.ico`。`/wp-content/uploads/…` は `/media/…` へ301。
- 移行対象は status=publish かつパスワード無しの記事のみ。
- ACFメタはWPキー名のままJSON保持。`_` 始まりのメタ（ACF参照キー等）は除外（`_thumbnail_id` のみ取得してアイキャッチに変換）。
- ブランド色・ロゴは変更しない（本プランではUIはプレーンな確認用のみ）。
- 関数・ファイルは `cf-site/` 配下。`kobayashi-theme/` は変更しない。
- Astro/adapterは最新メジャー（7.x / 14.x）。バインディング取得APIは公式ドキュメントで確認してから実装する（Task 8）。

## Review Focus

- タイトル/本文に `'`・`"`・`\`・改行・絵文字を含む記事 → SQLが壊れず原文どおり格納される（Task 4）
- アイキャッチ未設定、または添付ファイルが存在しない記事 → thumbnail=NULLで取り込み、エラーにしない（Task 4）
- 下書き・非公開・パスワード保護記事 → 取り込まれない（Task 4）
- 本文内の `http://` 絶対URL、`-300x200` 等のサイズ接尾辞、`srcset` → すべて `/media/…` に書き換わる（Task 3）
- 英語版フィールドが空 → NULL格納で日本語にフォールバックできる（Task 4）
- gallery / kpi_results など配列・オブジェクトのメタ → JSONとして往復で同一（Task 4/6）

## File Structure

```
cf-site/
  package.json, tsconfig.json, astro.config.mjs, wrangler.jsonc, vitest.config.ts
  migrations/0001_init.sql          # D1スキーマ
  scripts/
    wp-export.php                   # VM上で実行。export.json を出力
    lib/types.ts                    # WpExport型（全モジュールの共有インターフェース）
    lib/transform.ts                # URL書き換え・WP固有記法検出
    lib/import-sql.ts               # WpExport → SQL文配列
    lib/verify.ts                   # 件数・紐付け突合
    lib/media.ts                    # uploads相対パス→R2キー
    lib/urls.ts                     # URL一覧生成・HTMLからtitle/canonical抽出
    import.ts / verify.ts / sync-media.ts / compare-urls.ts   # CLI
  src/lib/env.ts                    # バインディング取得（唯一の依存点）
  src/lib/d1.ts                     # D1Like型
  src/lib/posts.ts                  # listPosts / getPostBySlug
  src/pages/...                     # 最小の一覧・詳細・/media
  test/                             # vitest
.github/workflows/cf-deploy.yml
```

---

### Task 1: cf-site のスキャフォールドとテスト基盤

**Files:**
- Create: `cf-site/package.json`, `cf-site/tsconfig.json`, `cf-site/vitest.config.ts`, `cf-site/.gitignore`, `cf-site/test/smoke.test.ts`

**Interfaces:**
- Produces: `npm test`（vitest）、`npm run dev`/`build`（Astro）のスクリプト。

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "cf-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler dev",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^7.3.8",
    "@astrojs/cloudflare": "^14.3.4"
  },
  "devDependencies": {
    "wrangler": "^4.151.0",
    "vitest": "^5.0.4",
    "typescript": "^7.0.2",
    "@types/node": "^24.0.0"
  }
}
```

- [ ] **Step 2: 設定ファイルを作成**

`tsconfig.json`:
```json
{ "extends": "astro/tsconfigs/strict", "include": ["src", "scripts", "test"] }
```
`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/**/*.test.ts"], environment: "node" } });
```
`.gitignore`: `node_modules/`, `dist/`, `.wrangler/`, `.astro/`, `data/`（export.json・uploadsの置き場。コミットしない）。

- [ ] **Step 3: スモークテストを書き、失敗を確認**

`test/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
test("node:sqlite is available", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("create table t(a)");
  expect(db.prepare("select count(*) c from t").get()).toEqual({ c: 0 });
});
```
Run: `cd cf-site && npm install && npm test`
Expected: PASS（`node:sqlite` が使えること自体が以降のテストの前提。FAILなら Node 24 を確認）。

- [ ] **Step 4: Commit**

```bash
git add cf-site && git commit -m "chore(cf-site): scaffold with vitest" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: D1スキーマ

**Files:**
- Create: `cf-site/migrations/0001_init.sql`, `cf-site/test/schema.test.ts`, `cf-site/test/helpers/db.ts`

**Interfaces:**
- Produces: テーブル `posts, post_meta, terms, post_terms, settings, views`。`helpers/db.ts` の `newDb(): DatabaseSync`（スキーマ適用済みインメモリDB）。

- [ ] **Step 1: 失敗するテストを書く**

`test/helpers/db.ts`:
```ts
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function newDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../../migrations/0001_init.sql", import.meta.url), "utf8"));
  return db;
}
```
`test/schema.test.ts`:
```ts
import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
test("tables exist and slug is unique per type", () => {
  const db = newDb();
  const names = db.prepare("select name from sqlite_master where type='table' order by name").all().map((r: any) => r.name);
  for (const t of ["post_meta", "post_terms", "posts", "settings", "terms", "views"]) expect(names).toContain(t);
  db.exec("insert into posts(wp_id,type,slug,title,published_at,modified_at) values(1,'works','a','t','2026-01-01','2026-01-01')");
  expect(() => db.exec("insert into posts(wp_id,type,slug,title,published_at,modified_at) values(2,'works','a','t','2026-01-01','2026-01-01')")).toThrow();
});
```
- [ ] **Step 2: 実行して失敗を確認** — `npm test -- schema` → FAIL（sqlファイルなし）
- [ ] **Step 3: スキーマを書く**

```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wp_id INTEGER NOT NULL UNIQUE,
  type TEXT NOT NULL,              -- works | column | news | page
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'publish',
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  title_en TEXT,
  excerpt_en TEXT,
  content_en TEXT,
  thumbnail TEXT,                  -- R2キー（例 2026/07/a.webp）。未設定はNULL
  menu_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  UNIQUE (type, slug)
);
CREATE INDEX idx_posts_type_pub ON posts(type, published_at DESC);

CREATE TABLE post_meta (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,             -- JSON
  PRIMARY KEY (post_id, key)
);

CREATE TABLE terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taxonomy TEXT NOT NULL,          -- works_type | skill | industry | news_type
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  UNIQUE (taxonomy, slug)
);

CREATE TABLE post_terms (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, term_id)
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- JSON

CREATE TABLE views (post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE, count INTEGER NOT NULL DEFAULT 0);
```
- [ ] **Step 4: 実行して成功を確認** — `npm test -- schema` → PASS
- [ ] **Step 5: Commit** — `git add cf-site && git commit -m "feat(cf-site): D1 schema"`（Co-Authored-By行を付ける）

---

### Task 3: 本文変換（URL書き換え・WP固有記法検出）

**Files:**
- Create: `cf-site/scripts/lib/types.ts`, `cf-site/scripts/lib/transform.ts`, `cf-site/test/transform.test.ts`

**Interfaces:**
- Produces（`types.ts`、全タスク共通）:
```ts
export interface WpTermRef { taxonomy: string; slug: string }
export interface WpPost {
  id: number; type: string; slug: string; status: string; title: string;
  excerpt: string; content: string; date: string; modified: string;
  thumbnail_id: number | null; menu_order: number; password_protected: boolean;
  meta: Record<string, unknown>; terms: WpTermRef[]; views: number;
}
export interface WpTerm { taxonomy: string; slug: string; name: string; description: string }
export interface WpAttachment { id: number; path: string; mime: string }   // path = uploads相対 (2026/07/a.webp)
export interface WpExport {
  exported_at: string; site_url: string;       // 例 https://shinnosuke-kobayashi.jp
  posts: WpPost[]; terms: WpTerm[]; attachments: WpAttachment[];
  options: Record<string, string>;
}
```
- `transform.ts`: `rewriteUploads(html: string, siteUrl: string): string`、`findWpArtifacts(html: string): string[]`（検出した `[shortcode]` / `<!-- wp:` 文字列）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
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
```
注: 3つ目の `[text]` は既知ショートコード名のみ検出する設計（`gallery|caption|embed|contact-form-7|video|audio|playlist`）。
- [ ] **Step 2: 実行して失敗を確認** — `npm test -- transform` → FAIL
- [ ] **Step 3: 実装**

```ts
const ESC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function rewriteUploads(html: string, siteUrl: string): string {
  const host = new URL(siteUrl).host;
  const abs = new RegExp(`https?://${ESC(host)}/wp-content/uploads/`, "g");
  const sized = /(\/media\/[^\s"'<>,]*?)-\d+x\d+(\.[A-Za-z0-9]+)/g;
  return html
    .replace(abs, "/media/")
    .replace(/(["'(\s=])\/wp-content\/uploads\//g, "$1/media/")
    .replace(sized, "$1$2");
}

const SHORTCODES = "gallery|caption|embed|contact-form-7|video|audio|playlist";
export function findWpArtifacts(html: string): string[] {
  const re = new RegExp(`\\[(?:${SHORTCODES})\\b[^\\]]*\\]|<!--\\s*/?wp:[^>]*-->`, "g");
  return html.match(re) ?? [];
}
```
- [ ] **Step 4: 実行して成功を確認** — `npm test -- transform` → PASS
- [ ] **Step 5: Commit** — `feat(cf-site): content transform`

---

### Task 4: インポートSQL生成

**Files:**
- Create: `cf-site/scripts/lib/import-sql.ts`, `cf-site/test/import-sql.test.ts`, `cf-site/test/fixtures/export.ts`

**Interfaces:**
- Consumes: `WpExport`（Task 3）、`rewriteUploads`、`findWpArtifacts`。
- Produces: `buildImportSql(exp: WpExport): { statements: string[]; skipped: { id: number; reason: string }[]; artifacts: { id: number; items: string[] }[] }`。`statements` は先頭がDELETE（再実行可能）、続いて INSERT。メタキー `title_en/excerpt_en/content_en` は `posts` の列へ移し、`post_meta` には入れない。空文字はNULL。`thumbnail_id`→attachments.pathを `thumbnail` に。`views` は `views` テーブルへ。`options` は `settings`（JSON文字列）へ。

- [ ] **Step 1: フィクスチャと失敗するテストを書く**

`fixtures/export.ts` に `WpExport` を1つ書く: works(公開, thumbnail有, meta `gallery:[1,2]`, `kpi_results:[{label:"CV",value:"1.5倍"}]`, `title_en:"EN"`, `content_en:""`, title=`O'Brien "Q" \\ 😀\n2行目`, terms=works_type/web・skill/seo, views=12)、works(thumbnail_id=999=存在しない添付)、column(status=draft)、news(password_protected=true)、page profile(meta `profile_name`)、options `{blogname:"小林慎之助 公式ホームページ"}`。

`import-sql.test.ts`（`node:sqlite` で `newDb()` に全statementsを実行して検証）:
```ts
import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";

function load() { const db = newDb(); const r = buildImportSql(exp); for (const s of r.statements) db.exec(s); return { db, r }; }

test("imports only published, non-protected posts", () => {
  const { db, r } = load();
  expect(db.prepare("select count(*) c from posts").get()).toEqual({ c: 3 }); // works x2 + profile page
  expect(r.skipped.map(s => s.reason).sort()).toEqual(["password_protected", "status:draft"]);
});
test("special characters round-trip exactly", () => {
  const { db } = load();
  expect((db.prepare("select title from posts where wp_id=?").get(exp.posts[0].id) as any).title).toBe(exp.posts[0].title);
});
test("missing thumbnail attachment -> NULL, no throw", () => {
  const { db } = load();
  expect((db.prepare("select thumbnail from posts where wp_id=?").get(exp.posts[1].id) as any).thumbnail).toBeNull();
});
test("EN fields: empty -> NULL, present kept; not duplicated in post_meta", () => {
  const { db } = load();
  const p = db.prepare("select title_en, content_en from posts where wp_id=?").get(exp.posts[0].id) as any;
  expect(p).toEqual({ title_en: "EN", content_en: null });
  expect(db.prepare("select count(*) c from post_meta where key like '%\\_en' escape '\\' and key in ('title_en','excerpt_en','content_en')").get()).toEqual({ c: 0 });
});
test("array/object meta stored as JSON and round-trips", () => {
  const { db } = load();
  const row = db.prepare("select value from post_meta pm join posts p on p.id=pm.post_id where p.wp_id=? and pm.key='kpi_results'").get(exp.posts[0].id) as any;
  expect(JSON.parse(row.value)).toEqual([{ label: "CV", value: "1.5倍" }]);
});
test("terms linked, views and settings stored, underscore meta excluded, rerun is idempotent", () => {
  const { db, r } = load();
  expect(db.prepare("select count(*) c from post_terms").get()).toEqual({ c: 2 });
  expect((db.prepare("select count from views v join posts p on p.id=v.post_id where p.wp_id=?").get(exp.posts[0].id) as any).count).toBe(12);
  expect(JSON.parse((db.prepare("select value from settings where key='blogname'").get() as any).value)).toBe("小林慎之助 公式ホームページ");
  for (const s of r.statements) db.exec(s);   // 2回目
  expect(db.prepare("select count(*) c from posts").get()).toEqual({ c: 3 });
});
```
- [ ] **Step 2: 実行して失敗を確認** — `npm test -- import-sql` → FAIL
- [ ] **Step 3: 実装**（要点。全体を書くこと）

```ts
import type { WpExport } from "./types.ts";
import { rewriteUploads, findWpArtifacts } from "./transform.ts";

const q = (v: string | number | null): string =>
  v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`;
const nz = (s: unknown): string | null => (typeof s === "string" && s.trim() !== "" ? s : null);
const EN_KEYS = new Set(["title_en", "excerpt_en", "content_en"]);

export function buildImportSql(exp: WpExport) {
  const statements: string[] = [
    "DELETE FROM post_terms;", "DELETE FROM views;", "DELETE FROM post_meta;",
    "DELETE FROM posts;", "DELETE FROM terms;", "DELETE FROM settings;",
  ];
  const skipped: { id: number; reason: string }[] = [];
  const artifacts: { id: number; items: string[] }[] = [];
  const attach = new Map(exp.attachments.map((a) => [a.id, a.path]));
  const rw = (s: string | null) => (s === null ? null : rewriteUploads(s, exp.site_url));

  for (const t of exp.terms)
    statements.push(`INSERT INTO terms(taxonomy,slug,name,description) VALUES(${q(t.taxonomy)},${q(t.slug)},${q(t.name)},${q(nz(t.description))});`);

  for (const p of exp.posts) {
    if (p.password_protected) { skipped.push({ id: p.id, reason: "password_protected" }); continue; }
    if (p.status !== "publish") { skipped.push({ id: p.id, reason: `status:${p.status}` }); continue; }
    const m = p.meta;
    const content = rw(nz(p.content)), contentEn = rw(nz(m.content_en));
    const found = [...findWpArtifacts(content ?? ""), ...findWpArtifacts(contentEn ?? "")];
    if (found.length) artifacts.push({ id: p.id, items: found });
    const thumb = p.thumbnail_id !== null ? attach.get(p.thumbnail_id) ?? null : null;
    statements.push(
      `INSERT INTO posts(wp_id,type,slug,status,title,excerpt,content,title_en,excerpt_en,content_en,thumbnail,menu_order,published_at,modified_at) VALUES(` +
      [p.id, q(p.type), q(p.slug), q("publish"), q(p.title), q(nz(p.excerpt)), q(content), q(nz(m.title_en)), q(nz(m.excerpt_en)), q(contentEn), q(thumb), p.menu_order, q(p.date), q(p.modified)].join(",") + ");",
    );
    for (const [k, v] of Object.entries(m)) {
      if (k.startsWith("_") || EN_KEYS.has(k) || v === null || v === "") continue;
      statements.push(`INSERT INTO post_meta(post_id,key,value) VALUES((SELECT id FROM posts WHERE wp_id=${p.id}),${q(k)},${q(JSON.stringify(v))});`);
    }
    for (const t of p.terms)
      statements.push(`INSERT OR IGNORE INTO post_terms(post_id,term_id) VALUES((SELECT id FROM posts WHERE wp_id=${p.id}),(SELECT id FROM terms WHERE taxonomy=${q(t.taxonomy)} AND slug=${q(t.slug)}));`);
    if (p.views > 0)
      statements.push(`INSERT INTO views(post_id,count) VALUES((SELECT id FROM posts WHERE wp_id=${p.id}),${p.views});`);
  }
  for (const [k, v] of Object.entries(exp.options))
    statements.push(`INSERT INTO settings(key,value) VALUES(${q(k)},${q(JSON.stringify(v))});`);
  return { statements, skipped, artifacts };
}
```
注意: `post_terms` の term が見つからない場合 `term_id` がNULLでNOT NULL違反になる→テストが検出する。タクソノミーに無いtermはexport側の不整合なので、そのままエラーで止める（握りつぶさない）。
- [ ] **Step 4: 実行して成功を確認** — `npm test -- import-sql` → PASS（6件）
- [ ] **Step 5: Commit** — `feat(cf-site): WP export -> D1 import SQL`

---

### Task 5: 突合検証（verify）

**Files:**
- Create: `cf-site/scripts/lib/verify.ts`, `cf-site/test/verify.test.ts`

**Interfaces:**
- Consumes: `WpExport`、`buildImportSql`の方針（公開・非保護のみ）。
- Produces: `expectedCounts(exp: WpExport): { posts: Record<string, number>; postTerms: number; attachmentsReferenced: number }`、`compareCounts(expected, actual): string[]`（差異メッセージ配列、空なら一致）、`findBrokenMediaLinks(html: string, knownPaths: Set<string>): string[]`（`/media/…` で既知パスに無いもの）。

- [ ] **Step 1: 失敗するテストを書く**
```ts
import { expect, test } from "vitest";
import { expectedCounts, compareCounts, findBrokenMediaLinks } from "../scripts/lib/verify.ts";
import { exp } from "./fixtures/export.ts";
test("expected counts exclude draft/protected", () => {
  const c = expectedCounts(exp);
  expect(c.posts).toEqual({ works: 2, page: 1 });
  expect(c.postTerms).toBe(2);
});
test("compareCounts reports differences", () => {
  expect(compareCounts({ posts: { works: 2 }, postTerms: 2, attachmentsReferenced: 0 }, { posts: { works: 1 }, postTerms: 2, attachmentsReferenced: 0 }))
    .toEqual(["posts.works: expected 2, actual 1"]);
  expect(compareCounts(expectedCounts(exp), expectedCounts(exp))).toEqual([]);
});
test("broken media links", () => {
  expect(findBrokenMediaLinks(`<img src="/media/a.webp"><img src="/media/gone.png">`, new Set(["a.webp"]))).toEqual(["gone.png"]);
});
```
- [ ] **Step 2: 失敗確認** — `npm test -- verify` → FAIL
- [ ] **Step 3: 実装**
```ts
import type { WpExport } from "./types.ts";
export interface Counts { posts: Record<string, number>; postTerms: number; attachmentsReferenced: number }
export function expectedCounts(exp: WpExport): Counts {
  const posts: Record<string, number> = {}; let postTerms = 0; const att = new Set<number>();
  for (const p of exp.posts) {
    if (p.password_protected || p.status !== "publish") continue;
    posts[p.type] = (posts[p.type] ?? 0) + 1;
    postTerms += new Set(p.terms.map((t) => `${t.taxonomy}/${t.slug}`)).size;
    if (p.thumbnail_id !== null && exp.attachments.some((a) => a.id === p.thumbnail_id)) att.add(p.thumbnail_id);
  }
  return { posts, postTerms, attachmentsReferenced: att.size };
}
export function compareCounts(e: Counts, a: Counts): string[] {
  const out: string[] = [];
  for (const k of new Set([...Object.keys(e.posts), ...Object.keys(a.posts)]))
    if ((e.posts[k] ?? 0) !== (a.posts[k] ?? 0)) out.push(`posts.${k}: expected ${e.posts[k] ?? 0}, actual ${a.posts[k] ?? 0}`);
  if (e.postTerms !== a.postTerms) out.push(`postTerms: expected ${e.postTerms}, actual ${a.postTerms}`);
  if (e.attachmentsReferenced !== a.attachmentsReferenced) out.push(`attachmentsReferenced: expected ${e.attachmentsReferenced}, actual ${a.attachmentsReferenced}`);
  return out;
}
export function findBrokenMediaLinks(html: string, known: Set<string>): string[] {
  return [...html.matchAll(/\/media\/([^\s"'<>,)]+)/g)].map((m) => m[1]).filter((p) => !known.has(p));
}
```
- [ ] **Step 4: 成功確認** → PASS
- [ ] **Step 5: Commit** — `feat(cf-site): verification helpers`

---

### Task 6: CLI（import / verify）とWP書き出しスクリプト

**Files:**
- Create: `cf-site/scripts/wp-export.php`, `cf-site/scripts/import.ts`, `cf-site/scripts/verify.ts`, `cf-site/test/cli-roundtrip.test.ts`

**Interfaces:**
- Consumes: `buildImportSql`、`expectedCounts`、`compareCounts`、`findBrokenMediaLinks`。
- Produces: `node scripts/import.ts data/export.json > data/import.sql`（`wrangler d1 execute DB --file data/import.sql [--local|--remote]` で適用）。`node scripts/verify.ts data/export.json --local|--remote` はD1に `wrangler d1 execute DB --json --command` で件数を問い合わせて `compareCounts` を実行し、差異があれば終了コード1。

- [ ] **Step 1: 通しテスト（import→query往復）を書く**

`cli-roundtrip.test.ts`: フィクスチャ `exp` を `buildImportSql` → `newDb()` へ適用 → `posts`/`post_meta` から読み出した値を再構成し、`gallery` と `kpi_results` が元のJSONと `toEqual` で同一であること、`expectedCounts(exp)` と DB実測 `Counts` を `compareCounts` に渡して `[]` になることを検証する（DB実測はテスト内で `select type,count(*) … group by type` 等で組み立てる）。
- [ ] **Step 2: 実行** — `npm test -- cli-roundtrip` → 初回は `import.ts` 未作成でも libだけで通るはずなので PASS を確認（このタスクのテストは lib の総合確認）。FAILならlibを修正。
- [ ] **Step 3: wp-export.php を書く**

VMで `sudo -u www-data wp --path=/var/www/html eval-file wp-export.php > export.json` と実行する想定（パスはVMで確認: `wp --info`）。内容:
```php
<?php
// 読み取り専用。全公開CPT・メタ・タクソノミー・添付・オプションをJSONで出力
$types = array('works', 'column', 'news', 'page');
$posts = array();
foreach ($types as $t) {
  $q = get_posts(array('post_type' => $t, 'post_status' => 'any', 'numberposts' => -1, 'suppress_filters' => true));
  foreach ($q as $p) {
    $meta = array();
    foreach (get_post_meta($p->ID) as $k => $vals) {
      if ($k === '_thumbnail_id') continue;
      $meta[$k] = maybe_unserialize($vals[0]);
    }
    $terms = array();
    foreach (get_object_taxonomies($t) as $tax) {
      foreach ((array) wp_get_object_terms($p->ID, $tax) as $term) $terms[] = array('taxonomy' => $tax, 'slug' => $term->slug);
    }
    $posts[] = array(
      'id' => $p->ID, 'type' => $t, 'slug' => $p->post_name, 'status' => $p->post_status,
      'title' => $p->post_title, 'excerpt' => $p->post_excerpt, 'content' => $p->post_content,
      'date' => $p->post_date_gmt, 'modified' => $p->post_modified_gmt,
      'thumbnail_id' => get_post_thumbnail_id($p->ID) ?: null, 'menu_order' => (int) $p->menu_order,
      'password_protected' => $p->post_password !== '',
      'meta' => $meta, 'terms' => $terms, 'views' => (int) get_post_meta($p->ID, 'kb_views', true),
    );
  }
}
$terms = array();
foreach (array('works_type', 'skill', 'industry', 'news_type') as $tax)
  foreach (get_terms(array('taxonomy' => $tax, 'hide_empty' => false)) as $x)
    $terms[] = array('taxonomy' => $tax, 'slug' => $x->slug, 'name' => $x->name, 'description' => $x->description);
$atts = array();
foreach (get_posts(array('post_type' => 'attachment', 'post_status' => 'any', 'numberposts' => -1)) as $a)
  $atts[] = array('id' => $a->ID, 'path' => get_post_meta($a->ID, '_wp_attached_file', true), 'mime' => $a->post_mime_type);
$opts = array();
foreach (array('blogname', 'blogdescription') as $o) $opts[$o] = (string) get_option($o);
echo wp_json_encode(array('exported_at' => gmdate('c'), 'site_url' => home_url(), 'posts' => $posts, 'terms' => $terms, 'attachments' => $atts, 'options' => $opts), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
```
`date` はGMTで出力するため、`published_at` はUTCのISO文字列として保存される（表示時にJSTへ変換する。サブプロジェクト2の注意点としてspecへ追記）。
- [ ] **Step 4: import.ts / verify.ts を書く**

`import.ts`:
```ts
import { readFileSync } from "node:fs";
import { buildImportSql } from "./lib/import-sql.ts";
const exp = JSON.parse(readFileSync(process.argv[2], "utf8"));
const r = buildImportSql(exp);
process.stdout.write(r.statements.join("\n") + "\n");
console.error(`statements=${r.statements.length} skipped=${JSON.stringify(r.skipped)} artifacts=${JSON.stringify(r.artifacts)}`);
```
`verify.ts`: `process.argv[3]` が `--local`/`--remote`。`execFileSync("npx", ["wrangler","d1","execute","DB",flag,"--json","--command", sql])` で `SELECT type, COUNT(*) c FROM posts GROUP BY type` / `SELECT COUNT(*) c FROM post_terms` / `SELECT COUNT(DISTINCT thumbnail) c FROM posts WHERE thumbnail IS NOT NULL` を実行し `Counts` を組み立て、`compareCounts` の結果を出力。差異ありなら `process.exit(1)`。（wrangler `--json` の出力形状は実行して確認し、`results[0].results` を読む。）
- [ ] **Step 5: 全テスト実行** — `npm test` → 全PASS
- [ ] **Step 6: Commit** — `feat(cf-site): wp export script and import/verify CLIs`

---

### Task 7: メディア同期（R2）

**Files:**
- Create: `cf-site/scripts/lib/media.ts`, `cf-site/scripts/sync-media.ts`, `cf-site/test/media.test.ts`

**Interfaces:**
- Produces: `mediaKey(uploadsRelPath: string): string`（`2026/07/a.webp`→そのまま。`..` や先頭`/`を含む場合はthrow）、`originalsOnly(paths: string[]): string[]`（`-300x200` 等のサイズ違いを除外）。

- [ ] **Step 1: 失敗するテスト**
```ts
import { expect, test } from "vitest";
import { mediaKey, originalsOnly } from "../scripts/lib/media.ts";
test("mediaKey rejects traversal", () => {
  expect(mediaKey("2026/07/a.webp")).toBe("2026/07/a.webp");
  expect(() => mediaKey("../etc/passwd")).toThrow();
  expect(() => mediaKey("/abs.png")).toThrow();
});
test("originalsOnly drops resized variants", () => {
  expect(originalsOnly(["a.jpg", "a-300x200.jpg", "b-1x1-final.png"])).toEqual(["a.jpg", "b-1x1-final.png"]);
});
```
- [ ] **Step 2: 失敗確認**
- [ ] **Step 3: 実装**
```ts
export function mediaKey(p: string): string {
  if (p.startsWith("/") || p.split("/").includes("..") || p.includes("\0")) throw new Error(`unsafe media path: ${p}`);
  return p;
}
export const originalsOnly = (paths: string[]) => paths.filter((p) => !/-\d+x\d+\.[A-Za-z0-9]+$/.test(p));
```
`sync-media.ts`: `data/uploads/`（VMから `gcloud compute scp --recurse --account=hello@shinnosuke-kobayashi.jp` で取得、または `rsync`）配下の `originalsOnly` を走査し、各ファイルを `wrangler r2 object put <bucket>/<key> --file <path> --content-type <mime> --local|--remote` でアップロード。アップロード件数と `export.json` の `attachments` 件数が合わない場合は差分を出力して終了コード1。
- [ ] **Step 4: 成功確認** — `npm test -- media` → PASS
- [ ] **Step 5: Commit** — `feat(cf-site): media sync helpers`

---

### Task 8: D1クエリ層と最小の一覧・詳細ページ

**Files:**
- Create: `cf-site/astro.config.mjs`, `cf-site/wrangler.jsonc`, `cf-site/src/lib/d1.ts`, `cf-site/src/lib/env.ts`, `cf-site/src/lib/posts.ts`, `cf-site/src/pages/[type]/index.astro`, `cf-site/src/pages/[type]/[slug].astro`, `cf-site/src/pages/media/[...path].ts`, `cf-site/test/posts.test.ts`, `cf-site/test/helpers/d1shim.ts`

**Interfaces:**
- Produces:
```ts
// d1.ts
export interface D1Like { prepare(sql: string): { bind(...a: unknown[]): { all<T>(): Promise<{ results: T[] }>; first<T>(): Promise<T | null> } } }
// posts.ts
export interface PostRow { id: number; type: string; slug: string; title: string; title_en: string | null; content: string | null; content_en: string | null; thumbnail: string | null; published_at: string }
export function listPosts(db: D1Like, type: string, limit?: number): Promise<PostRow[]>   // published_at DESC
export function getPostBySlug(db: D1Like, type: string, slug: string): Promise<(PostRow & { meta: Record<string, unknown>; terms: { taxonomy: string; slug: string; name: string }[] }) | null>
```
- `env.ts`: `getEnv(locals): { DB: D1Database; MEDIA: R2Bucket; CACHE: KVNamespace }` — バインディング取得は**ここだけ**。

- [ ] **Step 1: shimと失敗するテストを書く**

`d1shim.ts`: `node:sqlite` の `DatabaseSync` を `D1Like` に包む（`prepare(sql).bind(...a).all()` → `{results: stmt.all(...a)}`、`first()` → `stmt.get(...a) ?? null`）。
`posts.test.ts`: フィクスチャを `buildImportSql` で投入し、(a) `listPosts(db,"works")` が公開日降順で2件、draftのcolumnは0件、(b) `getPostBySlug(db,"works",slug)` が `meta.kpi_results` を配列として返し `terms` に `web` を含む、(c) 存在しないslugで `null`、を検証。
- [ ] **Step 2: 失敗確認** — `npm test -- posts` → FAIL
- [ ] **Step 3: posts.ts 実装**
```ts
import type { D1Like } from "./d1.ts";
export async function listPosts(db: D1Like, type: string, limit = 50) {
  const { results } = await db.prepare(
    "SELECT id,type,slug,title,title_en,content,content_en,thumbnail,published_at FROM posts WHERE type=? AND status='publish' ORDER BY published_at DESC LIMIT ?",
  ).bind(type, limit).all<PostRow>();
  return results;
}
export async function getPostBySlug(db: D1Like, type: string, slug: string) {
  const post = await db.prepare(
    "SELECT id,type,slug,title,title_en,content,content_en,thumbnail,published_at FROM posts WHERE type=? AND slug=? AND status='publish'",
  ).bind(type, slug).first<PostRow>();
  if (!post) return null;
  const m = await db.prepare("SELECT key,value FROM post_meta WHERE post_id=?").bind(post.id).all<{ key: string; value: string }>();
  const t = await db.prepare(
    "SELECT t.taxonomy,t.slug,t.name FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id=?",
  ).bind(post.id).all<{ taxonomy: string; slug: string; name: string }>();
  return { ...post, meta: Object.fromEntries(m.results.map((r) => [r.key, JSON.parse(r.value)])), terms: t.results };
}
```
（`PostRow` 型もexport。）
- [ ] **Step 4: 成功確認** — `npm test -- posts` → PASS
- [ ] **Step 5: Cloudflareバインディングの配線（公式ドキュメント確認が必須）**
  1. `npx wrangler d1 create kb-site` / `npx wrangler r2 bucket create kb-media` / `npx wrangler kv namespace create CACHE` を実行（**ユーザーのCloudflareアカウントでのログイン `npx wrangler login` が必要**。実行前にユーザーへ確認する。課金・公開に影響するのはDNS切替のみで、これらの作成は無影響）。
  2. `https://docs.astro.build/en/guides/integrations-guide/cloudflare/` を取得し、Astro 7 / adapter 14 でのバインディング取得方法（`Astro.locals` か `cloudflare:workers` の `env`）を確認して `env.ts` に反映する。`wrangler.jsonc` の `d1_databases`（binding `DB`）、`r2_buckets`（`MEDIA`）、`kv_namespaces`（`CACHE`）にIDを記入。
  3. `astro.config.mjs` に `output: "server"` と cloudflare adapter を設定。
  4. ページ: `[type]/index.astro` は `type ∈ {works,column,news}` のみ許可し `listPosts` で `<ul>` 表示、`[type]/[slug].astro` は `getPostBySlug`（無ければ404）で `<h1>` と `set:html={post.content}`、`media/[...path].ts` は `MEDIA.get(path)` をそのまま返す（無ければ404・`Cache-Control: public, max-age=31536000, immutable`）。UIは確認用のプレーンHTMLに留める。
- [ ] **Step 6: ローカル通し確認**
```bash
cd cf-site
npx wrangler d1 migrations apply DB --local
node scripts/import.ts data/export.json > data/import.sql
npx wrangler d1 execute DB --local --file data/import.sql
node scripts/verify.ts data/export.json --local     # 期待: 差異なし
npm run build && npx wrangler dev
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/works/<実在slug>/    # 期待: 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/works/not-exist/     # 期待: 404
```
（`data/export.json` はTask 9で取得。取得前はTask 6のフィクスチャから作ったJSONで代用可。）
- [ ] **Step 7: Commit** — `feat(cf-site): D1 query layer and minimal pages`

---

### Task 9: 本番データの取得とローカル検証（読み取り専用）

**Files:**
- Create: `cf-site/data/`（gitignore済み。export.json と uploads/）

**Interfaces:**
- Consumes: Task 6 の `wp-export.php`、Task 7 の `sync-media.ts`。
- Produces: `data/export.json`、`data/uploads/`、ローカルD1/R2に取り込み済みの状態。

- [ ] **Step 1: ユーザーに確認** — 「VMへ読み取り専用でSSH/スナップショット作成を行う」旨を伝え、承認を得る。（GCPのスナップショット作成は課金が微増する。）
- [ ] **Step 2: スナップショットとDBダンプ**
```bash
gcloud compute disks snapshot wp-portfolio --zone=asia-northeast1-b --project=shinnosuke-kbys --account=hello@shinnosuke-kobayashi.jp --snapshot-names=pre-cf-migration-20261014
gcloud compute ssh wp-portfolio --zone=asia-northeast1-b --project=shinnosuke-kbys --account=hello@shinnosuke-kobayashi.jp --command='cd /var/www/html && sudo -u www-data wp db export /tmp/pre-cf.sql && ls -l /tmp/pre-cf.sql'
```
（`/var/www/html` はVMで `wp --info` により確認し、異なれば読み替える。）ダンプはローカルの `data/backup/` へ `gcloud compute scp` で取得。
- [ ] **Step 3: 書き出し**
```bash
gcloud compute scp cf-site/scripts/wp-export.php wp-portfolio:/tmp/ --zone=asia-northeast1-b --project=shinnosuke-kbys --account=hello@shinnosuke-kobayashi.jp
gcloud compute ssh wp-portfolio ... --command='cd /var/www/html && sudo -u www-data wp eval-file /tmp/wp-export.php' > cf-site/data/export.json
node -e "const e=require('./cf-site/data/export.json');console.log(e.posts.length,e.attachments.length)"
```
Expected: 件数が管理画面の記事数（実績7件など）と整合。
- [ ] **Step 4: uploads 取得** — `gcloud compute scp --recurse wp-portfolio:/var/www/html/wp-content/uploads cf-site/data/uploads ...`
- [ ] **Step 5: ローカル取り込み** — Task 8 Step 6 のコマンドを実データで実行し、`import.ts` の stderr に出る `skipped` と `artifacts`（WP固有記法）を確認。`artifacts` が出た記事は一覧をユーザーに報告し、変換方針（手修正 or 許可リスト）を相談する（ここで判断を止める）。
- [ ] **Step 6: ローカルR2へ同期と画像確認** — `node scripts/sync-media.ts data/export.json --local` → `wrangler dev` で `/media/<実在パス>` が200。
- [ ] **Step 7: 旧サイトとの内容比較**（Task 10の `compare-urls.ts` 完成後に実施）

（このタスクは成果物がデータでありコミット対象なし。）

---

### Task 10: URL一覧生成と新旧比較スクリプト

**Files:**
- Create: `cf-site/scripts/lib/urls.ts`, `cf-site/scripts/compare-urls.ts`, `cf-site/test/urls.test.ts`

**Interfaces:**
- Consumes: `WpExport`。
- Produces: `urlsFor(exp: WpExport): string[]`（`/works/<slug>/` 等と `/`、`/en/` 版を含む重複なしの昇順一覧。`page` は `/<slug>/`）、`extractHead(html: string): { title: string | null; canonical: string | null }`、`diffPage(a, b): string[]`。

- [ ] **Step 1: 失敗するテスト**
```ts
import { expect, test } from "vitest";
import { urlsFor, extractHead, diffPage } from "../scripts/lib/urls.ts";
import { exp } from "./fixtures/export.ts";
test("urlsFor lists published posts, ja and en, no drafts, no duplicates", () => {
  const u = urlsFor(exp);
  expect(u).toContain("/"); expect(u).toContain("/en/");
  expect(u.some((x) => x.startsWith("/works/"))).toBe(true);
  expect(new Set(u).size).toBe(u.length);
  expect(u.join()).not.toContain(exp.posts[2].slug); // draft column
});
test("extractHead", () => {
  expect(extractHead(`<head><title>A | B</title><link rel="canonical" href="https://x/y/"></head>`)).toEqual({ title: "A | B", canonical: "https://x/y/" });
  expect(extractHead("<p>none</p>")).toEqual({ title: null, canonical: null });
});
test("diffPage compares status/title/canonical path", () => {
  expect(diffPage({ status: 200, title: "T", canonical: "https://a/x/" }, { status: 200, title: "T", canonical: "https://b/x/" })).toEqual([]);
  expect(diffPage({ status: 200, title: "T", canonical: null }, { status: 404, title: "T2", canonical: null })).toEqual(["status: 200 vs 404", "title: T vs T2"]);
});
```
- [ ] **Step 2: 失敗確認**
- [ ] **Step 3: 実装**
```ts
import type { WpExport } from "./types.ts";
export function urlsFor(exp: WpExport): string[] {
  const set = new Set<string>(["/", "/en/"]);
  for (const p of exp.posts) {
    if (p.status !== "publish" || p.password_protected) continue;
    const path = p.type === "page" ? `/${p.slug}/` : `/${p.type}/${p.slug}/`;
    set.add(path); set.add(`/en${path}`);
  }
  return [...set].sort();
}
export function extractHead(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? null;
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
  return { title, canonical };
}
type Snap = { status: number; title: string | null; canonical: string | null };
const pathOf = (u: string | null) => (u ? new URL(u).pathname : null);
export function diffPage(a: Snap, b: Snap): string[] {
  const out: string[] = [];
  if (a.status !== b.status) out.push(`status: ${a.status} vs ${b.status}`);
  if (a.title !== b.title) out.push(`title: ${a.title} vs ${b.title}`);
  if (pathOf(a.canonical) !== pathOf(b.canonical)) out.push(`canonical: ${a.canonical} vs ${b.canonical}`);
  return out;
}
```
`/en/…` の実在判定は未実装のため、`/en/` 版は旧サイトで404なら比較結果に出る＝許容（結果を人が確認する）。
- [ ] **Step 4: 成功確認** → PASS
- [ ] **Step 5: `compare-urls.ts` を書く** — 引数 `<export.json> <oldBase> <newBase>`。`urlsFor` の各URLを両ベースへ `fetch`（`redirect: "manual"`、並列4、タイムアウト30秒）、`extractHead` → `diffPage`、差異のあるURLのみ列挙、差異があれば終了コード1。
- [ ] **Step 6: Commit** — `feat(cf-site): URL list and old/new comparison`

---

### Task 11: CIデプロイワークフロー（DNSは触らない）

**Files:**
- Create: `.github/workflows/cf-deploy.yml`

- [ ] **Step 1: ワークフローを書く**
```yaml
name: Deploy cf-site to Cloudflare
on:
  push:
    branches: [main]
    paths: ["cf-site/**", ".github/workflows/cf-deploy.yml"]
  workflow_dispatch:
concurrency: { group: cf-deploy, cancel-in-progress: false }
jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: cf-site } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: cf-site/package-lock.json }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```
`wrangler.jsonc` は `workers_dev` のURL（`*.workers.dev`）にのみデプロイし、`routes` は設定しない（本番ドメインに触れない）。
- [ ] **Step 2: ユーザーへ依頼** — GitHub Secrets `CLOUDFLARE_API_TOKEN`（Workers/D1/R2/KV 編集権限）と `CLOUDFLARE_ACCOUNT_ID` の登録。登録前はこのワークフローが失敗する旨を伝え、登録確認後に初回実行する。
- [ ] **Step 3: リモートD1/R2へ本番データ投入** — `wrangler d1 migrations apply DB --remote` → `import.sql` を `--remote` で適用 → `verify.ts --remote` で差異なし → `sync-media.ts --remote`。**これはCloudflare側の新規リソースへの書き込みであり、現行サイトには影響しない。**実行前にユーザーへ確認する。
- [ ] **Step 4: workers.dev URLで確認** — `compare-urls.ts data/export.json https://shinnosuke-kobayashi.jp https://<name>.<subdomain>.workers.dev` を実行し、差異一覧をユーザーへ報告（サブプロジェクト2で解消する項目の入力になる）。
- [ ] **Step 5: CLAUDE.md を更新して Commit** — ファイルマップに `cf-site/`・移行中である旨・`docs/superpowers/` を追記。`git commit -m "ci(cf-site): deploy workflow and docs"`

---

## Self-Review

- **Spec coverage**: §3構成→Task 1/2/8、§3ストレージ（D1/R2）→Task 2/7/8（KVは binding のみ作成。キャッシュ利用はサブプロジェクト2）、§4移行1〜5→Task 9（バックアップ・書き出し）/6/7/4/3/5、§5 URL互換→Task 10 の一覧生成と比較＋`/media`配信（Task 8）。301/410のルール実装はサブプロジェクト2に送る（比較結果で必要なものを確定するため）。§6リスク→Task 4（保護記事）/3・9（WP固有記法）/9（スナップショット）。§7テスト→全タスク。§8成功条件→Task 5・8 Step 6・9。
- **Placeholder scan**: 実装コードの欠落なし。`wrangler d1 execute --json` の出力形状とAstro 7のバインディング取得APIは、実行時に公式確認する手順として明記。
- **Type consistency**: `WpExport`/`WpPost` は Task 3 で定義し、Task 4・5・6・10 が同名で使用。`buildImportSql` の戻り値 `{statements, skipped, artifacts}`、`Counts`、`D1Like`、`PostRow` は定義どおり。
- **Review Focus**: 6項目すべてが Task 3/4/6 のテストに対応。
