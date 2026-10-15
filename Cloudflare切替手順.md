# Cloudflare 本番切替手順（サブプロジェクト5）

公開サイト（GCP の WordPress）を、Cloudflare 上の新サイト（Worker `kb-site`）へ切り替える手順。
**カスタムドメインを割り当てた瞬間に公開サイトが切り替わる。実施は必ず本書の事前チェックが全て済んでから。**

## 0. 前提（2026-10-15時点で完了）
- Access（`/admin*` を hello@shinnosuke-kobayashi.jp に限定）・Turnstile・メール送信（通知・自動返信を実送信確認）・GA4/AdSense（本番ドメインのみ出力）・www→apex 301・GitHub Secrets 設定済み。
- DNS はもともと Cloudflare 上（同一アカウント）。ネームサーバー変更は不要。Google Workspace の MX/SPF（アドレス直下）は触らない。DMARC は `p=none` のまま。

## 1. 事前チェック（切替当日）
1. 本番WPの編集を止める（切替完了まで記事・設定を更新しない）。
2. 最新内容の再取込（確認用サイトを最新にする）。確認用サイトでCMSを使っていると `cms_initialized` が付いて拒否されるため `--force` が必要（確認用データは上書きされる。PVはWPの値で再投入）。
   - `cf-site/scripts/` の `wp-export.php` → `import.ts --force` → `wrangler d1 execute DB --remote --file …` → `sync-media.ts` → `seed-profile-en.ts --force`（`backfill-media.ts` も再適用）
3. `cd cf-site && npm test`（全件通過）・`npm run build`・`npx wrangler deploy`。
4. `node scripts/check-seo.ts https://kb-site.curly-wave-c49f.workers.dev`（bad=0, canonicalMismatch=0）と `scripts/compare-urls.ts`（旧URLが全て 200 / 301）。
5. 確認用URLで `/contact/` の実送信（通知・自動返信・完了画面）。
6. VMスナップショットを新規取得（切替直前の状態を保存）。

## 2. 切替（所要 数分）
1. Cloudflare ダッシュボード → DNS → レコード で、`shinnosuke-kobayashi.jp`（apex）と `www` の **A/AAAA/CNAME（GCP向き）を控えてから削除**する（MX/TXT は削除しない）。控え: apex A = GCP静的IP `35.189.147.122`（プロキシ有効）。
2. Workers & Pages → `kb-site` → 設定 → ドメインとルート → 追加 → **カスタムドメイン**: `shinnosuke-kobayashi.jp` と `www.shinnosuke-kobayashi.jp`。
3. 反映後、`cf-site/wrangler.jsonc` に `"routes": [{ "pattern": "shinnosuke-kobayashi.jp", "custom_domain": true }, { "pattern": "www.shinnosuke-kobayashi.jp", "custom_domain": true }]` を追記してコミット（構成をコードに残す）。

## 3. 切替直後の確認
- `curl -sI https://shinnosuke-kobayashi.jp/`（`server: cloudflare`、WPの `link: wp-json` が無い）。トップ・実績・コラム・お知らせ・`/en/`・`/contact/` の表示。
- `https://www.shinnosuke-kobayashi.jp/` が 301 → apex。
- `https://shinnosuke-kobayashi.jp/admin/` が Access ログインを経由して管理画面に入れる。
- `node scripts/check-seo.ts https://shinnosuke-kobayashi.jp`、`/robots.txt` が `Disallow: /` でない（本番ドメイン）、`X-Robots-Tag: noindex` が付いていない。
- `<head>` に GA4（`G-605F8JC1XR`）と AdSense が出ている。GA4 リアルタイムに自分のアクセスが出る。
- `/contact/` を本番ドメインから実送信（Turnstile のホスト名に本番ドメインが入っていること）。
- Google Workspace のメール送受信が普段どおり（MX/SPF は無変更）。

## 4. ロールバック（問題があれば数分で戻せる）
1. Workers → `kb-site` → ドメインとルート で、両カスタムドメインを削除（`wrangler.jsonc` に追記済みなら `routes` も外して再デプロイ）。
2. DNS に控えておいた A/CNAME（apex = `35.189.147.122` プロキシ有効、www は元の向き先）を復元。
3. WPの VM は切替後も**停止せず**稼働させておく（下記「5」の保持期間中）。切替〜安定確認の間に編集した内容は新サイト側にしか無いので、戻す場合は手作業で移す。

## 5. 切替後
- Search Console: `https://shinnosuke-kobayashi.jp/sitemap.xml` を再送信、トップの再インデックス申請。
- 2週間ほど様子を見て（クロール・問い合わせ・Analytics 正常）から、GCP VM `wp-portfolio` を**停止**（削除はさらに後。スナップショット `pre-cf-migration-20261014` と切替直前分は保持）。GCP 課金の確認。
- `.github/workflows/deploy.yml`（WPテーマ自動デプロイ）を無効化。`cf-deploy.yml` が main push で本番を更新する。`cf-migration` を main にマージして以後は main から運用。
- CLAUDE.md を「公開中=Cloudflare」に更新（ホスティング・ファイルマップ・運用手順）。
- 既知の差分: 現行 WP の `/feed/`（RSS）は新サイトに無い（404）。必要なら別途実装。

## 6. 緊急時の連絡先メモ
- Cloudflare アカウント: hello@shinnosuke-kobayashi.jp（Account ID `5ab6d2a72a9bd3690514afbdbd661d07`）
- 管理画面: `https://shinnosuke-kobayashi.jp/admin/`（Access のワンタイムPIN）
