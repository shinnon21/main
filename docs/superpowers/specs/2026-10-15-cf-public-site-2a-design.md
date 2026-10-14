# Cloudflare移行 サブプロジェクト2a「見た目の土台と主要ページ」設計書

日付: 2026-10-15 / ステータス: レビュー待ち
親設計: `2026-10-14-cf-foundation-migration-design.md`（全体はサブプロジェクト1〜5。2は 2a〜2d に分割）

## 1. ゴール
確認用サイト（workers.dev）で、日本語のトップ、実績/コラム/お知らせの一覧・詳細、タクソノミー一覧、404 が現行サイトと同じ見た目で表示される。

## 2. 範囲
- 含む: Layout（ヘッダー/フッター）、トップ、実績・コラム・お知らせの一覧（ページネーション）と詳細、works_type / skill / industry / news_type のタクソノミー一覧、404、人気ランキングの表示（読み取りのみ）、URL正規化（末尾スラッシュ・旧uploads URL）。
- 含まない: 固定ページ（2b）、英語版（2c）、SEO/AIO（2d）、条件検索・お問い合わせ・/chat/・閲覧数カウントの書き込み（4）、CMS（3）。
- 再現度: 完全移植（デザイントークン・ブランド素材・CSS値は変更禁止）。

## 3. 構成
- 移植: `kobayashi-theme/style.css`→`cf-site/src/styles/`、`assets/main.js`と`assets/img/*`→`cf-site/public/`。
- PHPテンプレート→Astroコンポーネント（1対1）:
  - `header.php`/`footer.php`→`Layout.astro`
  - `parts/card-works|card-column|page-hero|side-ranking`→同名コンポーネント
  - `front-page.php`→`index.astro`
  - `archive-*`/`single-*`/`taxonomy-*`→`[type]/…`、`works_type|skill|industry|news_type/[slug]`
  - `404.php`→`404.astro`
- 関数の移植（TypeScript, `src/lib/`）: `kb_dates`, `kb_thumb`, `kb_type_badge`, `kb_news_type_badge`, `kb_skill_chips`, `kb_works_period`, `kb_pagination`, `kb_get_excerpt`, `kb_breadcrumbs` 相当。日時はUTC→JST変換。各関数にvitestを付ける。
- 英語版準備: 文言は `t(lang, ja, en)` 形式で書き、2aでは `lang="ja"` のみ渡す（2cでの作り直しを避ける）。

## 4. データとルーティング
- 取得: 主な実績=`is_featured`メタ該当（無ければ新着）4件、新着コラム4件、お知らせ3件、ティッカー用skill上位14件（件数順）。一覧は `/works/page/2/` 形式のページネーション。
- 人気ランキング: `views`テーブルの上位5件（読み取りのみ。カウント更新は4）。
- ミドルウェア: `/wp-content/uploads/*`→`/media/*` を301。末尾スラッシュ無しのパス（拡張子付きファイルを除く）をスラッシュ付きへ301。
- リンク: 日本語スラッグは `href` ではパーセントエンコードして出力。

## 5. 検証
- ヘッドレスブラウザで現行サイトと新サイトのスクリーンショットを比較（トップ、実績/コラム/お知らせの一覧と詳細。デスクトップとスマホ）。
- `compare-urls.ts` で2a対象URLの404が無くなることを確認。英語版・固定ページ・`<title>`/canonical の差分は2b〜2dで解消。
- 純粋関数はvitest、ページは `astro build` + `astro preview` でcurl確認。

## 6. リスクと対応
| リスク | 対応 |
|---|---|
| 本文HTML（wp-block由来のクラス）のスタイルが崩れる | 実データの全記事をスクリーンショット比較で確認し、差分はCSSの移植漏れとして修正 |
| ヒーロー格子・ティッカーJSがWP固有マークアップに依存 | main.jsを移植後、要素ID（#heroNet, #tickerLane 等）が一致することをテストで確認 |
| web font の読み込み方法がWPの enqueue に依存 | 移植時に `functions.php` の enqueue を確認し、`<head>` に同等のlinkを出力 |
| 閲覧数の更新が無いためランキングが固定 | 2aでは読み取りのみと明記。4で書き込みを実装 |

## 7. 成功条件
- 上記ページがデスクトップ・スマホで現行とスクリーンショット上ほぼ同一（差異は既知の未実装部分に限る）。
- 旧uploads URLと末尾スラッシュ無しURLが正しく301される。
- 全テストが通り、確認用サイトにデプロイされる。
