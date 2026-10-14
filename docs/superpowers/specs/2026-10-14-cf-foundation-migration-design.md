# Cloudflare完全移行 — サブプロジェクト1「基盤とデータ移行」設計書

日付: 2026-10-14 / ステータス: レビュー待ち

## 1. 背景と目的
shinnosuke-kobayashi.jp を GCP（VM `wp-portfolio`、WordPress）から Cloudflare ネイティブ構成へ完全移行し、GCP依存を無くす。
本書は全体の最初のサブプロジェクト「基盤とデータ移行」を扱う。

## 2. 全体方針（合意済み）
- 技術: Astro（SSR）＋ `@astrojs/cloudflare`（Workers）、D1（記事）、R2（画像）、KV（キャッシュ・レート制限）。
- コンテンツ更新: Cloudflare上の簡易CMS（同一アプリの `/admin`、Cloudflare Accessで保護）。
- 必須機能: お問い合わせフォーム、条件検索・PVランキング、日英2言語、SEO/AIO。
- 初回リリース対象外: AIチャット、Phase 2（登壇イベント、スキル辞典）。
- 制約: デザイントークン・ブランド素材は変更しない（CLAUDE.md準拠）。

### サブプロジェクト分割
1. 基盤とデータ移行（本書）
2. 公開サイト（既存テーマ再現・日英・SEO）
3. 簡易CMS（/admin）
4. フォーム・検索・ランキング
5. 切替（DNS、GCP VM停止）

## 3. 構成
- 新規 `cf-site/` をリポジトリ内に作成。`kobayashi-theme/` は移行完了まで参照用に残す。
- `wrangler.jsonc` に D1 / R2 / KV を定義。GitHub Actions から `wrangler deploy`。

### ストレージ
- D1:
  - `posts`: type(works/column/news/page), slug, status, 公開日・更新日, title/excerpt/content, title_en/excerpt_en/content_en, アイキャッチ
  - `post_meta`: ACF項目をWPキー名のままJSON保持（client_name, period_*, role, scope, kpi_results, gallery, media_youtube, *_en 等）
  - `terms` / `post_terms`: works_type, skill, industry, news_type
  - `settings`: プロフィール（日英）、SNSリンク、サイト名、キャッチフレーズ
  - `views`: PVカウント
- R2: WP uploads を同一パスで格納し `/media/*` で配信。テーマ同梱画像はアプリ静的アセット。
- KV: 公開ページキャッシュ、レート制限。

## 4. データ移行（一度きり・再実行可能）
1. 事前にVMスナップショットとDBダンプを取得（VM内データが唯一の原本）。R2にも退避。
2. VM上で `wp eval-file` により全記事・メタ・タクソノミー・メディア一覧をJSON出力。
3. uploads を R2 へ同期、JSON を D1 へ投入する取り込みスクリプト（`cf-site/scripts/`）。
4. 本文中の `/wp-content/uploads/...` を `/media/...` に書き換え。
5. 検証モード: 件数・紐付け・リンク切れを自動チェック。

## 5. URL互換
- 現行パスを維持: `/works/<slug>/`, `/column/<slug>/`, `/news/<slug>/`, `/works_type/…`, `/en/…`, `/sitemap.xml`, `/llms.txt`, `/robots.txt`, `/favicon.ico`。一覧はWP実データから書き出して照合。
- `/?s=` と `/searches/?…` は現行どおりnoindex。hreflangは実在する `/en/` ルートのみ。
- `/wp-content/uploads/…` → `/media/…` を301。`/wp-admin`, `/wp-login.php` 等は301/410。

## 6. リスクと対応
| リスク | 対応 |
|---|---|
| VM内データが唯一の原本 | 書き出し前にスナップショット＋DBダンプ、R2退避 |
| 旧管理者ログインURL | 切替後はCloudflare Accessに統一 |
| パスワード保護記事 | 公開記事のみ移行、保護記事は件数確認のうえ対象外 |
| 本文のWP固有記法（ショートコード, wp-block） | 取り込み時に検出・一覧化し、手修正か許可リスト変換 |
| 切替時のダウン | D1/R2を先に検証、DNS切替は最後。切替後もVMは停止のみで一定期間保持 |

## 7. テスト
- 取り込みスクリプトの検証モード（件数・紐付け・リンク切れ）。
- 旧/新サイトを同一URLリストで比較（ステータス、`<title>`、canonical）。以降のサブプロジェクトでも再利用。
- ローカルは `wrangler dev` ＋ D1ローカルで通し確認。

## 8. 成功条件
- 全CPT記事数・タクソノミー紐付け・画像数がWPと一致。
- D1から取り出した記事1件のJSONが元のWP版と内容的に同一。
- ローカル `wrangler dev` で最小の一覧・詳細ページがD1から描画できる。

## 9. スコープ外
- GCP VM・DNS・課金の変更（サブプロジェクト5まで触らない）。
- AIチャット実装。
