#!/usr/bin/env bash
# On the same Ubuntu host: install Node (if needed), app dependencies, build, then run production
# Next.js in a detached GNU screen session.
#
# Usage (from repo clone):
#   bash scripts/run-app-screen-ubuntu.sh
#
# Prerequisites: MongoDB reachable (e.g. after scripts/install-mongodb-ubuntu.sh) and
#   MONGODB_URI set for production: export in the shell, or in `.env.production` or `.env.local`
#   (uncommented); see `config/.env.production.example`.
#
# Environment:
#   SCREEN_NAME   screen session name (default: app)
#   NODE_MAJOR    Node major version for NodeSource (default: 22)
#   SKIP_APT      set to 1 to skip apt installs (screen, curl, etc.)
#   SKIP_SWAP     set to 1 to skip creating/activating a swap file (not recommended on 512MB–1GB RAM)
#   SWAPFILE_MB   size of /swapfile when auto-added (default: 2048)
#   BUILD_MAX_OLD_SPACE_MB  V8 heap cap during `next build` / TypeScript (default: 3072; needs swap on small VPS)

set -euo pipefail

SCREEN_NAME="${SCREEN_NAME:-app}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SWAPFILE_MB="${SWAPFILE_MB:-2048}"
BUILD_MAX_OLD_SPACE_MB="${BUILD_MAX_OLD_SPACE_MB:-3072}"
# Skip auto-swap when RAM+swap is at least this (~1.75GB default); below that, npm/next often need swap on small droplets.
MIN_TOTAL_MEM_KB="${MIN_TOTAL_MEM_KB:-1800000}"

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

ensure_swap_for_build() {
  if [[ "${SKIP_SWAP:-0}" == "1" ]]; then
    echo "SKIP_SWAP=1: not modifying swap. On small droplets, npm ci / next build may be killed (OOM)."
    return 0
  fi
  local mem_kb swap_kb total_kb
  mem_kb=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
  swap_kb=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)
  total_kb=$((mem_kb + swap_kb))
  if [[ "${total_kb}" -ge "${MIN_TOTAL_MEM_KB}" ]]; then
    echo "Memory+swap ~$((total_kb / 1024))MB — skipping auto swap."
    return 0
  fi
  echo "Low RAM+swap (~$((total_kb / 1024))MB). Adding/using ${SWAPFILE_MB}MB swap file to avoid OOM during install/build..."
  if ${SUDO} swapon --show 2>/dev/null | grep -q '^/swapfile '; then
    echo "/swapfile already active."
    return 0
  fi
  if [[ -f /swapfile ]]; then
    ${SUDO} swapon /swapfile 2>/dev/null && {
      echo "Activated existing /swapfile."
      return 0
    }
    echo "Existing /swapfile could not be enabled; remove or fix it manually, then re-run." >&2
    return 1
  fi
  ${SUDO} fallocate -l "${SWAPFILE_MB}M" /swapfile 2>/dev/null ||
    ${SUDO} dd if=/dev/zero of=/swapfile bs=1M count="${SWAPFILE_MB}" status=none conv=fsync
  ${SUDO} chmod 600 /swapfile
  ${SUDO} mkswap /swapfile
  ${SUDO} swapon /swapfile
  if ! ${SUDO} grep -qE '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab 2>/dev/null; then
    echo '/swapfile none swap sw 0 0' | ${SUDO} tee -a /etc/fstab >/dev/null
  fi
  echo "Swap enabled:"
  ${SUDO} swapon --show || true
}

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

mongouri_configured() {
  if [[ -n "${MONGODB_URI:-}" ]]; then
    return 0
  fi
  for f in .env.production.local .env.production .env.local; do
    [[ -f "$f" ]] || continue
    if grep -qE '^[[:space:]]*MONGODB_URI=.' "$f" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

if ! mongouri_configured; then
  echo "MONGODB_URI is not set. Production requires a real MongoDB connection string." >&2
  echo "Create a file in ${REPO_ROOT} (or export MONGODB_URI in your shell), e.g.:" >&2
  echo "  cp config/.env.production.example .env.production" >&2
  echo "  nano .env.production   # set MONGODB_URI=..." >&2
  echo "Or see config/.env.example for local .env.local." >&2
  exit 1
fi

ensure_swap_for_build

# Do not set NODE_ENV=production before npm ci / next build: npm would skip
# devDependencies, but Tailwind/PostCSS/TypeScript live there and are required to build.
# Smaller spikes during install (helps weak VPS; swap above is the main fix).
export npm_config_maxsockets="${npm_config_maxsockets:-1}"
export npm_config_audit="${npm_config_audit:-false}"
export npm_config_fund="${npm_config_fund:-false}"

npm ci
# Next's TypeScript step can exceed default ~512MiB heap on large apps; raise limit (swap backs it on tiny droplets).
NODE_OPTIONS="--max-old-space-size=${BUILD_MAX_OLD_SPACE_MB}${NODE_OPTIONS:+ ${NODE_OPTIONS}}" npm run build

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
