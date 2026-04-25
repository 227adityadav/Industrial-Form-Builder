#!/usr/bin/env bash
# Install nginx and reverse-proxy HTTP (port 80) to the Next.js app on localhost.
# After this, visitors can open http://YOUR_SERVER_IP/ if port 80 is open (ufw / cloud firewall).
#
# Usage:
#   sudo bash scripts/setup-nginx-reverse-proxy-ubuntu.sh
#
# Environment:
#   APP_PORT        upstream port where npm start listens (default: 3000)
#   UPSTREAM_HOST   default: 127.0.0.1
#   SERVER_NAME     server_name directive (default: _ catch-all)

set -euo pipefail

APP_PORT="${APP_PORT:-3000}"
UPSTREAM_HOST="${UPSTREAM_HOST:-127.0.0.1}"
SERVER_NAME="${SERVER_NAME:-_}"
SITE_NAME="industrial-form-builder"
CONF_PATH="/etc/nginx/sites-available/${SITE_NAME}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This script is for Linux (Ubuntu) only." >&2
  exit 1
fi

need_sudo() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    SUDO="sudo"
  else
    SUDO=""
  fi
}

need_sudo

${SUDO} apt-get update
${SUDO} apt-get install -y nginx

# map must live in http context (not inside server {}). Used so normal page loads
# do not send Connection: upgrade to Node — that often causes 502 behind nginx.
MAP_CONF="/etc/nginx/conf.d/00-industrial-form-builder-connection-map.conf"
${SUDO} tee "${MAP_CONF}" >/dev/null <<'MAPEOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
MAPEOF

${SUDO} tee "${CONF_PATH}" >/dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SERVER_NAME};

    access_log /var/log/nginx/${SITE_NAME}.access.log;
    error_log /var/log/nginx/${SITE_NAME}.error.log warn;

    client_max_body_size 25m;

    location / {
        proxy_pass http://${UPSTREAM_HOST}:${APP_PORT};
        proxy_http_version 1.1;
        proxy_redirect off;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 86400s;
        proxy_read_timeout 86400s;

        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 8 128k;
        proxy_busy_buffers_size 256k;
    }
}
EOF

# Avoid duplicate default_server: disable packaged default site if present.
if [[ -e /etc/nginx/sites-enabled/default ]]; then
  ${SUDO} rm -f /etc/nginx/sites-enabled/default
fi

${SUDO} ln -sf "${CONF_PATH}" "/etc/nginx/sites-enabled/${SITE_NAME}"

${SUDO} nginx -t
${SUDO} systemctl enable nginx
${SUDO} systemctl reload nginx

echo
echo "nginx is proxying http://0.0.0.0:80 -> http://${UPSTREAM_HOST}:${APP_PORT}"
echo "Ensure the app is running (e.g. bash scripts/run-app-screen-ubuntu.sh) and PORT matches APP_PORT if you use a non-default port."
echo "Quick check: curl -sI http://${UPSTREAM_HOST}:${APP_PORT}/ | head -n1  (expect HTTP/1.1 200 or 307)"
echo "If 502 persists: tail -50 /var/log/nginx/${SITE_NAME}.error.log"
echo "Open port 80 in your firewall (ufw allow 80/tcp) and cloud provider security groups if needed."
