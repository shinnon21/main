# CMS用 MCP コネクタ（Claudeからの記事更新）設計書

日付: 2026-10-15 / 対象: `cf-site/`（Cloudflare Worker `kb-site`）

## 1. 目的
claude.ai・Claude アプリ・Claude Code から「コラムを下書きで作って」「実績の文章を直して」「画像を載せて」とチャットで依頼し、サイトの記事を更新できるようにする。
**成功基準**: あなたが Claude にURLを1つ登録し、Accessログインで承認するだけで、記事・実績・お知らせ・固定ページの作成/編集ができる。公開操作は管理画面でのみ行える。

## 2. 非目標（意図的に含めない）
記事の削除、サイト設定・プロフィール・お問い合わせの閲覧/変更、公開/非公開の切替（管理画面のみ）、複数ユーザー。

## 3. 構成
- `wrangler.jsonc` の `main` を `./src/worker.ts` に変更。`src/worker.ts` は `@cloudflare/workers-oauth-provider` の `OAuthProvider` を default export とする。
  - `apiRoute: "/mcp"` → MCP サーバー（ステートレス、Streamable HTTP）。
  - `defaultHandler` → 既存の Astro（`@astrojs/cloudflare/handler` の `handle`）。既存の全ページ・管理画面・APIは従来どおり動く。
  - `authorizeEndpoint: "/admin/mcp/authorize"`（既存の `/admin*` Access保護の内側）、`tokenEndpoint: "/oauth/token"`、`clientRegistrationEndpoint: "/oauth/register"`（動的クライアント登録。Claude が自動で登録する）。
- 新規 KV namespace `OAUTH_KV`（トークン・クライアント登録の保存）。`global_fetch_strictly_public` 互換フラグ。
- ツール実装は `src/mcp/` に置き、既存の `src/admin/{store,validate,terms,media}.ts` を**そのまま呼ぶ**（検証・HTML無害化・改版・楽観的ロックを共通化）。

## 4. 認証・認可
1. Claude が `/mcp` に接続 → 401 と OAuth メタデータ（`/.well-known/*`）を受け取り、`/oauth/register` で自己登録、ブラウザで `/admin/mcp/authorize` を開く。
2. このパスは Access が保護（ワンタイムPIN）。Worker 側でも既存の `authorize()`（JWT検証）で本人確認し、`ADMIN_EMAILS` に一致するメールのみ。
3. 同意画面（クライアント名・権限 `cms` を表示）で「許可」を押す（POST、Origin検証・CSRF対策）。`completeAuthorization` で `props = { email }` を付与して発行。
4. 以降 `/mcp` は Bearer トークンで認証。トークンは短命（アクセス1時間）＋リフレッシュ。
5. 管理画面 `/admin/mcp/` に「接続中のClaude」一覧と**取り消しボタン**（`listUserGrants` / `revokeGrant`）。
- スコープは単一 `cms`。`/mcp` は `ADMIN_EMAILS` に含まれない props を拒否（二重確認）。

## 5. ツール
| ツール | 動作 |
|---|---|
| `list_posts(type?, status?, q?)` | 一覧（最大50件。IDとタイトル・状態・更新日時） |
| `get_post(id)` | 管理画面と同じ形の全項目（本文・英語版・メタ・分類・`modified_at`） |
| `create_post(type, title, …)` | **必ず `draft`** で作成（入力の `status` は無視）。`published_at` は null。 |
| `update_post(id, …, expected_modified_at)` | 渡した項目のみ更新（現状とマージ→既存の検証）。`status` は変更不可（公開済みは公開のまま）。競合時は409。改版を残す。 |
| `list_terms(taxonomy?)` / `create_term(taxonomy, name)` | 分類の一覧/追加 |
| `upload_media_from_url(url, alt?)` | 画像をメディアに登録（下記の制限）。返り値は `/media/...` |

- 型は `works|column|news|page`。入力は zod でスキーマ化し、サーバー側で `cleanPostInput` を必ず通す。
- 返り値は短い要約＋ID。本文は `get_post` でのみ全文返す。

## 6. 安全策
- **公開は管理画面のみ**（Claude は下書き作成と、既存記事の本文更新まで）。誤爆は改版（復元可）で戻せる。※公開済み記事の更新は即時に公開サイトへ反映される点を、ツール説明と最終レポートで明記する。
- **SSRF対策（upload_media_from_url）**: `https:` のみ、ホスト名がIPリテラル/localhost/内部名なら拒否、リダイレクトは最大3回で各回再検証、タイムアウト10秒、ダウンロード上限10MB（ストリームで打ち切り）、形式は既存の先頭バイト判定（JPEG/PNG/GIF/WebP のみ）。Worker の `global_fetch_strictly_public` により内部到達も遮断。
- **レート制限**: 1トークン/分60回、書き込み系は1時間200件（KV、検証通過後に計上）。
- **監査記録**: D1 `mcp_audit(id, at, email, client, tool, target, ok)`（migration 0005）。本文は保存しない。管理画面 `/admin/mcp/` に直近100件を表示。
- 既存の fail-closed（`ACCESS_*` 未設定で503）と同じ方針: 認可エンドポイントが未設定/不正なら `/mcp` は使えない。
- 本文はHTML無害化（`sanitizeHtml`）後に保存。ツール入力に含まれる指示文はデータとして扱い、サーバー側で権限昇格しない（公開・削除・設定変更の経路そのものが存在しない）。

## 7. テスト方針
- ツール関数はD1シム上の単体テスト（作成が必ずdraft／status変更不可／競合409／検証エラー／分類追加／監査記録）。
- 画像取得はfetchを差し替えたテスト（IPリテラル・内部名・リダイレクト先が内部・サイズ超過・不正形式・非https）。
- OAuthフロー・MCPプロトコルはローカルで `wrangler dev` に対し MCP Inspector（または自作クライアント）で往復確認、本番デプロイ後に Claude 側で実接続。
- 既存テスト（全件）を維持。完了後に独立セキュリティレビュー（opus）。

## 8. 運用手順（完成後・あなたの作業）
Claude の「設定 → コネクタ → カスタムコネクタを追加」に `https://shinnosuke-kobayashi.jp/mcp` を入力 → Access ログイン → 許可。Claude Code は `claude mcp add --transport http kobayashi-hp https://shinnosuke-kobayashi.jp/mcp`。

## 9. リスクと未確定事項
- `OAuthProvider` で全リクエストを包むため、Astro のミドルウェア（Access検証・noindex等）は `defaultHandler` 内でそのまま動く前提。`/.well-known/*` と `/oauth/*` は公開ルートになるので、既存の `classifyRequest` と干渉しないことをテストで確認する。
- 新規依存: `@cloudflare/workers-oauth-provider`、`agents`（`createMcpHandler`）、`@modelcontextprotocol/sdk`、`zod`。バージョンは実装時に固定する。
- 取り消し一覧が `listUserGrants` で取得できない場合は、接続一覧を省略し、トークンTTLの短縮と「全接続を無効化」操作のみにする。
