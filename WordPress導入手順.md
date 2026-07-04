# WordPress導入手順 — 「小林慎之助」サイト（kobayashi-theme v1.0）

設計書v1.1・デザインカンプ準拠のオリジナルテーマを導入する手順。所要時間の目安：初回90分。

## 1. ローカル環境で確認する（推奨・先にこちら）

1. [Local](https://localwp.com/)（無料）をインストール
2. 「Create a new site」→ サイト名 `kobayashi` で作成（PHP 8.x / 最新WP）
3. 管理画面 → 外観 → テーマ → 新規追加 → **テーマのアップロード** → `kobayashi-theme.zip` を選択 → 有効化

## 2. プラグイン導入

| プラグイン | 用途 | 必須 |
|---|---|---|
| Advanced Custom Fields（ACF） | 実績の詳細フィールド | ◎ |
| Contact Form 7 | お問い合わせフォーム | ◎ |
| SEO SIMPLE PACK | OGP・メタ出力 | ◎ |
| XML Sitemap & Google News | サイトマップ | ○ |
| EWWW Image Optimizer | 画像圧縮・WebP | ○ |
| WP Multibyte Patch | 日本語対応 | ○ |
| SiteGuard WP Plugin | セキュリティ | ○（本番） |
| BackWPup | バックアップ | ○（本番） |

※人気ランキングはテーマ内蔵のPVカウントで動作（プラグイン不要）。

## 3. 初期設定

1. **設定 → 一般**: サイトタイトル `小林慎之助`、キャッチフレーズ `政治・行政のDXから医薬品サプライチェーン研究まで。日本の技術を社会に届けるコーディネーターを志す、小林慎之助のポートフォリオサイトです。`
2. **設定 → パーマリンク**: 「投稿名」を選択して保存（CPTのURL有効化に必須。テーマ有効化後に必ず一度保存）
3. **固定ページを作成**（タイトル／スラッグ／テンプレート）:

| タイトル | スラッグ | テンプレート |
|---|---|---|
| プロフィール | `profile` | プロフィール |
| 条件から探す | `searches` | 条件から探す |
| 資料ダウンロード | `documents` | 資料ダウンロード |
| このサイトについて | `about` | デフォルト |
| お問い合わせ | `contact` | デフォルト（本文にCF7のショートコードを貼る） |
| プライバシーポリシー | `privacy` | デフォルト |

## 4. ACFフィールド定義（設計書 §6.3）

> **✅ 自動登録済み（v1.2〜）**: テーマの `inc/acf-fields.php` が ACF 有効化時に「実績情報」「資料情報」の両フィールドグループをコードで自動登録するため、**管理画面での手動作成は不要**。gallery / kpi_results（リピーター）は ACF Pro 検出時のみ追加される。以下の表は定義内容のリファレンス。

| フィールド名（=キー） | タイプ |
|---|---|
| `client_name` | テキスト |
| `period_start` / `period_end` | テキスト（例: 2025.09） |
| `role` | テキスト |
| `scope` | チェックボックス（要件定義/設計/デザイン/実装/運用） |
| `tech_stack` | テキスト |
| `site_url` | URL |
| `gallery` | ギャラリー（ACF Pro）※無印ACFの場合は本文に画像挿入で代替 |
| `kpi_results` | リピーター（ACF Pro／サブフィールド: `label`, `value`）※無印は省略可 |
| `is_featured` | 真偽値（トップ「注目の実績」に表示） |

フィールドグループ「資料情報」→ 投稿タイプ＝DL資料: `file`（ファイル）。

## 5. コンテンツ入稿

1. **スキルタグ**（実績 → スキルタグ）: `政治DX` `データ分析` `事業開発` `東南アジア` `コミュニティ構築` `経営工学` `サプライチェーン` `生成AI活用` `マーケティング` `スタートアップ` など
2. **実績種別**: `起業・経営` `DX支援` `国際事業開発` `マーケティング` `登壇・講師`
3. **実績**をポートフォリオ.mdから登録（Weeave創業／議員事務所DX／JSIP／RULEMAKERS DAO／AIESEC／Geears／AI勉強会）。各実績にアイキャッチ画像（スクリーンショット）を設定
4. **DL資料**: 職務経歴書PDFをアップし `file` に設定
5. **お問い合わせ**: CF7でフォーム作成 → ショートコードをcontactページ本文へ。フォームテンプレート（動作確認済み）:

```
<label> 氏名（必須）
    [text* your-name autocomplete:name] </label>

<label> 会社名・所属
    [text your-company autocomplete:organization] </label>

<label> メールアドレス（必須）
    [email* your-email autocomplete:email] </label>

<label> お問い合わせ種別（必須）
    [select* your-type "お仕事のご依頼・ご相談" "実績に関するお問い合わせ" "取材・登壇のご依頼" "その他"] </label>

<label> お問い合わせ内容（必須）
    [textarea* your-message] </label>

[acceptance your-consent] <a href="/privacy/">プライバシーポリシー</a>に同意します [/acceptance]

[submit "送信する"]
```

メール設定（「メール」タブ。送信先・返信元は contact@shinnosuke-kobayashi.jp に統一）:

| 項目 | メール（管理者宛） | メール(2)（自動返信・要有効化） |
|---|---|---|
| 送信先 | `contact@shinnosuke-kobayashi.jp` | `[your-email]` |
| 送信元 | `[_site_title] <contact@shinnosuke-kobayashi.jp>` | `[_site_title] <contact@shinnosuke-kobayashi.jp>` |
| 件名 | `[小林慎之助 公式ホームページ] [your-type]` | `【小林慎之助 公式ホームページ】お問い合わせを受け付けました` |
| 追加ヘッダー | `Reply-To: [your-email]` | `Reply-To: contact@shinnosuke-kobayashi.jp` |

> 前提: `contact@shinnosuke-kobayashi.jp` の受信メールボックスがメールサービス側（DNSのMX設定含む）に存在すること。届かない場合はドメインのSPFレコードにVMのIP（35.189.147.122）を追加する。

## 6. 本番公開 — GCP（ドメイン: shinnosuke-kobayashi.jp）

推奨構成: **Compute Engine e2-small（東京 asia-northeast1）＋静的IP＋Cloud DNS＋Let's Encrypt**。個人ポートフォリオ規模ではCloud Run＋Cloud SQL構成より安価でシンプル（月額目安 $15前後、e2-microなら更に低コスト）。

1. **ドメイン取得**: お名前.com等で `shinnosuke-kobayashi.jp` を取得（.jpは年3,000円前後）
2. **GCPプロジェクト作成** → Marketplaceで「WordPress」（Google Click to Deploy or Bitnami）をデプロイ（e2-small／asia-northeast1／ブートディスク20GB）
3. **静的IP**: VMの外部IPを「静的」に昇格
4. **Cloud DNS**: ゾーン作成 → Aレコードで `shinnosuke-kobayashi.jp` / `www` を静的IPへ → レジストラ側のネームサーバーをCloud DNSに変更
5. **SSL**: certbot（Click to Deploy）または Bitnami HTTPS Configuration Tool でLet's Encrypt設定＋自動更新
6. **テーマ・設定移行**: ローカルと同手順で再現、またはAll-in-One WP Migrationで移行
7. **運用設定**: SEO SIMPLE PACKでOGP設定 → GA4/GTM設置（CV: contact送信・資料DL）→ SiteGuardでログインURL変更 → BackWPup週次＋**GCEスナップショットスケジュール**（週1）
8. （任意）Cloud CDN または Cloudflare を前段に置いて高速化

※実装・デプロイ作業はCursor＋Claude Codeで継続する前提。プロジェクトルートの `CLAUDE.md` に引き継ぎ情報を記載済み。

## 補足

- 標準の「投稿」メニューは非表示化済み（実績/コラム/お知らせに集約）
- サムネイル未設定の場合は自動でグラデーション代替表示（カンプと同仕様）
- メニューは 外観 → メニュー で「グローバルナビ」に割り当て可能（未設定でも自動でデフォルトナビが出ます）
