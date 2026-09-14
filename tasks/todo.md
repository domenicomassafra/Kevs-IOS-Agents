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
- [x] FARM-020 semantic v2: accessibility-first tap/wait/assert/input/gone steps in the portable flow builder.
- [x] FARM-019 virtual lifecycle: host-level inventory plus Boot/Stop for iOS Simulators and Android AVDs.
- [x] FARM-021 UI tranche: real `/fleet` device wall with cheap previews and one focused live stream; old 20-seat mock removed.
- [x] FARM-020 Flow Library: canonical PostgreSQL persistence, immutable versions, duplicate/restore/delete and Mobile Farm JSON import/export.
- [x] FARM-020 Maestro bridge: bounded/lossless YAML import/export subset over the same scheduler contract.
- [x] FARM-021 Fleet operations: host/platform/kind grouping, multi-select and safe reconnect/enable/disable/clear-queue bulk actions.
- [x] FARM-021 scrcpy source adapter: optional version-matched Android raw-H.264 path wired through signed stream capabilities and the benchmark harness.
- [x] FARM-022 capability-aware allocation: preview + least-loaded online/idle device selection above the existing scheduler.
- [x] FARM-022 Flow Studio scheduling: now/once/daily/weekly/interval plus immutable saved-flow revision attribution.
- [x] FARM-022 Semantic Inspector: live accessibility elements → tap/wait/assert/input authoring without hand-entering selectors.
- [x] FARM-023 device tags + named PostgreSQL allocation pools + Fleet search/pool authoring.
- [x] FARM-023 execution-host observability: configured offline workers remain visible; online workers report bounded load/RAM/CPU/uptime telemetry.
- [x] FARM-029 Add Device operational onboarding: live host/runtime/iPhone status, explicit Appium 3 vs WDA lanes, browser-proven scan → attach.
- [x] FARM-030 Device inventory command bar: searchable/filterable Overview list, shown/total counts and HTMX-stable filters.
- [x] FARM-031 Device inventory hierarchy/density: semantic sorting, Grid/Compact views and quieter secondary actions; MiniPC/browser live proof complete.
- [x] FARM-032 Automation Studio hierarchy: Target → Flow → Schedule → Run, grouped secondary actions and reduced visual noise; MiniPC/browser live proof complete.
- [x] FARM-033 Single-device workspace: status-first hierarchy, resilient live/still preview, grouped lifecycle actions and runtime capability gating; MiniPC/browser live proof complete.
- [x] FARM-034 Runs workspace: recent-run hierarchy, device/flow/status filters, explicit refresh, readable evidence/log details and contextual links; MiniPC/browser live proof complete.
- [ ] FARM-035 Fleet wall: grouped still previews, one focused live stream, explicit connectivity filters and safe confirmed bulk operations.
- [x] FARM-024 Control Center UX convergence: actionable Overview, staged Automation Studio, Fleet state, cross-platform Runs and corrected saved-pool editing.
- [x] FARM-025 Runs operations: visual schedule editing plus execution detail/log inspection without raw JSON prompts.
- [x] FARM-026 Connected actions: Overview device tags + direct Automate links and prompt-free Flow Library duplication.
- [x] FARM-027 Prompt-free device naming and pure HTMX device fragments.
- [x] FARM-028 Inline operational feedback; no browser alerts for ordinary action failures.
- [x] Current source regression gate: `npm run check` => 127/127 tests + TypeScript green (2026-09-14).

## Live-gated

- [x] FARM-018 MiniPC half: production Compose deployed on actual `minipc-ubuntu`; DB/control plane healthy; tailnet dashboard/API and DB reachability proven; Mac gateway TCP + unauthenticated rejection smoke proven.
- [ ] FARM-013 Video benchmark: harness implemented; measurements require a physical iPhone and optional qvh endpoint.
- [ ] FARM-015 launchd production supervision: generators/lifecycle implemented and plist syntax validated; install/restart proof waits for a live-ready host.
- [ ] FARM-016 Physical-iPhone end-to-end acceptance: receipt-producing harness implemented; execution waits for full Xcode + PostgreSQL + physical iPhone.
- [ ] FARM-017 Dependency remediation: triaged; current advisories require an Appium/Webdriver compatibility move that must be live-regression-tested rather than force-applied.
- [ ] FARM-018 device half: production secret pairing + Mac worker launchd + signed WDA/iPhone acceptance after full Xcode and device registration exist.
- [ ] FARM-019 live runtime matrix: iOS Simulator + Android emulator + physical Android + distributed proxy receipt.
- [ ] FARM-021 Cross-platform video bake-off: scrcpy adapter is implemented; live Android measurements + Baguette/qvh comparison remain pending.
- [ ] FARM-022 live allocator/inspector proof across at least two matching runtimes after the device-worker matrix is online.
- [ ] FARM-023 live tag/pool allocation proof across at least two matching tagged runtimes after the worker matrix is online.

## Git closeout

- [x] Review FARM-018 diff for generated/runtime artifacts and secrets.
- [x] Commit FARM-018 on `feat/farming-control-plane-v1`.
- [x] Push updated branch to `origin`.
- [x] Merge the completed control-plane feature branch to `main`, push `origin/main`, then delete the merged feature branch/worktree debris.
