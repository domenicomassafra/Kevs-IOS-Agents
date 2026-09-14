#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "setup-device-worker.sh must run on the macOS host physically attached to the iPhones." >&2
  exit 1
fi

if ! xcode-select -p 2>/dev/null | grep -q '/Xcode.app/Contents/Developer$'; then
  echo "Full Xcode must be installed and selected before this host can become a device worker." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.device-worker.example .env
  chmod 600 .env
  echo "Created .env from .env.device-worker.example. Configure MiniPC DATABASE_URL/URL/tokens, then rerun." >&2
  exit 2
fi

set -a
source .env
set +a

require_configured() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" || "$value" == *replace-* || "$value" == *CHANGE_ME* ]]; then
    echo "$name must be configured with a real value in .env" >&2
    exit 1
  fi
}

[[ "${PHONE_FARM_ROLE:-}" == "device-worker" ]] || { echo "PHONE_FARM_ROLE=device-worker is required in .env" >&2; exit 1; }
require_configured PHONE_FARM_DEVICE_WORKER_TOKEN "${PHONE_FARM_DEVICE_WORKER_TOKEN:-}"
require_configured PHONE_FARM_INTERNAL_TOKEN "${PHONE_FARM_INTERNAL_TOKEN:-}"
require_configured PHONE_FARM_CONTROL_PLANE_URL "${PHONE_FARM_CONTROL_PLANE_URL:-}"
require_configured DATABASE_URL "${DATABASE_URL:-}"
require_configured XCODE_ORG_ID "${XCODE_ORG_ID:-}"
if [[ "${WDA_BUNDLE_ID:-}" == "com.example.WebDriverAgentRunner" || -z "${WDA_BUNDLE_ID:-}" ]]; then
  echo "WDA_BUNDLE_ID must be changed from the example value before installation" >&2
  exit 1
fi

npm ci
[[ -d .appium2/node_modules/appium-xcuitest-driver ]] || npm run appium:install-driver
[[ -d .appium-runtime/node_modules/appium-xcuitest-driver ]] || npm run appium:runtime:install-ios
npm run db:migrate
npm run doctor:device-worker
npm run service -- install
npm run service -- status

echo "Mac device worker installed. The MiniPC should reference ${PHONE_FARM_WORKER_ID:-mac-worker}=http://<this-mac-private-address>:${DEVICE_WORKER_PORT:-3010}."
