# Task board

## Completed source waves

- [x] FARM-001 Autoplan + research + ADR + 100-question grilling.
- [x] FARM-002 Restore green baseline.
- [x] FARM-003 Truthful host/runtime doctor.
- [x] FARM-004 Canonical account inventory and API.
- [x] FARM-005 Account-target binding validation.
- [x] FARM-006 Account pause/policy.
- [x] FARM-007 Semantic WDA snapshot/stable refs.
- [x] FARM-008 Semantic actions/redacted traces.
- [x] FARM-009 Hermes adapter.
- [x] FARM-010 Generic MCP adapter.
- [x] FARM-011 Campaign/content control plane.
- [x] FARM-012 Health/analytics.
- [x] FARM-014 Signed expiring remote stream/session capabilities.
- [x] FARM-018 Distributed Linux MiniPC control plane + macOS device-worker architecture (source implementation).
- [x] FARM-019 Unified real + virtual iOS/Android runtime layer (source implementation).
- [x] FARM-020 Portable Automation Studio + scheduler-backed flow contract.
- [x] Current source regression gate: `npm run check` => 110/110 tests + TypeScript green (2026-09-13).

## Live-gated

- [x] FARM-018 MiniPC half: production Compose deployed on actual `minipc-ubuntu`; DB/control plane healthy; tailnet dashboard/API and DB reachability proven; Mac gateway TCP + unauthenticated rejection smoke proven.
- [ ] FARM-013 Video benchmark: harness implemented; measurements require a physical iPhone and optional qvh endpoint.
- [ ] FARM-015 launchd production supervision: generators/lifecycle implemented and plist syntax validated; install/restart proof waits for a live-ready host.
- [ ] FARM-016 Physical-iPhone end-to-end acceptance: receipt-producing harness implemented; execution waits for full Xcode + PostgreSQL + physical iPhone.
- [ ] FARM-017 Dependency remediation: triaged; current advisories require an Appium/Webdriver compatibility move that must be live-regression-tested rather than force-applied.
- [ ] FARM-018 device half: production secret pairing + Mac worker launchd + signed WDA/iPhone acceptance after full Xcode and device registration exist.
- [ ] FARM-019 live runtime matrix: iOS Simulator + Android emulator + physical Android + distributed proxy receipt.
- [ ] FARM-021 Cross-platform video bake-off: scrcpy/Baguette versus generic screenshot fallback.

## Git closeout

- [x] Review FARM-018 diff for generated/runtime artifacts and secrets.
- [x] Commit FARM-018 on `feat/farming-control-plane-v1`.
- [x] Push updated branch to `origin`.
