# Cloudflare移行 サブプロジェクト3a「CMSの土台と記事編集」設計書

日付: 2026-10-15 / ステータス: レビュー待ち
親設計: `2026-10-14-cf-foundation-migration-design.md`（全体はサブプロジェクト1〜5。3は 3a〜3c に分割）

## 1. ゴール
WordPress管理画面なしで、実績・コラム・お知らせ・固定ページを、Cloudflare上の `/admin` から作成・編集・公開/下書き・削除（ゴミ箱）できる。日英の両方を編集でき、変更は即座に公開サイトへ反映される（公開サイトは常にD1を読む）。

## 2. 確定済みの決定
- 認証: Cloudflare Access（前段）＋Workerでの Access JWT 検証（多重防御）。
- 本文編集: リッチテキスト（WYSIWYG）。既存本文（HTML）をそのまま読み書きできる。
- 分割: 3a=土台と記事編集 / 3b=画像（R2アップロード・選択・本文挿入）/ 3c=分類・サイト設定・プロフィール全項目・取り込みガード・バックアップ書き出し。

## 3. 範囲
- 含む: 認証、管理画面の骨組み、記事CRUD（works/column/news/page）、日英フィールド、実績の概要欄（ACFメタ）、ニュースの埋め込み欄、既存のタグ・種別の割り当て、SEO個別設定（ssp_meta_*）、公開日、下書き/公開/ゴミ箱、改版履歴と復元、HTML無害化、CSRF対策。
- 含まない: 画像アップロード・画像選択（3b。3aではアイキャッチは R2キー文字列の入力のみ）、分類の追加/編集・サイト設定・プロフィール項目編集（3c）、本文中の画像挿入UI（3b。3aは画像URLの貼付のみ）。

## 4. 設計
### 4.1 ルーティング
- UI: `/admin/`（ダッシュボード）、`/admin/<type>/`（一覧: type ∈ works|column|news|page、状態フィルタ・検索）、`/admin/<type>/new/`、`/admin/<type>/<id>/`（編集）。
- API: `GET /admin/api/posts?type=&status=&q=`、`POST /admin/api/posts`、`GET|PUT|DELETE /admin/api/posts/<id>`、`GET /admin/api/terms`、`GET /admin/api/posts/<id>/revisions`、`POST /admin/api/posts/<id>/restore/<revisionId>`。
- 静的ルート `admin/` が公開側の動的ルート（`[type]`）より優先される。`/admin` は固定ページスラッグから予約（RESERVED）に追加。`/admin*` は `X-Robots-Tag: noindex` 、robots.txtでDisallow（実装済み）。`/en/admin` は存在しない（404）。

### 4.2 認証
- `lib/access.ts`: `verifyAccessJwt(token, { teamDomain, aud, jwks })`（RS256、`iss=https://<team>.cloudflareaccess.com`、`aud`、`exp/nbf`、`kid`でJWKS選択。JWKSは `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` を取得してisolate内キャッシュ）。成功で `{ email }`。
- 環境変数（`wrangler.jsonc` の vars）: `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`、`ADMIN_EMAILS`（カンマ区切り。設定時はJWTのemailが含まれること）。
- ミドルウェア: `/admin` 配下は `Cf-Access-Jwt-Assertion` ヘッダーを検証。失敗は401、設定未完了（環境変数が空）は503（fail closed）。**ローカル開発のみ** ホストが `localhost`/`127.0.0.1` かつ `DEV_ADMIN_EMAIL` が設定されている場合に検証をバイパス（本番ホストでは無効）。
- 変更系API（POST/PUT/DELETE）: `Content-Type: application/json` 必須、`Origin` がリクエストホストと一致すること。

### 4.3 データ
- 既存の `posts` / `post_meta` / `post_terms` / `terms` を使う（スキーマ変更は `revisions` の追加のみ。マイグレーション `0002_revisions.sql`）。
- `revisions(id INTEGER PK, post_id INTEGER, saved_at TEXT, saved_by TEXT, snapshot TEXT)`。更新・削除・復元の直前に、記事行・メタ・タームのJSONスナップショットを保存。記事ごと最新50件を保持（超過分は削除）。
- 新規記事の `wp_id` は NOT NULL UNIQUE のため `MAX(wp_id)+1`（最小1000）を採番。
- 状態: `draft`（非公開）/`publish`/`trash`（ゴミ箱。復元可）。公開側クエリは `status='publish'` のみなので下書き・ゴミ箱は自動で非公開。`published_at` は公開時に未設定なら現在時刻。時刻はJST入力⇄UTC保存。
- スラッグ: 空なら `post-<base36時刻>`。許可文字は空白・`/ ? # %` を除く（日本語可）、最大200字。`type`内で一意（重複は400）。
- 保存は `db.batch([...])`（D1の原子的バッチ）。`D1Like` に `batch` を追加。
- 編集項目:
  - 共通: title/title_en、slug、status、published_at、excerpt/excerpt_en、content/content_en（HTML）、thumbnail（R2キー文字列）、SEO（ssp_meta_title/description/image）。
  - works: client_name/_en、period_start/end、role/_en、scope[]、tech_stack/_en、site_url、is_featured、kpi_results/_en（label/value行）、works_type（単一）・industry・skill（複数）。
  - column: skill。news: news_type（単一）、media_youtube/media_spotify。page: タイトル・本文のみ。
  - タームは既存のものから選ぶ（追加は3c）。

### 4.4 エディタとHTML無害化
- エディタ: Tiptap（StarterKit＋Link＋Image）をビルドに同梱するクライアント島。JA/ENタブで2本。出力HTMLを隠しフィールドに保持し、保存時にJSONで送る。
- サーバー側無害化: 純JSの許可リスト方式（`xss` パッケージ）。許可タグ: `h1-h6 p br hr ul ol li blockquote pre code strong em u s a img figure figcaption table thead tbody tr th td iframe(YouTube/Spotify埋め込みのみ)`、許可属性は `href src alt title class width height target rel`。`href/src` は `http(s)`・相対・`mailto` のみ（`javascript:` 等は除去）。`target=_blank` には `rel="noopener"` を強制。`script/style/on*` は除去。

### 4.5 管理画面UI
- 公開サイトとは別の最小CSS（`admin.css`）。一覧（状態・種別バッジ・更新日・公開サイトへのリンク）、編集フォーム（タブ: 日本語 / English / 概要 / SEO）、保存/公開/下書きに戻す/ゴミ箱へ、改版履歴（日時・保存者・復元）。保存結果とエラーはフォーム上に表示。モバイル幅でも操作可能。

## 5. 検証
- vitest: JWT検証（テスト内で生成したRSA鍵と偽JWKSで 正常/期限切れ/aud不一致/iss不一致/kid不明/署名改ざん）、無害化（XSS文字列ペイロード集）、スラッグ・入力検証、保存バッチ（作成/更新/ゴミ箱/復元/改版の上限/新規wp_id採番/スラッグ重複）、APIハンドラ（`node:sqlite` シムでD1代替、認可なし401・CSRF拒否）。
- ローカル: `wrangler dev`（`DEV_ADMIN_EMAIL` バイパス）で、記事の作成→公開→公開サイトに反映→編集→履歴→復元→ゴミ箱を通し確認。管理画面のスクリーンショット確認。
- 確認用サイトには管理画面をデプロイしない（Access設定後=サブプロジェクト5前後）。公開サイトの挙動は変えない。

## 6. リスクと対応
| リスク | 対応 |
|---|---|
| Access未設定で `/admin` が公開される | 環境変数が空なら503（fail closed）。本番/確認用ホストではバイパス無効。確認用サイトにはAccess設定までデプロイしない |
| 保存HTMLにXSS | 許可リスト無害化＋公開側でも同じ関数を通す（二重）。テストにペイロード集 |
| 誤編集・誤削除 | 改版履歴50件、ゴミ箱、D1 Time Travel（30日） |
| 並行編集で上書き | 保存時に読み込み時の `modified_at` を送り、不一致なら409で通知（楽観的ロック） |
| 取り込みスクリプトが編集を消す | 3cでガード。3aでは `CLAUDE.md` に再実行禁止を明記済み |

## 7. 成功条件
- ローカルで 作成→公開→公開サイト反映→編集→履歴復元→ゴミ箱 が通る（日英）。
- 無害化・JWT・CSRF・スラッグ・楽観的ロックのテストが通る。
- 公開サイトの既存テスト・表示は不変。
