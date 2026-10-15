# Cloudflare移行 サブプロジェクト2c「英語版」設計書

日付: 2026-10-15 / ステータス: レビュー待ち
親設計: `2026-10-14-cf-foundation-migration-design.md`、`2026-10-15-cf-public-site-2a-design.md`（2bは2aの方針の延長で実装済み）

## 1. ゴール
確認用サイトで、2a/2bで公開した全ページ（トップ、実績/コラム/お知らせの一覧・詳細・タクソノミー、プロフィール/About/プライバシー等）の英語版を `/en/…` で提供し、日本語版を壊さない。

## 2. 現行テーマの仕様（移植元 `kobayashi-theme/inc/i18n.php`）
- `/en/` プレフィックスで日本語と同じ構成のURLを提供。
- UI文言は `kb_t()`。記事は `title_en`/`excerpt_en`/`content_en`、実績概要は `client_name_en` 等。空なら日本語へフォールバック。
- `<html lang>`、`<title>` の英語化、hreflang（ja/en/x-default）、言語切替リンク。英語版が存在しないページ（404・検索等）には `/en/` リンク/hreflangを出さない。

## 3. 範囲
- 含む: 上記全ページの英語版、言語切替、hreflang、英語タイトル、プロフィール英語データの投入。
- 含まない: 英語版 contact/chat/searches（4）、OGP/JSON-LD/sitemap/llms.txt（2d）、CMS（3）。

## 4. 設計
### 4.1 ルーティング（ページは複製しない）
- ミドルウェアで `/en` または `/en/…` を検出し、`locals.lang="en"` を設定して内部的に `/…` へ rewrite。日英は同一ページファイルを共有し、言語は `Astro.locals.lang`（既定 "ja"）で切り替える。
- 現在 `lang="ja"` 固定の各ページは `Astro.locals.lang` を使う。内部リンクは `l(lang, path)`（enなら `/en` を前置）。
- 末尾スラッシュ・`page/1`・旧uploads の301は `/en/` 付きURLにも適用（`/en` → `/en/`、`/en/works` → `/en/works/`、`/en/works/page/1/` → `/en/works/`）。`/en/media/…` は `/media/…` へ301。
- 英語版が存在しないルート（現時点: contact/chat/searches）は日英とも404のまま。

### 4.2 内容の英語化
- 記事: タイトル/抜粋/本文は `*_en`、空なら日本語（関数 `pick(lang, ja, en)`）。実績概要（client/role/tech_stack/kpi_results）も同規則。
- 訳語表: 現行PHPの `kb_term_en`（タグ・実績種別）、`kb_scope_label`（担当領域）、お知らせ種別の表をTypeScriptへ移植。未知の名前は日本語のまま。
- プロフィール: PHP内蔵の `kb_profile_defaults_en()` を一度だけD1のメタ `profile_*_en`（profileページ）へ投入する `scripts/seed-profile-en.ts`（functions.phpから機械抽出→SQL生成）。表示は `profile_*_en` があればそれ、無ければ日本語。
- 固定ページ（About/Privacy/Sample）は `title_en`/`content_en` があれば英語、無ければ日本語。

### 4.3 UI・メタ
- 英語の文言は既存の `t(lang, ja, en)`。未対応のトップ文言（ヒーロー、リード、プロフィール抜粋、お問い合わせCTA）は `front-page.php` の英語を移植。
- `<html lang>`、`<title>`（英語: `<記事タイトル> | Shinnosuke Kobayashi Official Website`、ENトップは `Shinnosuke Kobayashi Official Website`）、hreflang（ja / en / x-default=ja）。
- 言語切替（`.lang-switch`）はフッター下部とモバイルメニュー（`.gnav-extra`）に出力。ヘッダーには出さない。
- ペアURLが存在しない（404）ページはhreflangを出さず、切替は `/en/` へフォールバック。

## 5. 検証
- 純粋関数（言語判定・URL変換・pick・訳語表・redirects）はvitestで先に書く。
- 確認用サイトで `/en/…` が200、日本語版のスクリーンショット/URL比較が崩れていないこと。
- 旧サイト `/en/…` と新サイト `/en/…` のスクリーンショット比較（トップ、実績詳細、プロフィール）。`compare-urls.ts` の `/en/` 対象のstatus差分が、contact/chat/searches以外で0。

## 6. リスクと対応
| リスク | 対応 |
|---|---|
| rewriteがミドルウェアの301規則と干渉 | `/en/…` を先に解析し、301判定は言語プレフィックス除去後のパスで行う（テスト化） |
| 日本語固定の文言/リンクの取りこぼし | 英語版ページをcurlで取得し、日本語の固定UI文言（漢字かな）が残っていないか本文以外を点検 |
| 英語データ欠落（固定ページ） | 日本語へフォールバックし、欠落はledgerに一覧化 |
| 訳語表に無いタグ | 日本語表示のまま（現行と同じ） |

## 7. 成功条件
- 全対象ページの `/en/…` が200で英語表示（英語データがある箇所）、日本語版は従来どおり。
- hreflang・言語切替・`<html lang>`・英語`<title>`が出力される。
- 全テストが通り、確認用サイトにデプロイされる。
