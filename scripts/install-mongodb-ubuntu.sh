#!/usr/bin/env bash
# Install MongoDB Community Edition on Ubuntu (amd64/arm64) using the official MongoDB apt repo.
# Run on the server: bash scripts/install-mongodb-ubuntu.sh
# Requires: sudo, curl, gnupg. Tested on Ubuntu 22.04 (jammy) and 24.04 (noble).

set -euo pipefail

MONGO_SERIES="${MONGO_SERIES:-8.0}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This script is for Linux (Ubuntu) only." >&2
  exit 1
fi

if ! command -v lsb_release >/dev/null 2>&1; then
  echo "lsb_release not found. Install with: sudo apt-get update && sudo apt-get install -y lsb-release" >&2
  exit 1
fi

if [[ "$(lsb_release -is 2>/dev/null)" != "Ubuntu" ]]; then
  echo "This script targets Ubuntu. Detected: $(lsb_release -ds 2>/dev/null || echo unknown)" >&2
  exit 1
fi

CODENAME="${UBUNTU_CODENAME:-$(lsb_release -cs)}"
echo "Using Ubuntu codename: ${CODENAME} (override with UBUNTU_CODENAME=... if needed)"

need_sudo() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    SUDO="sudo"
  else
    SUDO=""
  fi
}

need_sudo
${SUDO} apt-get update
${SUDO} apt-get install -y ca-certificates curl gnupg

KEYRING="/usr/share/keyrings/mongodb-server-${MONGO_SERIES}.gpg"
LIST="/etc/apt/sources.list.d/mongodb-org-${MONGO_SERIES}.list"

if [[ ! -f "${KEYRING}" ]]; then
  curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGO_SERIES}.asc" |
    ${SUDO} gpg --batch -o "${KEYRING}" --dearmor
fi

echo "deb [ arch=amd64,arm64 signed-by=${KEYRING} ] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/${MONGO_SERIES} multiverse" |
  ${SUDO} tee "${LIST}" >/dev/null

${SUDO} apt-get update
${SUDO} apt-get install -y mongodb-org

${SUDO} systemctl enable mongod
${SUDO} systemctl restart mongod
${SUDO} systemctl --no-pager status mongod || true

echo
echo "MongoDB installed and mongod started."
echo "Default connection string for this app:"
echo "  MONGODB_URI=mongodb://127.0.0.1:27017/industrial-form-builder"
echo "Put that in .env.local at the project root (see config/.env.example)."
