# CLAUDE.md — 「小林慎之助」ポートフォリオサイト 引き継ぎ

このフォルダをCursorで開き、Claude Codeが実装・デプロイを継続するための引き継ぎ情報。

## プロジェクト概要

- **目的**: 小林慎之助（Weeave株式会社 代表取締役／筑波大学 経営工学）のポートフォリオサイト構築
- **設計方針**: 「おしえて！アミタさん」の情報設計（条件検索・ランキング・タグ・資料DL等）を踏襲し、主役を「実績（Works）」に置き換えたメディア型ポートフォリオ
- **CMS**: WordPress（オリジナルテーマ実装済み）
- **ドメイン**: shinnosuke-kobayashi.jp（取得済み・**公開中**: https://shinnosuke-kobayashi.jp/）
- **ホスティング**: GCP プロジェクト `shinnosuke-kbys`（**2026-07-06に weeave.com 組織から shinnosuke-kobayashi.jp 組織 `393032890466` へ移行済み**。管理者: hello@shinnosuke-kobayashi.jp／課金も同組織の課金アカウント「AMEX」`01AD2E-66381C-FFA6B2` に切替済み。**weeave.comアカウントの権限は全て削除済み（2026-07-06）＝gcloud操作は必ず `--account=hello@shinnosuke-kobayashi.jp` で行うこと**）／VM `wp-portfolio`（e2-small・asia-northeast1-b）／静的IP 35.189.147.122／Let's Encrypt（certbot.timerで自動更新）。管理者情報はVM内 `/root/wp-credentials.txt`（user: kobayashi）

## ファイルマップ

| パス | 内容 |
|---|---|
| `kobayashi-theme/` | WordPressオリジナルテーマ v1.7（**主要成果物・ブランド反映済み**。works_type 404修正＋ACFコード登録 `inc/acf-fields.php`＋SEO出力 `inc/seo.php`。v1.3: カード内アンカー入れ子によるレイアウト崩壊修正／v1.4: ユーティリティバー削除・ヒーロー波アニメ＋クリックでポイント／v1.5: アバター顔写真化 `kb_avatar()`・CF7スタイリング `page-contact.php`・ロゴ44px＋文字サイズ一括アップ／v1.6: ファーストビュー1画面化 `100svh-133px` 上限820px／v1.7: 格子をヒーロー全面の背景に（viewBox=実アスペクト比でJS動的生成・格子間隔94・ドット群は横長/縦長で配置切替、クリック演出は`.hero`側で拾いリンク上は無効。v1.7.1: 端に向かうradial-gradientマスクで格子をフェードさせ境界に余白感／v1.8: SNSリンク `kb_sns_links()`（プロフィール掲載・Instagramは`kb_sns_accounts()`にURL記入で表示）・実績詳細を刷新（spec表→`dl.ov`概要グリッド・リード文`.standfirst`・KPI/ギャラリーに`.blk-head`見出し・CTA刷新）・ロゴSVGの焼き込み余白をviewBoxクロップ（表示36px）／v1.10: モバイルを全画面オーバーレイメニュー化（×モーフ・段差フェード・検索/SNS/CTA内蔵・スクロールロック。header.siteのbackdrop-filterがfixedの基準になるためbottom:0でなく高さ明示）／v1.9: プロフィールを管理画面編集化（ACFテキスト欄＝無印ACF対応「1行1項目・パイプ区切り」方式。`kb_profile_defaults()`が初期値兼フォールバックで未保存でも表示不変。名前/肩書はトップ・コラム著者欄にも連動）／v1.18: **全ページ日英2言語対応**（プラグイン不要 `inc/i18n.php`＝`/en/`プレフィックスの書き換えルール・`kb_t()`/`kb_home()`/`kb_term_en()`/`kb_scope_label()`/`kb_field_i18n()`・EN時は内部リンクを自動で/en/化・hreflang/lang属性/言語切替ピル`kb_lang_switcher()`。記事コンテンツはメタ `title_en`/`excerpt_en`/`content_en`（＋実績は`client_name_en`等）でJPフォールバック＝ACF欄「英語版コンテンツ」から編集可。ENプロフィール初期値は`kb_profile_defaults_en()`。SEO/OGP/JSON-LD/`<title>`もEN連動。**公開にはパーマリンク再保存＋`deploy/seed-en.php`実行が必要**）） ／v1.18.1: ヘッダー背景を真っ白 `rgba(255,255,255,.92)` に（ユーザー選定A案。 blur維持）／v1.18.2: 「プロフィール編集」欄が管理画面に出ない問題の堅牢化（ACF場所ルールにprofileページIDを追加＋admin_initで`_wp_page_template`自己修復。**表示にはACFプラグインの有効化が必要**）／v1.19: 英語版を全て管理画面編集可に（「プロフィール編集（英語版）」欄＝`profile_*_en`・「英語版 実績情報」欄＝`client_name_en`/`role_en`/`tech_stack_en`。初期値はテーマ内蔵英訳で未保存でも表示不変）／v1.20: **AIチャットボット**（`inc/chatbot.php`＋`assets/chatbot.js`＝右下ウィジェット→REST `kobayashi/v1/chat`→Vertex AI generateContent。認証はGCEメタデータサーバーのSAトークン（APIキー代替可）・既定モデル`gemini-2.5-flash-lite`・**創作禁止**＝掲載情報（プロフィール/実績/コラム/お知らせ/About等）を丸ごとsystem promptに注入しtemperature=0、掲載外は回答せず問い合わせフォームへ誘導。コーパスは日英別（EN時は`*_en`メタ・`/en/`URL使用）に6hキャッシュ＋save_postで破棄・公開記事のみ（パスワード保護除外）。レート制限 IP毎8回/分・40回/日＋全体800回/日。設定は管理画面「設定→AIチャットボット」（有効化・接続テスト。**既定OFF**＝GCP設定後にONへ。手順は`チャットボット導入手順.md`）・日英対応。v1.20.1: 一人称アバター化（本人「私」として親しみやすく回答＝system prompt刷新・ヘッダー/挨拶/サジェストも一人称。ただし掲載情報のみ・創作禁止は維持）＋応答の最小Markdownレンダリング（`**太字**`・`- 箇条書き`・改行をchatbot.jsがDOM生成で安全に描画。テーマ既定`ul{list-style:none}`をチャット内のみ復元。URLは`https://`完全形を要求）／v1.20.2: アバターのグラフィック演出（FABを顔写真＋クリムゾンの波紋ハロー化・パネルヘッダーのアバターに応答中`.kb-chat.busy`だけ発火するソナーリング／破線リング回転＋ステータス「オンライン⇄入力中…」＋波形イコライザ。全てCSS/SVGのみ・外部サービス不要・`prefers-reduced-motion`対応）／v1.21: **全画面AIチャットページ**（`page-chat.php`＝スラッグ`/chat/`・テンプレ名「AIチャット（全画面アバター）」。中央に大きなオリジナルSVGキャラ顔`kb_chat_avatar_svg()`を据え、`assets/chat-page.js`が応答ライフサイクルでアバターの状態を駆動＝考え中(`is-thinking`:首かしげ＋思考ドット)／回答中(`is-talking`:口パク＋首振り＋ソナー)。まばたきは常時。既存REST/Markdownレンダラー流用・浮遊ウィジェットは本ページで抑制。chatページはinit時に自動生成しテンプレ割当。フッターに導線。**`/en/chat/`はパーマリンク再保存が必要**）／v1.21.1: 全画面アバターをオリジナルSVGキャラ→**本人写真**に変更（顔中心クロップ`assets/img/kb-avatar-face.jpg`＝`kb_avatar_face_url()`。FAB/ヘッダーも同画像に統一）。演出を強化＝常時「呼吸で上下＋ゆらぎ＋まばたき（肌色まぶた）＋破線リング回転＋ハロー脈動」、is-thinkingで首かしげ＋思考ドット、is-talkingで大きくうなずき＋ソナー＋波形イコライザ。口パクは写真だと不自然なため不採用）／v1.21.2: 全画面アバターを**本人写真をもとにしたオリジナルSVGキャラ**に変更（`kb_chat_avatar_svg()`＝横分け黒髪・チャコールのスーツ・紺ドットタイで本人を反映。ヘッドレスChromiumでレンダリング確認しながら作成）。イラストなので表情も可動＝まばたき常時・is-thinkingで眉上げ＋首かしげ＋思考ドット・is-talikingで**口パク**＋うなずき＋ソナー＋波形。周囲演出（ハロー/破線リング/波形/思考ドット）はグリッド重ね。FAB/ヘッダーは引き続き本人写真`kb-avatar-face.jpg`）／v1.21.3: 全画面アバターを**ユーザー提供のLottie**に差し替え（クリムゾンの記号アバター・通常/考え中/回答中の3ループ。`assets/avatar/avatar_{idle,thinking,answering}.json`＋同梱プレイヤー`assets/lottie.min.js`＝lottie-web 5.12.2・外部通信なし）。`kb_chat_avatar_svg()`はLottieホスト`#kbcAvatar`＋静止ポスター`assets/img/avatar-poster.png`（読込前/JS無効時のフォールバック）を出力。`chat-page.js`が送信→thinking／回答→answering／完了→idleで切替。chatページのみ`lottie.min.js`をenqueue。旧SVGキャラ/写真アバターの演出CSSは撤去。FAB/ヘッダーは引き続き本人写真）／v1.21.4: **アバターを全面Lottie統一＋UI調整**（①FAB・ヘッダーも同じLottieアバターに統一し**丸枠を撤去**＝アバターがそのまま浮かぶ形。透過ポスター`avatar-poster.png`はRGBA化。`chatbot.js`が`mountAvatar()`でFAB常時idle・ヘッダーは会話状態でidle/thinking/answering切替。`lottie.min.js`はウィジェット有効時に全ページenqueue（`kb-chatbot`の依存）②グローバルナビ`kb_default_nav()`に「AIチャット」導線を追加＝カスタムメニュー未使用時に表示（メニュー使用時は管理画面で`/chat/`追加が必要）③`/chat/`を**1画面に収める**＝`.kbc-page`高さ=`100dvh-72px`固定・カードが残り高さをflexで占め`.kbc-log`のみ内部スクロール・アバターは`clamp(...vh...)`で短い画面でも縮小・モバイルはサブ説明を非表示）／v1.21.5: ヘッダー整理＋ウィジェット全画面導線＋文言調整（①言語切替`kb_lang_switcher()`をヘッダーから撤去し**フッター下部＋モバイルメニュー**へ移動＝ナビ6項目が1行に収まる。`nav.gnav ul a`に`white-space:nowrap`、≤1200/≤1040でgap・検索幅・フォントを段階的に縮小 ②ウィジェットのパネルヘッダーに**全画面ボタン`.kb-chat-expand`**（斜め矢印・`/chat/`へリンク）を×の左に追加 ③`/chat/`ヒーローの「AI AVATAR」ラベルを削除）／v1.21.6: スキルタグのティッカーが1周ごとにカクついて途切れる不具合を修正（`.ticker .lane`の`gap`を廃止し各チップの`margin-right`で間隔を作成＝`translateX(-50%)`が複製1個分＝1周期と正確に一致。ヘッドレスChromiumで`offsetWidth/2 == child[N].offsetLeft`＝diff 0pxを実測確認）／v1.21.7: モバイル（≤600px）ではFABアバターのタップで小窓を開かず全画面AIチャット`/chat/`へ遷移（`chatbot.js`が`matchMedia`で判定・`kbChatCfg.chatUrl`＝`kb_home('/chat/')`。デスクトップは従来どおりパネル開閉）） |
| `kobayashi-theme.zip` | 上記のインストール用zip（42ファイル・v1.21時点） |
| `サイト設計書_小林慎之助.md` | 要件・IA・画面設計・コンテンツモデル・機能要件（正本） |
| `WordPress導入手順.md` | セットアップ〜GCP公開手順 |
| `デザインカンプ_トップ_小林慎之助.html` | トップページのデザインリファレンス（ブラウザで開く） |
| `ワイヤーフレーム_小林慎之助.html` | 全7画面のワイヤー（タブ切替） |
| `brand-assets/` | ブランドガイド原本（ロゴSVG/PNG・カラーCSS） |
| `小林慎之助_ポートフォリオ.md` | 実績・経歴の元データ（入稿コンテンツのソース） |
| `Shinnosuke_Face.png` | プロフィール顔写真（シードがprofileページのアイキャッチに自動設定。`kb_avatar()` がトップ/著者欄でも流用） |
| `Cloudflare導入手順.md` | Cloudflare導入によるセキュリティ強化手順（DNS切替・SSL Full(strict)・WAF・レート制限・mod_remoteip・オリジン遮断。**未実施**＝ユーザーのCloudflare/レジストラ操作が必要） |
| `チャットボット導入手順.md` | AIチャットボット（v1.20）の本番有効化手順（Vertex AI API有効化・VMサービスアカウントへ`roles/aiplatform.user`付与・スコープ`cloud-platform`化＝**VM停止→起動が必要**・管理画面での有効化と接続テスト・コスト目安 約0.2〜0.4円/回。**未実施**＝gcloud操作待ち） |
| `deploy/` | GCPデプロイ一式（`gcp-deploy.sh`→`gcp-ssl.sh`の2段階。`seed-content.php`は入稿シード・ローカルE2E検証済み。`seed-pages.php`はAbout/プライバシーポリシー本文の投入用＝本番実行済み 2026-07-03。`seed-en.php`は英語版メタ（実績7件・お知らせ・固定ページのtitle_en/excerpt_en/content_en等）の投入用＝**本番未実行**） |

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
9. 運用設定（残り）: ~~GA4/GTM設置~~ ✅ ユーザーがWP側で導入済み（2026-07-05）、SiteGuardログインURL変更、BackWPupスケジュール、GCEスナップショット週次、実績アイキャッチ画像の差し込み（ユーザーがWP管理画面から）。**本番WP管理画面での実施待ち（2026-07-04依頼）**: ①サイトのタイトルを「小林慎之助 公式ホームページ」に変更（設定→一般）②CF7のメール送信先/送信元を contact@shinnosuke-kobayashi.jp に変更（導入手順.md §5-5の表が正）③設定→パーマリンクで「変更を保存」を1クリック（news_type・llms.txt・**/en/** のルーティング登録）④キャッチフレーズ末尾を「〜公式サイトです。」に ⑤英語版コンテンツ投入: VMで `wp eval-file` により raw.githubusercontent.com の `deploy/seed-en.php` を実行（seed-pagesと同じ手順）→ ③のパーマリンク再保存。EN版CF7フォーム（英語の問い合わせフォーム）は未作成＝/en/contact/ は日本語フォームを流用
10. Cloudflare導入（`Cloudflare導入手順.md` 作成済み・実施待ち）: DNS切替とダッシュボード設定はユーザー操作。VM側の mod_remoteip／オリジン遮断コマンドは手順書§5参照
11. AIチャットボット有効化（テーマv1.20実装済み・**GCP設定待ち**）: `チャットボット導入手順.md` の手順1〜4（Vertex AI API有効化→VMサービスアカウントへロール付与→VMスコープ変更＝停止起動→管理画面「設定→AIチャットボット」で接続テスト・有効化）
12. Phase 2候補: 登壇イベントCPT有効化、スキル辞典

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
