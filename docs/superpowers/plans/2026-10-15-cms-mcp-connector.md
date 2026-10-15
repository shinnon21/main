# CMS MCP コネクタ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans（インライン実行）。各タスクは TDD（テストを先に書き、失敗を確認してから実装）。ステップは `- [ ]` で追跡。

**Goal:** Claude から `https://shinnosuke-kobayashi.jp/mcp` 経由で記事・実績・お知らせ・固定ページを下書き作成/更新できるようにする（公開操作は管理画面のみ）。

**Architecture:** `src/worker.ts` で `OAuthProvider`（`@cloudflare/workers-oauth-provider`）をdefault exportにし、`/mcp` はMCPサーバー、それ以外は既存Astro（`handle`）へ。認可画面は Access 保護下の `/admin/mcp/authorize`。ツールは既存 `src/admin/*` を再利用。

**Tech Stack:** Astro 7 + @astrojs/cloudflare 14、vitest（`node:sqlite` D1 シム）、workers-oauth-provider、agents（`createMcpHandler`）、@modelcontextprotocol/sdk、zod。

**Spec:** `docs/superpowers/specs/2026-10-15-cms-mcp-connector-design.md`

## Global Constraints
- 作業ディレクトリ `cf-site/`。既存テスト（252件前後）を常に全件通過させる。`npm test` はD1シム。
- 公開操作・削除・設定変更の経路を作らない。`create_post` は常に `draft`、`update_post` は `status` を変更しない。
- HTMLは `cleanPostInput`（`sanitizeHtml`込み）を必ず通す。生SQLに入力を連結しない（bind）。
- 秘密（トークン・鍵）をログ/レスポンスに出さない。監査ログに本文を保存しない。
- ミドルウェア・Access・fail-closed の既存挙動を壊さない（`/en/admin` は404、`ACCESS_*`未設定は503）。
- コミットメッセージ末尾: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

## Review Focus（テストで押さえる）
1. `update_post` に `status: "publish"` を渡しても公開されない（無視）。
2. `update_post` の古い `expected_modified_at` は409相当エラー。
3. `upload_media_from_url`: IPリテラル/localhost/内部名/`http:`/リダイレクト先が内部/10MB超過/形式偽装を全拒否。
4. 認可画面がAccess未認証で表示されない・許可リスト外メールは拒否。
5. `/mcp` が Bearer なしで 401、トークンの `props.email` が許可リスト外なら 403。

## File Structure
- Create: `src/mcp/tools.ts`（純粋なツール実装）、`src/mcp/fetch-image.ts`（SSRF対策付き画像取得）、`src/mcp/audit.ts`（監査・レート制限）、`src/mcp/server.ts`（MCPサーバー定義・zod）、`src/worker.ts`（OAuthProvider入口）、`src/mcp/oauth.ts`（defaultHandler振り分け・認可処理）、`src/pages/admin/mcp/index.astro`・`authorize.astro`（管理UI）、`migrations/0005_mcp_audit.sql`
- Modify: `wrangler.jsonc`（main・OAUTH_KV・互換フラグ）、`src/admin/AdminLayout.astro`（ナビ）、`src/lib/env.ts`（型）、`src/admin/api.ts`（メディア保存ロジックを `saveMedia` として共通化）、`src/admin/media.ts`、`CLAUDE.md`
- Test: `test/mcp-tools.test.ts`、`test/mcp-fetch-image.test.ts`、`test/mcp-audit.test.ts`、`test/mcp-server.test.ts`

---

### Task 1: 依存・マイグレーション・メディア保存の共通化

**Files:** `package.json`, `migrations/0005_mcp_audit.sql`, `src/admin/media.ts`, `src/admin/api.ts`, `test/api.test.ts`（既存に回帰）

**Interfaces:** Produces `saveMedia(ctx: { db: D1Like; media: R2Like; email: string; nowUtc: string; rand?: () => string }, bytes: Uint8Array, claimedType: string, name: string): Promise<{ id: number; key: string; url: string; alt: string; content_type: string; size: number }>`（`src/admin/media.ts`。`R2Like` も同ファイルへ移す）。

- [ ] **Step 1: 依存追加** — `npm i @cloudflare/workers-oauth-provider agents @modelcontextprotocol/sdk zod`。`package.json` のバージョンを実際に入った値に固定（`^`外し）。`npm test` が全件通ることを確認。
- [ ] **Step 2: マイグレーション** — `migrations/0005_mcp_audit.sql`:
  ```sql
  CREATE TABLE mcp_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL, email TEXT NOT NULL, client TEXT NOT NULL DEFAULT '',
    tool TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', ok INTEGER NOT NULL
  );
  CREATE INDEX idx_mcp_audit_at ON mcp_audit(at DESC, id DESC);
  ```
  `test/helpers/db.ts` は `migrations/*.sql` を全適用するので自動で効く。
- [ ] **Step 3: 回帰テスト先行** — 既存の `test/api.test.ts` のメディアアップロード系テストが変更後も通ることを基準にする（新規テスト不要）。
- [ ] **Step 4: 実装** — `api.ts` の `POST /media` 内の「キー確保→R2書き込み→ロールバック」ブロックを `saveMedia` に移し、`api.ts` はそれを呼ぶだけにする（挙動不変：衝突時リトライ3回、R2失敗でD1行を削除、`validateUpload` 呼び出し）。
- [ ] **Step 5: 実行** — `npm test`（全件通過）。
- [ ] **Step 6: Commit** — `refactor(cf-site): extract saveMedia; add mcp_audit migration and MCP deps`

### Task 2: ツール中核（記事・分類）

**Files:** Create `src/mcp/tools.ts`, `test/mcp-tools.test.ts`

**Interfaces:**
Consumes: `getAdminPost`, `listAdminPosts`, `createPost`, `updatePost`（store.ts）、`cleanPostInput`, `utcToJstLocal`（validate.ts）、`createTerm`, `listTerms`（terms.ts）。
Produces（すべて `ToolCtx = { db: D1Like; email: string; nowUtc: string }` を第1引数）:
- `listPostsTool(ctx, { type?, status?, q? })` → `{ posts: AdminRow[] }`（最大50件）
- `getPostTool(ctx, { id })` → 全項目（`published_at` はJST入力形式）
- `createPostTool(ctx, input)` → `{ id }`（常にdraft）
- `updatePostTool(ctx, { id, expected_modified_at, ...patch })` → `{ modified_at }`
- `listTermsTool(ctx, { taxonomy? })`、`createTermTool(ctx, { taxonomy, name })`
- エラーは既存の `HttpError`（status付き）を投げる。

- [ ] **Step 1: 失敗するテスト** — `test/mcp-tools.test.ts`（D1シム＋fixture import、`api-terms.test.ts` のsetupに倣う）:
  ```ts
  test("create is always a draft, even if status:'publish' is passed; published_at stays null", async () => {
    const s = setup();
    const { id } = await createPostTool(s.ctx, { type: "column", title: "下書き", content: "<p>x</p>", status: "publish" } as any);
    const row = s.raw.prepare("select status from posts where id=?").get(id) as any;
    expect(row.status).toBe("draft");
  });
  test("update merges only the given fields, keeps status/slug, writes a revision, ignores status in input", async () => { /* 公開済みをfixtureから取得→titleだけ更新→statusはpublishのまま・revisions+1・他項目不変 */ });
  test("update with a stale expected_modified_at throws 409", async () => { /* … */ });
  test("update rejects invalid input via cleanPostInput (e.g. site_url javascript:) with 400 and sanitizes content", async () => { /* … */ });
  test("update_post cannot change type", async () => { /* … */ });
  test("list is capped at 50 and filters by type/status/q", async () => { /* … */ });
  test("create_term/list_terms use the existing validation", async () => { /* … */ });
  ```
  （各 `/* … */` は実装時に具体的な期待値で埋める。fixture `test/fixtures/export.ts` の公開済み works `site-a`（wp_id 10）を使う。）
- [ ] **Step 2: 失敗確認** — `npx vitest run test/mcp-tools.test.ts` → モジュール不在で FAIL。
- [ ] **Step 3: 実装** — `createPostTool`: 入力から `type,title,title_en,slug,excerpt,excerpt_en,content,content_en,thumbnail,meta,terms` のみ取り、`status:"draft"`, `published_at:null` を付けて `cleanPostInput` → `createPost`。`updatePostTool`: `cur = await getAdminPost`（無ければ404）→ `type` 変更は400 → `merged = { ...cur, published_at: cur.published_at ? utcToJstLocal(cur.published_at) : null, ...allowedPatch, meta: { ...cur.meta, ...patch.meta }, status: cur.status, expected_modified_at }`（`allowedPatch` は title,title_en,slug,excerpt,excerpt_en,content,content_en,thumbnail,terms のみ）→ `cleanPostInput(merged)` → `updatePost`。`expected_modified_at` は必須（欠落は400）。
- [ ] **Step 4: 成功確認** — 当該テスト通過＋`npm test` 全件。
- [ ] **Step 5: Commit** — `feat(cf-site): MCP post/term tool core (draft-only create, status-preserving update)`

### Task 3: 画像取得（SSRF対策）

**Files:** Create `src/mcp/fetch-image.ts`, `test/mcp-fetch-image.test.ts`

**Interfaces:** Consumes `saveMedia`（Task 1）。Produces `uploadMediaFromUrl(ctx: ToolCtx & { media: R2Like; fetcher?: typeof fetch }, { url: string; alt?: string }): Promise<{ id; key; url; alt }>`、`assertPublicHttpsUrl(u: string): URL`。

- [ ] **Step 1: 失敗するテスト** — `assertPublicHttpsUrl` が拒否: `http://…`、`https://127.0.0.1/`、`https://[::1]/`、`https://10.0.0.1/`、`https://192.168.1.1/`、`https://169.254.169.254/`、`https://localhost/`、`https://foo.internal/`、`https://foo.local/`、`https://user:pass@example.com/`、ポート指定、`https://2130706433/`（10進IP）、`https://0x7f.1/`。許可: `https://example.com/a.png`。`uploadMediaFromUrl`（fetcher差し替え）: 301→`http://169.254…` を拒否／リダイレクト4回目で拒否／`Content-Length` 11MBで拒否／ストリームが10MB超過で打ち切り／本文がHTMLで `Content-Type: image/png` を偽装→`validateUpload` で拒否／正常PNGで `media` 行とR2書き込み・`uploaded_by=email`。
- [ ] **Step 2: 失敗確認**
- [ ] **Step 3: 実装** — 手動リダイレクト（`redirect: "manual"`、最大3回、各回 `assertPublicHttpsUrl`）、`AbortSignal.timeout(10_000)`、`Content-Length` 事前確認＋`reader` で累積バイトを数え `MAX_BYTES` 超過で `cancel()`、`saveMedia(…, name = URLのファイル名部分)`。ホスト判定: IPv4リテラル（10進/16進/8進表記含む：`/^[0-9.x]+$/i` は数字・ドット・x のみのホストは全拒否）、IPv6リテラル（`[`含む）全拒否、`localhost`・`*.local`・`*.internal`・`*.localhost`・単一ラベルホスト全拒否。
- [ ] **Step 4: 成功確認＋全件**
- [ ] **Step 5: Commit** — `feat(cf-site): SSRF-safe image fetch for MCP media upload`

### Task 4: 監査記録とレート制限

**Files:** Create `src/mcp/audit.ts`, `test/mcp-audit.test.ts`

**Interfaces:** Produces `recordAudit(db, { at, email, client, tool, target, ok })`、`recentAudit(db, n=100)`、`checkRate(kv: KVLike, key: string, limit: number, windowSec: number): Promise<boolean>`（既存 `src/lib/ratelimit.ts` を確認し、同じ流儀（KV・検証通過後計上）で実装するか、そこの関数を再利用する）。

- [ ] **Step 1: テスト先行** — 監査行が保存され本文を含まない、`recentAudit` が新しい順100件、`checkRate` が上限超過で false（読み書きは非アトミックである旨をコメント）。
- [ ] **Step 2: 失敗確認 → Step 3: 実装 → Step 4: 成功確認**
- [ ] **Step 5: Commit** — `feat(cf-site): MCP audit log and rate limit`

### Task 5: MCPサーバー定義

**Files:** Create `src/mcp/server.ts`, `test/mcp-server.test.ts`

**Interfaces:** Consumes Task 2–4。Produces `buildMcpServer(deps: { db; media; kv; email: string; client: string; now: () => string }): McpServer`（`@modelcontextprotocol/sdk`）と、各ツールを `{name, description, inputSchema(zod), handler}` として列挙した `TOOL_DEFS`（テストがプロトコル無しで呼べるようにする）。

- [ ] **Step 0: 実APIの確認** — インストール済みの `agents`・`@modelcontextprotocol/sdk` の型定義（`node_modules/**/*.d.ts`）を読み、`createMcpHandler` の引数・`McpServer.registerTool` のシグネチャ・ステートレス動作を確認して、このタスクのコードを実際の型に合わせる（計画のコードは概念であり、型と食い違えば型を正とする。判断は台帳に `Ruling:` で記録）。
- [ ] **Step 1: テスト先行** — `TOOL_DEFS` の名前が仕様の7つ（`list_posts,get_post,create_post,update_post,list_terms,create_term,upload_media_from_url`）のみ・公開/削除系が存在しない／各ハンドラが成功・失敗（HttpError→`isError` 結果）で監査行を残す／書き込み系がレート制限超過で拒否／zodが不正入力（type不正・content超過）を拒否。
- [ ] **Step 2〜4:** 失敗確認→実装→成功確認。ツール説明文に「公開済み記事の更新は即時に公開サイトへ反映されます」を明記。
- [ ] **Step 5: Commit** — `feat(cf-site): MCP server tool definitions`

### Task 6: Worker入口・OAuth・認可画面

**Files:** Create `src/worker.ts`, `src/mcp/oauth.ts`, `src/pages/admin/mcp/authorize.astro`; Modify `wrangler.jsonc`, `src/lib/env.ts`; Test: `test/mcp-oauth.test.ts`

- [ ] **Step 0: 実APIの確認** — `@cloudflare/workers-oauth-provider` の README／型（`node_modules/@cloudflare/workers-oauth-provider`）で `OAuthProvider` のオプション名（`apiRoute`/`apiHandler(s)`、`defaultHandler`、`authorizeEndpoint`、`tokenEndpoint`、`clientRegistrationEndpoint`、`scopesSupported` 等）、`env.OAUTH_PROVIDER` のヘルパー（`parseAuthRequest`、`lookupClient`、`completeAuthorization`、`listUserGrants`、`revokeGrant`）、`ctx.props` の受け渡しを確認する。
- [ ] **Step 1: wrangler設定** — `main: "./src/worker.ts"`、`kv_namespaces` に `OAUTH_KV`（本番IDは Task 8 で作成。ローカルは `wrangler dev` が自動で扱う）、`compatibility_flags: ["global_fetch_strictly_public"]`（既存フラグと併記）。
- [ ] **Step 2: テスト先行（純粋部分）** — `oauth.ts` の `isAllowedAdmin(email, env.ADMIN_EMAILS)`（空の許可リストは拒否＝MCPでは**許可リスト必須**）、`/mcp` ハンドラが `ctx.props.email` が許可リスト外なら403、認可POSTが Origin 不一致で403・JSON/フォーム以外拒否。
- [ ] **Step 3: 実装** — `src/worker.ts`: `export default new OAuthProvider({ apiRoute: "/mcp", apiHandler: mcpFetch, defaultHandler: { fetch: (req, env, ctx) => handle(req, env, ctx) }, authorizeEndpoint: "/admin/mcp/authorize", tokenEndpoint: "/oauth/token", clientRegistrationEndpoint: "/oauth/register", scopesSupported: ["cms"], … })`。`mcpFetch` は `ctx.props.email` を検証し `createMcpHandler(buildMcpServer(…))` を呼ぶ。`authorize.astro`: ミドルウェアの `locals.adminEmail`（Access検証済み）を使い、GETで同意画面（クライアント名・`cms` 権限・許可/拒否）、POSTで `completeAuthorization({ request: oauthReqInfo, userId: email, metadata: {}, scope: ["cms"], props: { email } })` → リダイレクト。POSTは Origin 完全一致を要求。
- [ ] **Step 4: ビルド確認** — `npm run build`、`npm test` 全件。ミドルウェアの既存挙動（`/en/admin` 404、`/admin` fail-closed）が `defaultHandler` 経由でも変わらないことをローカルで確認。
- [ ] **Step 5: ローカルE2E** — `.dev.vars`（`DEV_ADMIN_EMAIL`、`ADMIN_EMAILS=dev`）で `wrangler dev`。MCPクライアント（`@modelcontextprotocol/sdk` の `Client`＋`StreamableHTTPClientTransport`＋OAuth、または `npx @modelcontextprotocol/inspector`）で、登録→認可→`list_posts`→`create_post`（draft確認）→`update_post`→不正トークン401 を確認。結果を台帳へ。
- [ ] **Step 6: Commit** — `feat(cf-site): OAuth-protected /mcp endpoint with Access-gated consent`

### Task 7: 管理画面（接続の取り消し・監査表示）

**Files:** Create `src/pages/admin/mcp/index.astro`; Modify `src/admin/AdminLayout.astro`（ナビ「Claude連携」）

- [ ] **Step 1:** `listUserGrants(email)` で接続中クライアント一覧、`revokeGrant` の取り消しボタン（POST、Origin検証、`/admin/api` ではなくページ内フォームPOSTでも可だが既存のCSRF規約＝Origin一致＋JSONに合わせる）、`recentAudit` 直近100件を表示。`listUserGrants` が使えない場合は仕様 §9 のフォールバック。
- [ ] **Step 2:** `npm run build`＋ローカル表示確認、`npm test` 全件。
- [ ] **Step 3: Commit** — `feat(cf-site): admin page for Claude connections and MCP audit`

### Task 8: 本番反映・実接続・レビュー

- [ ] **Step 1:** `npx wrangler kv namespace create OAUTH_KV` → ID を `wrangler.jsonc` に反映。`npx wrangler d1 migrations apply DB --remote`（0005）。
- [ ] **Step 2:** `git push origin main`（CIが `npm test`→デプロイ）。デプロイ後30秒待って確認: `/` 200、`/admin/` 302(Access)、`/en/admin/` 404、`/mcp` が Bearer なしで 401、`/.well-known/oauth-authorization-server` 200、`/oauth/token` が空POSTで400系（500でない）、`node scripts/check-seo.ts https://shinnosuke-kobayashi.jp` 不良0。
- [ ] **Step 3:** ユーザーが Claude に `https://shinnosuke-kobayashi.jp/mcp` を登録し承認 → 一緒に「下書き作成→管理画面で確認」を実施。
- [ ] **Step 4:** 独立セキュリティレビュー（`opus` サブエージェント、diff範囲を明示）。Critical/Important は TDD で修正し再デプロイ。Minor は CLAUDE.md に記録。
- [ ] **Step 5:** `CLAUDE.md` に MCP コネクタ（URL・権限・安全策・接続取り消し・`/admin/mcp/`・既知の先送り）を追記し main に push。
