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
| `kobayashi-theme/` | WordPressオリジナルテーマ v1.2（**主要成果物・ブランド反映済み**。works_type 404修正＋ACFコード登録 `inc/acf-fields.php` 追加） |
| `kobayashi-theme.zip` | 上記のインストール用zip（35ファイル） |
| `サイト設計書_小林慎之助.md` | 要件・IA・画面設計・コンテンツモデル・機能要件（正本） |
| `WordPress導入手順.md` | セットアップ〜GCP公開手順 |
| `デザインカンプ_トップ_小林慎之助.html` | トップページのデザインリファレンス（ブラウザで開く） |
| `ワイヤーフレーム_小林慎之助.html` | 全7画面のワイヤー（タブ切替） |
| `brand-assets/` | ブランドガイド原本（ロゴSVG/PNG・カラーCSS） |
| `小林慎之助_ポートフォリオ.md` | 実績・経歴の元データ（入稿コンテンツのソース） |
| `Shinnosuke_Face.png` | プロフィール顔写真（シードがprofileページのアイキャッチに自動設定） |
| `deploy/` | GCPデプロイ一式（`gcp-deploy.sh`→`gcp-ssl.sh`の2段階。`seed-content.php`は入稿シード・ローカルE2E検証済み） |

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

- CPT: `works`（実績）/ `column` / `news` / `document`。タクソノミー: `works_type` / `skill`（横断タグ）/ `industry`
- 条件検索（page-searches.php）: kw×期間×種別×skillタグ、公開順/更新順、GETクエリ保持
- PVランキング内蔵（`kb_views` メタ、プラグイン不要）、パンくず、シェア、公開日/更新日2軸表示
- ACF互換ヘルパー `kb_field()`（ACF未導入でも動作）。実績フィールド仕様は設計書§6.3
- 関数プレフィックス `kb_`、テキストドメイン `kobayashi`
- サムネ未設定時はグラデーション代替（.g1〜.g6、クリムゾン系ファミリー）

## 残タスク（優先順）

1. ~~ローカル環境でテーマ動作確認~~ ✅ 完了（2026-07-03）: wp-now（WordPress Playground）で検証。`cd kobayashi-theme && npx @wp-now/wp-now start --port 8881` で再現可（データは `~/.wp-now/wp-content/kobayashi-theme-*/` に永続化）。works_type タクソノミーが404になるバグを発見・修正済み（functions.php でタクソノミーをCPTより先に登録）
2. ~~ACFフィールドグループ作成とCF7フォーム作成~~ ✅ 完了: ACFは `inc/acf-fields.php` でコード自動登録（v1.2）。CF7フォームはローカルで作成・検証済み、本番用テンプレは導入手順.md §5-5
3. ~~コンテンツ入稿~~ ✅ 完了（ローカル）: 実績7件・DL資料下書きを入稿済み。プロフィールはテンプレート直書き。**本番環境には別途同じ入稿が必要**（職務経歴書PDFは未支給のままDL資料は下書き）
4. ~~実績のアイキャッチ画像~~ → **ユーザーが実装後にWP管理画面から差し込む方針に決定**（グラデーション代替が有効なため未設定でも成立）
5. ~~GCPデプロイ~~ ✅ 完了（2026-07-04）: https://shinnosuke-kobayashi.jp/ 公開・全ページ検証済み。デプロイ中に発見・修正した2件（wp-cliが.htaccessを書けない→明示生成、443ファイアウォールのタグtypo）はスクリプトに反映済み
6. 運用設定（残り）: SEO SIMPLE PACKでOGP設定、GA4/GTM設置、SiteGuardログインURL変更、BackWPupスケジュール、GCEスナップショット週次、実績アイキャッチ画像の差し込み（ユーザーがWP管理画面から）
7. Phase 2候補: 登壇イベントCPT有効化、スキル辞典、構造化データ強化（Person/Article JSON-LD）

## 制約・注意

- **参考サイト（amita-oshiete.jp）のロゴ・文章・画像・テーマコードの流用は禁止**（情報設計の踏襲のみ可）。現テーマは全コード・コピー・素材ともオリジナル
- ブランドカラー・ロゴの改変不可（brand-assets/ が正）
- 標準「投稿」は管理画面から非表示化済み（CPTに集約）
- パーマリンク設定は「投稿名」必須（テーマ有効化後に必ず一度保存）
- **DL資料（職務経歴書PDF）機能は廃止決定**（2026-07-03）: 全テンプレートから導線撤去済み。CPT `document`・`page-documents.php` はコード上残置（Phase 2で復活可能）
- シード実行順序に注意: **テーマ有効化→プラグイン有効化→seed-content.php**（テーマ無効のまま実行するとタクソノミー割当が失われる。ガード実装済み）
