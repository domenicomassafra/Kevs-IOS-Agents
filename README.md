# Phone Farm iOS — canonical control plane

This repository is the **single canonical control plane** for the Farming / Farm Account / Phone Farm project. It is iPhone/iOS-only.

## Authority

- Canonical Mac working source: `/Users/domenico/Code/Kevs-IOS-Agents`, branch `main`.
- Canonical MiniPC checkout: `/home/udodo/farming/Kevs-IOS-Agents`, branch `main`.
- Canonical remote: `origin` → `domenicomassafra/Kevs-IOS-Agents`.
- Source ancestry remote: `upstream` → `kevinbadi/Kevs-IOS-Agents`.
- `Git-Agni/prod-FARM-IOS-Core` is ancestry only: its `main` diverged at `bec4331` and contains three old README-only commits not carried into the canonical product line.
- `origin/main` is the release line. `upstream/main` is retained only for ancestry/upstream review; neither upstream nor Git-Agni is a second control plane.
- No Android runtime, ADB, UiAutomator2, Android Emulator, scrcpy control path, second scheduler or second device registry belongs in this product.

## Runtime map

```text
Kevs-IOS-Agents/main
        ↓
MiniPC / Linux / Docker control plane + PostgreSQL
        ↓
authenticated macOS device worker (transport only)
        ↓
physical iPhone via WDA   OR   iOS Simulator via Appium/XCUITest
        ↓
Hermes stock client → Phone Farm API (no Hermes fork, WDA owner or scheduler)
```

The MiniPC owns the API, scheduler, registry view, database and orchestration. A macOS worker is required for Apple's physical-device/Xcode transport; that worker is not a competing control plane.

## Supported device lanes

| Target | Transport | Owner |
| --- | --- | --- |
| Physical iPhone | WDA + MJPEG | macOS device worker, supervised by Phone Farm |
| iOS Simulator | Appium + XCUITest | macOS device worker |

`devices.json` is local runtime state and may contain device-specific configuration. `.env*`, Apple signing material, pairing records and local WDA/Appium state must never be removed as generic cleanup without first proving they are non-authoritative or reproducible.

## MiniPC production

The production control plane runs with Docker Compose on Linux. From a clean checkout:

```bash
cp .env.minipc.example .env.minipc   # first install only; keep secrets local
./deploy/setup-minipc.sh
```

The deployment script installs/builds the compose stack, waits for PostgreSQL and the API, and runs the control-plane doctor. The MiniPC deliberately does not pretend to own Apple USB/Xcode transport; configure authenticated macOS workers with `PHONE_FARM_DEVICE_WORKERS` and the shared worker/internal tokens.

Useful verification:

```bash
npm ci
npm run check
npm run doctor:control-plane
docker compose --env-file .env.minipc -f docker-compose.production.yml ps
curl -fsS http://127.0.0.1:4050/health   # .env.minipc.example default
```

## macOS iPhone worker

Prepare a worker only on a Mac with full Xcode selected:

```bash
cp .env.device-worker.example .env           # first install only
./deploy/setup-device-worker.sh
npm run doctor:device-worker
```

Physical iPhone registration stays on the guided WDA path. iOS Simulator discovery/boot/attach stays on the Appium/XCUITest path. Set `PHONE_FARM_ENABLE_PHYSICAL_IOS=false` for a simulator-only worker; the worker then omits physical discovery and physical-lane launch agents. The worker exposes one authenticated worker API back to the MiniPC; it does not run a second scheduler or product database.

The control plane and device worker use a versioned handshake. Run workers from the same released `main` line: stale, mismatched or non-iOS workers are kept offline/degraded and their advertised devices are never imported into the canonical registry. If two workers advertise the same UDID, that device is quarantined until ownership is unambiguous.

## Hermes contract

Hermes remains stock. `integrations/hermes/SKILL.md` is only a thin client contract over the Phone Farm API. It must never start WebDriverAgent, Appium, a second device registry or another scheduler. The Phone Farm scheduler has final ownership of device conflicts and can reject interactive actions while automation is running.

## Donor policy

External projects are not cloned control planes. The only approved donor/reference families are:

| Donor | Allowed role |
| --- | --- |
| `mobctl` | component/reference only |
| `OpenMob` | component/reference only |
| `device-farm-ios` | component/reference only |
| `pymobiledevice3` | dependency/component/reference only |

A donor must be one of: an explicit dependency, a documented reference, or code actually integrated under this repository's ownership/licensing. Otherwise the clone is removed. No donor owns scheduling, device state or deployment.

## Repository map

- `src/api/` — canonical control-plane API/dashboard routes.
- `src/scheduler/` — single scheduler/queue authority.
- `src/devices/` — iPhone/iOS Simulator discovery, WDA/Appium control and registration.
- `src/device-worker-server.ts` / `src/device-workers.ts` — authenticated transport workers.
- `src/agent/` — narrow API clients/adapters used by Hermes/MCP-style consumers.
- `integrations/hermes/SKILL.md` — stock-Hermes invocation contract.
- `deploy/` + `docker-compose.production.yml` — MiniPC and worker release seams.
- `docs/` — technical reference only; this README is the sole operational/status authority.

## Development and acceptance

Before merging to `main`:

```bash
npm run check
npm run build:web
git status --short
git worktree list
git stash list
```

Release acceptance additionally requires the exact `main` SHA on the MiniPC, a healthy Docker control plane, and—when an iPhone is reachable—an innocuous discovery/connection/read-only control proof. Never infer live-device success from unit tests.

## Safety boundary

This project automates only owner-configured iPhones/accounts. It must not create accounts, discover credentials, bypass CAPTCHA/login/platform enforcement, or turn donor code/Hermes into a hidden second authority. Public/high-impact actions stay behind the existing policy and confirmation gates.
