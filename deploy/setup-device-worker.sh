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

[[ "${PHONE_FARM_ROLE:-}" == "device-worker" ]] || { echo "PHONE_FARM_ROLE=device-worker is required in .env" >&2; exit 1; }
[[ -n "${PHONE_FARM_DEVICE_WORKER_TOKEN:-}" ]] || { echo "PHONE_FARM_DEVICE_WORKER_TOKEN is required" >&2; exit 1; }
[[ -n "${PHONE_FARM_INTERNAL_TOKEN:-}" ]] || { echo "PHONE_FARM_INTERNAL_TOKEN is required" >&2; exit 1; }
[[ -n "${PHONE_FARM_CONTROL_PLANE_URL:-}" ]] || { echo "PHONE_FARM_CONTROL_PLANE_URL is required" >&2; exit 1; }
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL must point to MiniPC PostgreSQL" >&2; exit 1; }

npm ci
[[ -d .appium2/node_modules/appium-xcuitest-driver ]] || npm run appium:install-driver
npm run db:migrate
npm run doctor:device-worker
npm run service -- install
npm run service -- status

echo "Mac device worker installed. The MiniPC should reference ${PHONE_FARM_WORKER_ID:-mac-worker}=http://<this-mac-private-address>:${DEVICE_WORKER_PORT:-3010}."
