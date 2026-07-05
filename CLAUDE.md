# CLAUDE.md — 「小林慎之助」ポートフォリオサイト 引き継ぎ

このフォルダをCursorで開き、Claude Codeが実装・デプロイを継続するための引き継ぎ情報。

## プロジェクト概要

- **目的**: 小林慎之助（Weeave株式会社 代表取締役／筑波大学 経営工学）のポートフォリオサイト構築
- **設計方針**: 「おしえて！アミタさん」の情報設計（条件検索・ランキング・タグ・資料DL等）を踏襲し、主役を「実績（Works）」に置き換えたメディア型ポートフォリオ
- **CMS**: WordPress（オリジナルテーマ実装済み）
- **ドメイン**: shinnosuke-kobayashi.jp（取得済み・**公開中**: https://shinnosuke-kobayashi.jp/）
- **ホスティング**: GCP プロジェクト `shinnosuke-kbys`／VM `wp-portfolio`（e2-small・asia-northeast1-b）／静的IP 35.189.147.122／Let's Encrypt（certbot.timerで自動更新）。管理者情報はVM内 `/root/wp-credentials.txt`（user: kobayashi）

## ファイルマップ

| パス | 内容 |
|---|---|
| `kobayashi-theme/` | WordPressオリジナルテーマ v1.7（**主要成果物・ブランド反映済み**。works_type 404修正＋ACFコード登録 `inc/acf-fields.php`＋SEO出力 `inc/seo.php`。v1.3: カード内アンカー入れ子によるレイアウト崩壊修正／v1.4: ユーティリティバー削除・ヒーロー波アニメ＋クリックでポイント／v1.5: アバター顔写真化 `kb_avatar()`・CF7スタイリング `page-contact.php`・ロゴ44px＋文字サイズ一括アップ／v1.6: ファーストビュー1画面化 `100svh-133px` 上限820px／v1.7: 格子をヒーロー全面の背景に（viewBox=実アスペクト比でJS動的生成・格子間隔94・ドット群は横長/縦長で配置切替、クリック演出は`.hero`側で拾いリンク上は無効。v1.7.1: 端に向かうradial-gradientマスクで格子をフェードさせ境界に余白感／v1.8: SNSリンク `kb_sns_links()`（プロフィール掲載・Instagramは`kb_sns_accounts()`にURL記入で表示）・実績詳細を刷新（spec表→`dl.ov`概要グリッド・リード文`.standfirst`・KPI/ギャラリーに`.blk-head`見出し・CTA刷新）・ロゴSVGの焼き込み余白をviewBoxクロップ（表示36px）／v1.10: モバイルを全画面オーバーレイメニュー化（×モーフ・段差フェード・検索/SNS/CTA内蔵・スクロールロック。header.siteのbackdrop-filterがfixedの基準になるためbottom:0でなく高さ明示）／v1.9: プロフィールを管理画面編集化（ACFテキスト欄＝無印ACF対応「1行1項目・パイプ区切り」方式。`kb_profile_defaults()`が初期値兼フォールバックで未保存でも表示不変。名前/肩書はトップ・コラム著者欄にも連動）） |
| `kobayashi-theme.zip` | 上記のインストール用zip（35ファイル） |
| `サイト設計書_小林慎之助.md` | 要件・IA・画面設計・コンテンツモデル・機能要件（正本） |
| `WordPress導入手順.md` | セットアップ〜GCP公開手順 |
| `デザインカンプ_トップ_小林慎之助.html` | トップページのデザインリファレンス（ブラウザで開く） |
| `ワイヤーフレーム_小林慎之助.html` | 全7画面のワイヤー（タブ切替） |
| `brand-assets/` | ブランドガイド原本（ロゴSVG/PNG・カラーCSS） |
| `小林慎之助_ポートフォリオ.md` | 実績・経歴の元データ（入稿コンテンツのソース） |
| `Shinnosuke_Face.png` | プロフィール顔写真（シードがprofileページのアイキャッチに自動設定。`kb_avatar()` がトップ/著者欄でも流用） |
| `Cloudflare導入手順.md` | Cloudflare導入によるセキュリティ強化手順（DNS切替・SSL Full(strict)・WAF・レート制限・mod_remoteip・オリジン遮断。**未実施**＝ユーザーのCloudflare/レジストラ操作が必要） |
| `deploy/` | GCPデプロイ一式（`gcp-deploy.sh`→`gcp-ssl.sh`の2段階。`seed-content.php`は入稿シード・ローカルE2E検証済み。`seed-pages.php`はAbout/プライバシーポリシー本文の投入用＝本番実行済み 2026-07-03） |

## デザイントークン（ブランドガイド準拠・変更禁止）

```css
--crimson:#C22740;      /* プライマリ */
--crimson-dark:#A61F35; /* hover */
--deep:#84192A;         /* 押下・濃色帯・小さいクリムゾン文字はこちら */
--tint:#F6D8DD; --tint-light:#FBECEE; --bg:#FDF9F9;
--ink:#1A1A1A; --gray:#5C5C5C; --line:#E6DCDE;
```

フォント: Noto Sans JP＋Inter。コントラスト: #C22740 on #FFF ≈ 5.7:1（AA）。ロゴはテーマ `assets/img/`（横組み=ヘッダー、マーク=ファビコン）。

## テーマ実装済み事項（kobayashi-theme/）

- CPT: `works`（実績）/ `column` / `news` / `document`。タクソノミー: `works_type` / `skill`（横断タグ）/ `industry` / `news_type`（お知らせ種別バッジ・初期値4種を自動投入）
- SEO/AIO（v1.15〜）: `inc/seo.php`＝OGP既定画像 `og-default.png`・Person/WebSite/ProfilePage/Article/BreadcrumbList JSON-LD（プロフィール編集欄・kb_sns_accounts連動）／`inc/aio.php`＝robots.txtでAIクローラー明示許可＋sitemap案内・`/llms.txt` 動的生成（**パーマリンク再保存が必要**）・検索結果noindex
- 条件検索（page-searches.php）: kw×期間×種別×skillタグ、公開順/更新順、GETクエリ保持
- PVランキング内蔵（`kb_views` メタ、プラグイン不要）、パンくず、シェア、公開日/更新日2軸表示
- ACF互換ヘルパー `kb_field()`（ACF未導入でも動作）。実績フィールド仕様は設計書§6.3
- 関数プレフィックス `kb_`、テキストドメイン `kobayashi`
- サムネ未設定時はグラデーション代替（.g1〜.g6、クリムゾン系ファミリー）

## 残タスク（優先順）

1. ~~ローカル環境でテーマ動作確認~~ ✅ 完了（2026-07-03）: wp-now（WordPress Playground）で検証。`cd kobayashi-theme && npx @wp-now/wp-now start --port 8881` で再現可（データは `~/.wp-now/wp-content/kobayashi-theme-*/` に永続化）。works_type タクソノミーが404になるバグを発見・修正済み（functions.php でタクソノミーをCPTより先に登録）
2. ~~ACFフィールドグループ作成とCF7フォーム作成~~ ✅ 完了: ACFは `inc/acf-fields.php` でコード自動登録（v1.2）。CF7フォームはローカルで作成・検証済み、本番用テンプレは導入手順.md §5-5
3. ~~コンテンツ入稿~~ ✅ 完了（ローカル）: 実績7件・DL資料下書きを入稿済み。プロフィールは管理画面編集（v1.9〜）。**本番環境には別途同じ入稿が必要**（職務経歴書PDFは未支給のままDL資料は下書き）
4. ~~実績のアイキャッチ画像~~ → **ユーザーが実装後にWP管理画面から差し込む方針に決定**（グラデーション代替が有効なため未設定でも成立）
5. ~~GCPデプロイ~~ ✅ 完了（2026-07-04）: https://shinnosuke-kobayashi.jp/ 公開・全ページ検証済み。デプロイ中に発見・修正した2件（wp-cliが.htaccessを書けない→明示生成、443ファイアウォールのタグtypo）はスクリプトに反映済み
6. ~~カードレイアウト崩壊（余白がおかしい）の修正~~ ✅ 完了（2026-07-03, v1.3）: カード`<a>`内に `kb_skill_chips()` が `<a class="chip">` を出力しアンカーが入れ子 → HTMLパーサーが外側リンクを分割し `.thumb`/`.body` がグリッドの別セルに割れていた。カード内チップを `<span>` 化（`kb_skill_chips( n, false )`）して解消。デザインカンプも `<span class="chip">` が正
7. ~~OGP・構造化データ~~ ✅ 完了（v1.3）: `inc/seo.php` で meta description／OGP／Twitterカードをフォールバック出力（SEO SIMPLE PACK等の有効時は自動で出力停止）＋ Person／Article JSON-LD
8. ~~About・プライバシーポリシー本文の投入~~ ✅ 完了（2026-07-03）: 本番VMで `wp eval-file seed-pages.php` 実行済み（raw.githubusercontent.comから取得して実行する手順で対応）
9. 運用設定（残り）: GA4/GTM設置、SiteGuardログインURL変更、BackWPupスケジュール、GCEスナップショット週次、実績アイキャッチ画像の差し込み（ユーザーがWP管理画面から）。**本番WP管理画面での実施待ち（2026-07-04依頼）**: ①サイトのタイトルを「小林慎之助 公式ホームページ」に変更（設定→一般）②CF7のメール送信先/送信元を contact@shinnosuke-kobayashi.jp に変更（導入手順.md §5-5の表が正）③設定→パーマリンクで「変更を保存」を1クリック（news_type・llms.txtのルーティング登録）④キャッチフレーズ末尾を「〜公式サイトです。」に
10. Cloudflare導入（`Cloudflare導入手順.md` 作成済み・実施待ち）: DNS切替とダッシュボード設定はユーザー操作。VM側の mod_remoteip／オリジン遮断コマンドは手順書§5参照
11. Phase 2候補: 登壇イベントCPT有効化、スキル辞典

## リポジトリ・CI/CD（2026-07-04〜）

- **GitHub**: git@github.com:shinnon21/main.git（公開。旧Next.jsアプリはクリア済み。個人文書は.gitignoreで除外）
- **自動デプロイ**: mainへのpushで `.github/workflows/deploy.yml` が `kobayashi-theme/` をVMへrsync反映（テーマ変更時のみ発火・手動実行も可）。VM側は制限付きsudoの `deployer` ユーザー＋`/usr/local/bin/kb-deploy-theme.sh`。秘密鍵はGitHub Secret `DEPLOY_SSH_KEY`
- **注意**: DBコンテンツ（記事・設定）はgit管理外。テーマ以外のファイル変更は自動デプロイされない

## 制約・注意

- **参考サイト（amita-oshiete.jp）のロゴ・文章・画像・テーマコードの流用は禁止**（情報設計の踏襲のみ可）。現テーマは全コード・コピー・素材ともオリジナル
- ブランドカラー・ロゴの改変不可（brand-assets/ が正）
- 標準「投稿」は管理画面から非表示化済み（CPTに集約）
- パーマリンク設定は「投稿名」必須（テーマ有効化後に必ず一度保存）
- **DL資料（職務経歴書PDF）機能は廃止決定**（2026-07-03）: 全テンプレートから導線撤去済み。CPT `document`・`page-documents.php` はコード上残置（Phase 2で復活可能）
- シード実行順序に注意: **テーマ有効化→プラグイン有効化→seed-content.php**（テーマ無効のまま実行するとタクソノミー割当が失われる。ガード実装済み）
