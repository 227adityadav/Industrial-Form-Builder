#!/usr/bin/env bash
# On the same Ubuntu host: install Node (if needed), app dependencies, build, then run production
# Next.js in a detached GNU screen session.
#
# Usage (from repo clone):
#   bash scripts/run-app-screen-ubuntu.sh
#
# Prerequisites: MongoDB reachable (e.g. after scripts/install-mongodb-ubuntu.sh) and
#   project root `.env.local` with at least MONGODB_URI=... (copy from config/.env.example).
#
# Environment:
#   SCREEN_NAME   screen session name (default: app)
#   NODE_MAJOR    Node major version for NodeSource (default: 22)
#   SKIP_APT      set to 1 to skip apt installs (screen, curl, etc.)

set -euo pipefail

SCREEN_NAME="${SCREEN_NAME:-app}"
NODE_MAJOR="${NODE_MAJOR:-22}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

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

run_nodesource_setup() {
  local url="https://deb.nodesource.com/setup_${NODE_MAJOR}.x"
  if [[ -n "${SUDO}" ]]; then
    curl -fsSL "${url}" | ${SUDO} -E bash -
  else
    curl -fsSL "${url}" | bash -
  fi
}

need_sudo

if [[ "${SKIP_APT:-0}" != "1" ]]; then
  ${SUDO} apt-get update
  ${SUDO} apt-get install -y ca-certificates curl screen git
fi

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" 2>/dev/null; then
  echo "Installing Node.js ${NODE_MAJOR}.x via NodeSource..."
  run_nodesource_setup
  ${SUDO} apt-get install -y nodejs
fi

command -v npm >/dev/null 2>&1 || {
  echo "npm not found after Node install." >&2
  exit 1
}

cd "${REPO_ROOT}"

if [[ ! -f package.json ]]; then
  echo "No package.json in ${REPO_ROOT}. Clone the repo and run from the project root." >&2
  exit 1
fi

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local in ${REPO_ROOT}." >&2
  echo "Create it with at least MONGODB_URI (see config/.env.example). Example:" >&2
  echo "  cp config/.env.example .env.local && nano .env.local" >&2
  exit 1
fi

export NODE_ENV=production

npm ci
npm run build

screen -wipe >/dev/null 2>&1 || true
if screen -list 2>/dev/null | grep -qE "[[:digit:]]+\\.${SCREEN_NAME}[[:space:]]"; then
  echo "Stopping existing screen session: ${SCREEN_NAME}"
  screen -S "${SCREEN_NAME}" -X quit 2>/dev/null || true
  sleep 1
fi

screen -dmS "${SCREEN_NAME}" bash -lc "cd \"${REPO_ROOT}\" && export NODE_ENV=production && exec npm start"

echo "Started production server in screen session: ${SCREEN_NAME}"
echo "  Attach:    screen -r ${SCREEN_NAME}"
echo "  Detach:    Ctrl+A then D"
echo "  List:      screen -ls"
echo "App listens on http://127.0.0.1:3000 by default (set PORT in .env.local to change; match scripts/setup-nginx-reverse-proxy-ubuntu.sh)."
