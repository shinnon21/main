#!/bin/bash
# VM上で実行するWordPressセットアップ（gcp-deploy.shからSSH経由で起動される）
# 前提: Debian 12、/tmp/kb-bundle/ に kobayashi-theme.zip / seed-content.php / Shinnosuke_Face.png
set -euo pipefail

DOMAIN="${DOMAIN:-shinnosuke-kobayashi.jp}"
ADMIN_EMAIL="${ADMIN_EMAIL:-shinnosuke.kobayashi@weeave.com}"
WP_PATH=/var/www/wordpress
BUNDLE=/tmp/kb-bundle

export DEBIAN_FRONTEND=noninteractive

echo "=== 1/7 パッケージ導入 ==="
apt-get update -qq
apt-get install -y -qq apache2 mariadb-server unzip curl \
  php php-mysql libapache2-mod-php php-gd php-xml php-mbstring php-curl php-zip php-intl > /dev/null

echo "=== 2/7 DB作成 ==="
DB_PASS=$(openssl rand -hex 16)
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS wordpress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'wp'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON wordpress.* TO 'wp'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "=== 3/7 WP-CLI・WordPress本体 ==="
curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp

mkdir -p "$WP_PATH" && cd "$WP_PATH"
wp core download --locale=ja --allow-root --quiet
wp config create --dbname=wordpress --dbuser=wp --dbpass="$DB_PASS" --locale=ja --allow-root --quiet

ADMIN_PASS=$(openssl rand -base64 18)
wp core install --url="http://${DOMAIN}" --title="小林慎之助" \
  --admin_user=kobayashi --admin_password="$ADMIN_PASS" --admin_email="$ADMIN_EMAIL" \
  --skip-email --allow-root
umask 077
cat > /root/wp-credentials.txt <<CRED
WordPress管理者
  URL:  https://${DOMAIN}/wp-admin/
  user: kobayashi
  pass: ${ADMIN_PASS}
DB
  db: wordpress / user: wp / pass: ${DB_PASS}
CRED
echo "認証情報を /root/wp-credentials.txt に保存しました"

echo "=== 4/7 プラグイン導入 ==="
wp plugin install advanced-custom-fields contact-form-7 seo-simple-pack \
  wp-multibyte-patch xml-sitemap-feed ewww-image-optimizer siteguard backwpup \
  --activate --allow-root --quiet
wp plugin delete hello akismet --allow-root --quiet || true

echo "=== 5/7 テーマ導入 ==="
unzip -qo "$BUNDLE/kobayashi-theme.zip" -d "$WP_PATH/wp-content/themes/"
wp theme activate kobayashi-theme --allow-root

echo "=== 6/7 コンテンツ投入 ==="
cp "$BUNDLE/Shinnosuke_Face.png" "$BUNDLE/seed-content.php" /tmp/
wp eval-file /tmp/seed-content.php --allow-root
wp rewrite structure '/%postname%/' --allow-root
wp rewrite flush --allow-root
# wp-cliの--hardは追加設定なしでは.htaccessを書けないため明示的に生成する
cat > "$WP_PATH/.htaccess" <<'HTACCESS'
# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress
HTACCESS
rm -f /tmp/seed-content.php /tmp/Shinnosuke_Face.png

echo "=== 7/7 Apache設定 ==="
cat > /etc/apache2/sites-available/wordpress.conf <<VHOST
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}
    ServerAdmin ${ADMIN_EMAIL}
    DocumentRoot ${WP_PATH}
    <Directory ${WP_PATH}>
        AllowOverride All
        Require all granted
    </Directory>
    ErrorLog \${APACHE_LOG_DIR}/wordpress-error.log
    CustomLog \${APACHE_LOG_DIR}/wordpress-access.log combined
</VirtualHost>
VHOST
a2enmod rewrite > /dev/null
a2dissite 000-default > /dev/null
a2ensite wordpress > /dev/null
chown -R www-data:www-data "$WP_PATH"
systemctl reload apache2

echo ""
echo "✅ セットアップ完了。DNSが ${DOMAIN} → このVMのIP を向いたら deploy/gcp-ssl.sh でSSL化してください。"
echo "   管理者パスワード: sudo cat /root/wp-credentials.txt"
