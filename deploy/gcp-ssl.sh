#!/bin/bash
# DNS反映後に実行: Let's Encrypt SSL化＋WordPressのURLをhttpsへ切替
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-shinnosuke-portfolio}"
ZONE="${ZONE:-asia-northeast1-b}"
DOMAIN="${DOMAIN:-shinnosuke-kobayashi.jp}"
VM_NAME="${VM_NAME:-wp-portfolio}"
ADMIN_EMAIL="${ADMIN_EMAIL:-shinnosuke.kobayashi@weeave.com}"

echo "=== DNS確認 ==="
IP=$(gcloud compute addresses describe wp-static-ip --region="${ZONE%-*}" --project="$PROJECT_ID" --format='value(address)')
RESOLVED=$(dig +short "$DOMAIN" @8.8.8.8 | tail -1)  # ローカルリゾルバのネガティブキャッシュを回避
echo "静的IP: $IP / DNS解決: ${RESOLVED:-未解決}"
if [ "$RESOLVED" != "$IP" ]; then
  echo "⚠ DNSがまだ静的IPを向いていません。反映を待ってから再実行してください。"
  exit 1
fi

echo "=== certbot実行＋https切替 ==="
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" --command="
  sudo apt-get install -y -qq certbot python3-certbot-apache > /dev/null &&
  sudo certbot --apache -d '$DOMAIN' -d 'www.$DOMAIN' --non-interactive --agree-tos -m '$ADMIN_EMAIL' --redirect &&
  cd /var/www/wordpress &&
  sudo -u www-data wp option update home 'https://$DOMAIN' &&
  sudo -u www-data wp option update siteurl 'https://$DOMAIN' &&
  sudo systemctl reload apache2
"
echo "✅ SSL化完了: https://${DOMAIN}/ （証明書はcertbot.timerで自動更新されます）"
