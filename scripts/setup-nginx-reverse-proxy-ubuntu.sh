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

${SUDO} tee "${CONF_PATH}" >/dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SERVER_NAME};

    client_max_body_size 25m;

    location / {
        proxy_pass http://${UPSTREAM_HOST}:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
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
echo "Open port 80 in your firewall (ufw allow 80/tcp) and cloud provider security groups if needed."
