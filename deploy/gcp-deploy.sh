#!/bin/bash
# GCPへのWordPressデプロイ（導入手順.md §6 のスクリプト版）
# 使い方:
#   BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX bash deploy/gcp-deploy.sh
# 主な環境変数（省略時は括弧内のデフォルト）:
#   PROJECT_ID (shinnosuke-portfolio) / MACHINE (e2-small) / ZONE (asia-northeast1-b)
#   DOMAIN (shinnosuke-kobayashi.jp) / VM_NAME (wp-portfolio) / USE_CLOUD_DNS (no)
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-shinnosuke-portfolio}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"
REGION="${REGION:-asia-northeast1}"
ZONE="${ZONE:-asia-northeast1-b}"
MACHINE="${MACHINE:-e2-small}"
DOMAIN="${DOMAIN:-shinnosuke-kobayashi.jp}"
VM_NAME="${VM_NAME:-wp-portfolio}"
USE_CLOUD_DNS="${USE_CLOUD_DNS:-no}"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DIR")"

echo "=== 0/6 事前チェック ==="
for f in "$ROOT/kobayashi-theme.zip" "$DIR/seed-content.php" "$ROOT/Shinnosuke_Face.png" "$DIR/setup-remote.sh"; do
  [ -f "$f" ] || { echo "必要ファイルがありません: $f"; exit 1; }
done

echo "=== 1/6 プロジェクト準備 (${PROJECT_ID}) ==="
if ! gcloud projects describe "$PROJECT_ID" > /dev/null 2>&1; then
  [ -n "$BILLING_ACCOUNT" ] || { echo "新規プロジェクト作成には BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX が必要です"; exit 1; }
  gcloud projects create "$PROJECT_ID" --name="Shinnosuke Portfolio"
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
fi
gcloud services enable compute.googleapis.com --project="$PROJECT_ID"

echo "=== 2/6 静的IP予約 ==="
if ! gcloud compute addresses describe wp-static-ip --region="$REGION" --project="$PROJECT_ID" > /dev/null 2>&1; then
  gcloud compute addresses create wp-static-ip --region="$REGION" --project="$PROJECT_ID"
fi
STATIC_IP=$(gcloud compute addresses describe wp-static-ip --region="$REGION" --project="$PROJECT_ID" --format='value(address)')
echo "静的IP: $STATIC_IP"

echo "=== 3/6 VM作成 (${MACHINE} / ${ZONE}) ==="
if ! gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" > /dev/null 2>&1; then
  gcloud compute instances create "$VM_NAME" \
    --project="$PROJECT_ID" --zone="$ZONE" --machine-type="$MACHINE" \
    --image-family=debian-12 --image-project=debian-cloud \
    --boot-disk-size=20GB --boot-disk-type=pd-balanced \
    --address="$STATIC_IP" --tags=http-server,https-server
fi
if ! gcloud compute firewall-rules describe allow-http --project="$PROJECT_ID" > /dev/null 2>&1; then
  gcloud compute firewall-rules create allow-http --project="$PROJECT_ID" --allow=tcp:80 --target-tags=http-server
fi
if ! gcloud compute firewall-rules describe allow-https --project="$PROJECT_ID" > /dev/null 2>&1; then
  gcloud compute firewall-rules create allow-https --project="$PROJECT_ID" --allow=tcp:443 --target-tags=https-server
fi

echo "=== 4/6 ファイル転送（SSH開通待ち込み） ==="
for i in $(seq 1 12); do
  if gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" --command="true" > /dev/null 2>&1; then break; fi
  echo "SSH待機中... ($i/12)"; sleep 10
done
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" --command="mkdir -p /tmp/kb-bundle"
gcloud compute scp "$ROOT/kobayashi-theme.zip" "$DIR/seed-content.php" "$ROOT/Shinnosuke_Face.png" "$DIR/setup-remote.sh" \
  "$VM_NAME:/tmp/kb-bundle/" --zone="$ZONE" --project="$PROJECT_ID"

echo "=== 5/6 リモートセットアップ実行 ==="
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" \
  --command="sudo DOMAIN='$DOMAIN' bash /tmp/kb-bundle/setup-remote.sh"

echo "=== 6/6 DNS ==="
if [ "$USE_CLOUD_DNS" = "yes" ]; then
  gcloud services enable dns.googleapis.com --project="$PROJECT_ID"
  if ! gcloud dns managed-zones describe portfolio-zone --project="$PROJECT_ID" > /dev/null 2>&1; then
    gcloud dns managed-zones create portfolio-zone --project="$PROJECT_ID" \
      --dns-name="${DOMAIN}." --description="Portfolio zone"
  fi
  gcloud dns record-sets transaction start --zone=portfolio-zone --project="$PROJECT_ID"
  gcloud dns record-sets transaction add "$STATIC_IP" --zone=portfolio-zone --project="$PROJECT_ID" \
    --name="${DOMAIN}." --ttl=300 --type=A || true
  gcloud dns record-sets transaction add "$STATIC_IP" --zone=portfolio-zone --project="$PROJECT_ID" \
    --name="www.${DOMAIN}." --ttl=300 --type=A || true
  gcloud dns record-sets transaction execute --zone=portfolio-zone --project="$PROJECT_ID"
  echo "Cloud DNSゾーンを作成しました。レジストラ側のネームサーバーを以下に変更してください:"
  gcloud dns managed-zones describe portfolio-zone --project="$PROJECT_ID" --format='value(nameServers)'
else
  echo "レジストラのDNS管理画面で以下のAレコードを設定してください:"
  echo "  ${DOMAIN}      A  ${STATIC_IP}"
  echo "  www.${DOMAIN}  A  ${STATIC_IP}"
fi

echo ""
echo "✅ デプロイ完了: http://${STATIC_IP}/ で仮確認できます"
echo "   DNS反映後（dig ${DOMAIN} で確認）に bash deploy/gcp-ssl.sh を実行してSSL化してください"
