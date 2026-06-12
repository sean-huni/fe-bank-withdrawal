#!/usr/bin/env bash
#
# setup-env.sh — idempotent macOS/zsh-friendly toolchain bootstrap.
#
# Installs the latest Node LTS via nvm, stabilises npm/corepack, pins the
# resolved Node version into .nvmrc, installs project deps and Playwright's
# chromium. Safe to re-run.
#
set -euo pipefail

# Resolve the project root (parent of this scripts/ directory) so the script
# works regardless of the caller's CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "==> Bootstrapping toolchain in ${PROJECT_ROOT}"

# --- 1. Ensure a Node version manager (nvm) ------------------------------------
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ ! -s "${NVM_DIR}/nvm.sh" ]; then
  echo "==> nvm not found — installing via the official installer"
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
else
  echo "==> nvm already present at ${NVM_DIR}"
fi

# Source nvm into the current shell (the installer does not affect this process).
# shellcheck disable=SC1091
. "${NVM_DIR}/nvm.sh"

# --- 2. Install + select the latest Node LTS -----------------------------------
echo "==> Installing the latest Node LTS"
nvm install --lts
nvm use --lts
nvm alias default 'lts/*'

# --- 3. Stabilise the package toolchain ----------------------------------------
echo "==> Enabling corepack and updating npm"
corepack enable || true
npm install -g npm@latest

# --- 4. Pin the resolved Node version for reproducibility ----------------------
NODE_VERSION="$(node -v)"          # e.g. v22.14.0
NODE_VERSION="${NODE_VERSION#v}"   # strip leading 'v' -> 22.14.0
echo "==> Pinning Node ${NODE_VERSION} into .nvmrc"
echo "${NODE_VERSION}" > .nvmrc

# --- 5. Install project dependencies -------------------------------------------
if [ -f package-lock.json ]; then
  echo "==> Installing dependencies with npm ci"
  npm ci
else
  echo "==> Installing dependencies with npm install"
  npm install
fi

# --- 6. Install Playwright's chromium (best effort) ----------------------------
echo "==> Installing Playwright chromium (best effort)"
npx playwright install chromium || echo "!! Playwright chromium install failed — continuing"

# --- 7. Summary ----------------------------------------------------------------
echo ""
echo "==> Setup complete"
echo "    node: $(node -v)"
echo "    npm:  $(npm -v)"
echo "    run:  npm run dev"
