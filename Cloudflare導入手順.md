# Cloudflare導入手順 — shinnosuke-kobayashi.jp セキュリティ強化

本サイト（GCP VM `wp-portfolio`／Apache／Let's Encrypt）の前段にCloudflareを設置し、WAF・DDoS対策・Bot対策・CDNキャッシュ・オリジンIP秘匿を有効化する手順。**Freeプランで完結**します。

> 所要時間: 30分程度＋DNS切替の伝播待ち。サイトを止めずに移行できます。

## 現在の構成（前提）

- ドメイン: `shinnosuke-kobayashi.jp`（+ `www`）→ 静的IP `35.189.147.122`
- オリジン: GCP VM（Apache + WordPress、Let's Encrypt証明書がcertbot.timerで自動更新）
- 導入後の経路: 訪問者 → **Cloudflare（Proxy）** → GCP VM

---

## 1. サイト追加とDNS設定

1. https://dash.cloudflare.com/sign-up でアカウント作成（Freeプラン）
2. 「サイトを追加」→ `shinnosuke-kobayashi.jp` を入力 → **Freeプラン**を選択
3. 既存DNSレコードが自動スキャンされる。以下の2つが**Proxied（オレンジ雲）**になっていることを確認（無ければ手動追加）:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `shinnosuke-kobayashi.jp`（@） | `35.189.147.122` | Proxied 🟠 |
| A | `www` | `35.189.147.122` | Proxied 🟠 |

4. Cloudflareが提示する**ネームサーバー2つ**を控える
5. ドメインレジストラ（お名前.com等、ドメインを取得した業者）の管理画面で、ネームサーバーをCloudflareのものに変更
6. 伝播を待つ（数分〜数時間。Cloudflareダッシュボードに「Active」と表示されたら完了）

```bash
# 切替確認（CloudflareのIPが返るようになる）
dig +short shinnosuke-kobayashi.jp
# 応答ヘッダにcf-rayが付けばCloudflare経由
curl -sI https://shinnosuke-kobayashi.jp/ | grep -i cf-ray
```

## 2. SSL/TLS設定（重要・最初にやる）

ダッシュボード → SSL/TLS:

- **暗号化モード: Full (strict)** — オリジンに有効なLet's Encrypt証明書があるため必ずこれを選ぶ。「Flexible」にするとリダイレクトループや平文通信が発生するので厳禁
- Edge Certificates:
  - **Always Use HTTPS: ON**
  - **Minimum TLS Version: 1.2**
  - Automatic HTTPS Rewrites: ON

> **certbot更新の注意**: Let's EncryptのHTTP-01チャレンジ（`/.well-known/acme-challenge/`）はCloudflareプロキシ経由でも通ります。導入後、次回更新時に `sudo certbot renew --dry-run` で成功することを一度確認しておくと安心です。

## 3. セキュリティ設定

ダッシュボード → Security:

1. **Bot Fight Mode: ON**（Security → Bots）
2. **Under Attack Mode はOFFのまま**にする（旧「Security Level」の段階設定は廃止済み。全訪問者にチャレンジが出るため、DDoS被害を受けている最中のみONにする）
3. **WAFカスタムルール**（Security → WAF → Custom rules。Freeは5個まで）:

   **ルール1: ログイン保護（管理画面をチャレンジで防御）**
   - 式: `(http.request.uri.path contains "/wp-login.php") or (http.request.uri.path contains "/wp-admin/" and not http.request.uri.path contains "/wp-admin/admin-ajax.php")`
   - アクション: **Managed Challenge**

   **ルール2: xmlrpc.php遮断（ブルートフォース常套経路・本サイトでは未使用）**
   - 式: `http.request.uri.path eq "/xmlrpc.php"`
   - アクション: **Block**

   **ルール3: ユーザー列挙の遮断**
   - 式: `http.request.uri.query contains "author="`
   - アクション: **Managed Challenge**

4. **レート制限**（Security → WAF → Rate limiting rules。Freeで1個）:
   - 式: `http.request.uri.path contains "/wp-login.php"`
   - 条件: 同一IPから **10秒間に5リクエスト** 超過で **Block（10秒）**

> SiteGuard（VM側プラグイン・導入済み）のログインURL変更と併用すると多層防御になります。

## 4. キャッシュ・パフォーマンス

- Caching → Configuration: **Caching Level: Standard**、Browser Cache TTL: 4 hours以上
- Speed → Optimization: **Early Hints ON**・Brotli ON（デフォルトON）
- 管理画面をキャッシュから除外（Caching → Cache Rules）:
  - 式: `(http.request.uri.path contains "/wp-admin/") or (http.request.uri.path contains "/wp-login.php")`
  - 設定: **Bypass cache**

> CloudflareのデフォルトキャッシュはHTMLを対象にしない（拡張子ベースでCSS/JS/画像等のみ）ため、通常ページがログイン状態と混ざる心配はありません。**「Cache Everything」等でHTMLキャッシュを有効化するのは非推奨**: FreeプランにはログインCookieによる自動バイパス機能がなく（Bypass Cache on CookieはBusiness以上）、ログイン済みページが匿名訪問者に配信される事故につながります。

## 5. VM側の仕上げ（SSHで実行）

### 5-1. 実IPの復元（Apacheアクセスログ・セキュリティプラグイン用）

プロキシ経由になるとApacheのアクセスログやSiteGuard等が見るIPが全部CloudflareのIPになるため、`mod_remoteip` で訪問者の実IPを復元する（テーマのPVカウントはIPを使わないため影響なし）:

```bash
sudo tee /etc/apache2/conf-available/cloudflare-remoteip.conf > /dev/null <<'EOF'
RemoteIPHeader CF-Connecting-IP
# Cloudflare IPレンジ (https://www.cloudflare.com/ips/ 変更時は更新)
RemoteIPTrustedProxy 173.245.48.0/20
RemoteIPTrustedProxy 103.21.244.0/22
RemoteIPTrustedProxy 103.22.200.0/22
RemoteIPTrustedProxy 103.31.4.0/22
RemoteIPTrustedProxy 141.101.64.0/18
RemoteIPTrustedProxy 108.162.192.0/18
RemoteIPTrustedProxy 190.93.240.0/20
RemoteIPTrustedProxy 188.114.96.0/20
RemoteIPTrustedProxy 197.234.240.0/22
RemoteIPTrustedProxy 198.41.128.0/17
RemoteIPTrustedProxy 162.158.0.0/15
RemoteIPTrustedProxy 104.16.0.0/13
RemoteIPTrustedProxy 104.24.0.0/14
RemoteIPTrustedProxy 172.64.0.0/13
RemoteIPTrustedProxy 131.0.72.0/22
RemoteIPTrustedProxy 2400:cb00::/32
RemoteIPTrustedProxy 2606:4700::/32
RemoteIPTrustedProxy 2803:f800::/32
RemoteIPTrustedProxy 2405:b500::/32
RemoteIPTrustedProxy 2405:8100::/32
RemoteIPTrustedProxy 2a06:98c0::/29
RemoteIPTrustedProxy 2c0f:f248::/32
EOF
sudo a2enmod remoteip
sudo a2enconf cloudflare-remoteip
sudo systemctl reload apache2
```

### 5-2. （任意・推奨）オリジンへの直接アクセス遮断

DNS切替後もIP直打ち（`35.189.147.122`）でオリジンに到達できるため、GCPファイアウォールをCloudflare IPレンジのみに絞るとオリジン秘匿が完成する:

```bash
# ローカルPC（gcloud CLI）で実行。80/443をCloudflare IPv4レンジのみに制限
CF_IPS="173.245.48.0/20,103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,141.101.64.0/18,108.162.192.0/18,190.93.240.0/20,188.114.96.0/20,197.234.240.0/22,198.41.128.0/17,162.158.0.0/15,104.16.0.0/13,104.24.0.0/14,172.64.0.0/13,131.0.72.0/22"
gcloud compute firewall-rules update allow-http  --project=shinnosuke-kbys --source-ranges="$CF_IPS"
gcloud compute firewall-rules update allow-https --project=shinnosuke-kbys --source-ranges="$CF_IPS"
```

> **注意**: これを行うとSSH以外の直接アクセスが不可になる（SSHは別ルールなので影響なし）。Let's Encryptの更新もCloudflare経由で通るため問題ないが、Cloudflareを解約する際は必ず `--source-ranges=0.0.0.0/0` に戻すこと。

## 6. 動作確認チェックリスト

- [ ] `dig +short shinnosuke-kobayashi.jp` がCloudflareのIP（104.x等）を返す
- [ ] トップ・実績・お問い合わせページが正常表示（`cf-ray` ヘッダあり）
- [ ] `https://shinnosuke-kobayashi.jp/wp-login.php` でチャレンジ画面が出る → 通過後ログイン可能
- [ ] `https://shinnosuke-kobayashi.jp/xmlrpc.php` が403 Block
- [ ] CF7フォームから送信テスト（メール到達）
- [ ] `sudo certbot renew --dry-run` 成功（VM上で）
- [ ] （5-2実施時）`curl -m 5 http://35.189.147.122/` がタイムアウト＝直アクセス遮断

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| リダイレクトループ | SSL/TLSモードが「Flexible」になっている → **Full (strict)** に変更 |
| 522 Connection timed out | GCPファイアウォールがCloudflare IPを許可していない → 5-2の設定を確認 |
| 管理画面が不安定・ログイン即切断 | Cache RulesでBypassが効いているか確認（手順4） |
| certbot更新失敗 | 第一選択は**DNS-01への切替**（`certbot-dns-cloudflare` プラグイン＋Cloudflare APIトークン。インバウンド到達性が不要で最も安全）。グレー雲（Proxy OFF）での更新は**5-2実施済み環境では使えない**: オリジンがCloudflare IP以外を遮断しているため検証も通常アクセスも失敗し、切替中サイトが停止する。どうしてもグレー雲で更新する場合は、先に `gcloud compute firewall-rules update allow-http --source-ranges=0.0.0.0/0`（allow-httpsも同様）で一時開放してから行い、終了後に必ず絞り直すこと |
| アクセスログのIPが全部Cloudflareになる | mod_remoteip未設定 → 5-1を実施 |
