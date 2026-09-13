# FARM-018 — Linux MiniPC control plane + macOS physical-device workers

- Status: **blocked-live**
- Date: 2026-09-13

## Objective

Make the Linux MiniPC the authoritative always-on production runtime while keeping Xcode/Appium/WDA and physical USB iPhones on macOS execution nodes. The farm must remain operable from another computer through the dashboard/API/agent surfaces.

## Acceptance / proof

- Linux production Docker Compose for control plane + PostgreSQL with persistent storage and restart policy.
- Role-aware doctor: Linux must not require Xcode; macOS device workers must require Xcode/iPhone and the MiniPC database.
- Authenticated Mac device-worker gateway for inventory, screenshots, accessibility, MJPEG, input, connection health and reconnect.
- WDA/Appium remain local to the Mac rather than being exposed directly to the MiniPC or public network.
- Device/account/policy configuration mirrors from the canonical MiniPC registry to the owning Mac without propagating passcodes.
- Mac execution workers claim only their locally registered iPhone queues from the shared MiniPC PostgreSQL/pg-boss database.
- Canonical uploaded media can be fetched by a Mac worker over an internal authenticated route and is verified by byte size + SHA-256 before use.
- Browser/Hermes/MCP can continue to use the MiniPC API while the actual phone is controlled by the Mac worker.
- Final live receipt on actual MiniPC + Mac + physical iPhone.

## Current state

The source implementation is complete: `Dockerfile.control-plane`, `docker-compose.production.yml`, `.env.minipc.example`, `.env.device-worker.example`, `deploy/setup-minipc.sh`, `deploy/setup-device-worker.sh`, the remote worker client/fleet, Mac gateway, role-aware launchd selection, role-aware doctor, configuration sync and verified media transfer are implemented. The control plane tolerates offline workers and retains canonical mutations for later resynchronization. Remote stream capabilities are forced on in the recommended MiniPC deployment even though the Fastify process itself remains loopback-bound behind the private access layer.

The ticket remains `blocked-live` only because this checkout cannot prove the actual Linux MiniPC Docker runtime, Mac Xcode signing/WDA, private network route and physical iPhone in one end-to-end execution. That proof must not be inferred from source tests.
