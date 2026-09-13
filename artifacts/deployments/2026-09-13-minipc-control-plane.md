# MiniPC control-plane deployment receipt — 2026-09-13

## Deployed host

- Host: `minipc-ubuntu` / Linux x86_64
- Docker: 29.1.3
- Docker Compose: 5.3.0
- Source branch: `feat/farming-control-plane-v1`
- Production source lineage: `a666806` (distributed topology), `95295f7` (dedicated MiniPC ports), `5de126a` (Linux native-install isolation), `c7004c2` (immutable dashboard assets)

## Runtime proof

- Dedicated PostgreSQL container: healthy.
- Dedicated control-plane container: healthy.
- Database migrations: current.
- Linux control-plane import smoke: `control-plane import OK` during Docker build.
- Container doctor: `sourceReady=true`, `runtimeReady=true`.
- Fastify bind: `127.0.0.1:4050` only.
- PostgreSQL bind: `127.0.0.1:55432` plus the MiniPC Tailscale address, not a wildcard public/LAN bind.
- Tailnet HTTPS: `https://minipc-ubuntu.garibaldi-atlas.ts.net:18443` → `127.0.0.1:4050` through Tailscale Serve.
- Health requested from the Mac over tailnet HTTPS: HTTP 200 with `ok=true`.
- Dashboard requested from the Mac over tailnet HTTPS: HTTP 200 (`Devices · IOS AGENTS`).
- `/api/devices` requested from the Mac: reachable and currently empty because no Mac device worker is installed yet.
- PostgreSQL TCP `55432` requested from the Mac over Tailscale: reachable.
- Mac gateway network smoke: a temporary non-production gateway bound only to the Mac Studio Tailscale address on port `3010`; the MiniPC reached that TCP listener successfully.
- Gateway auth smoke: an unauthenticated HTTP request was rejected with `401`. Production shared-token pairing was not copied by the automation tool and remains a protected deployment step.

## Live issues found and fixed during deployment

1. `node-native-ocr`'s Linux x64 prebuild required GLIBC 2.38 and failed on the stable Bookworm image. The control plane does not execute OCR/iPhone automation, so its image now installs dependencies with lifecycle scripts disabled and smoke-imports the actual API server.
2. The initial container attempted `npm run web`, whose `preweb` rebuilt dashboard assets as the unprivileged runtime UID and failed on the immutable application tree. Dashboard assets are now built into the image and runtime starts the server directly.
3. Existing MiniPC services already occupied Tailscale port 3000 and local PostgreSQL 5432. Phone Farm uses dedicated ports 4050, 55432 and tailnet HTTPS 18443 without disturbing existing CreatorOS/Buzz containers.

## Remaining physical-device proof

The current Mac Studio is reachable over Tailscale and the gateway network/auth boundary has been smoke-tested, but at this checkpoint it has no full `Xcode.app` selected (only CommandLineTools) and no `devices.json` exists in the searched project/checkouts. Therefore Appium/XCUITest/WDA signing and the physical-iPhone acceptance receipt remain intentionally unclaimed. Production pairing still requires applying the worker/internal tokens to the Mac after full Xcode/signing is ready.
