# Plan — best-of-breed iPhone farming control plane

## Architecture decision

Keep the current Kevs/Agni lineage as the fleet and scheduler core. Add a small account/policy control plane inside this TypeScript project. Keep semantic/LLM automation behind adapters instead of importing Ghost, Hermes, DSH or an MCP server wholesale.

### Layer 1 — Fleet core (existing, keep)

Physical iPhone registry, WDA/Appium lifecycle, remote screen/input, PostgreSQL + pg-boss, per-device queues, versioned task contracts, execution logs, plugin loading.

### Layer 2 — Account and policy plane (build here)

Canonical account inventory, account-to-device binding, disabled/paused state, future action policy and health. Task validation must bind an explicit handle to the device before enqueue.

### Layer 3 — Deterministic skills/workflows (existing + extend)

TikTok and Instagram plugins remain deterministic recipes. Known work should not spend LLM tokens or depend on agent availability.

### Layer 4 — Semantic agent bridge (next)

Accessibility tree / stable element refs / text targeting / waits / traces. Hermes-native is the preferred owner-facing adapter; Ghost/MCP remains a generic adapter. The bridge consumes the fleet core rather than owning it.

### Layer 5 — Content/campaign plane (next)

Assets, account targets, calendars, campaigns, review state, safe publish intent, attribution and results.

### Layer 6 — Observability (next)

Per-action traces, screenshots around failures, account/device health, policy refusals, queue latency, workflow success rate.

## Delivery waves

### Wave A — source truth and control-plane foundation (complete)

Done criteria: baseline tests repaired, donor/autoplan artifacts exist, doctor implemented, account inventory/API implemented, account-binding validation implemented, full source suite green.

### Wave B — semantic automation adapter (source complete)

Done criteria: token-efficient WDA accessibility snapshot, stable element refs, find/tap/wait/type primitives, redacted traces, tests with captured fixtures. No LLM dependency in core.

### Wave C — agent integration (source complete)

Done criteria: Hermes adapter proves semantic device control through the shared primitives; optional MCP adapter can expose the same primitives. No duplicated WDA lifecycle.

### Wave D — campaign/account policy (source complete)

Done criteria: account pause/allow-list policy, campaign records, targeting, approval states and immutable execution attribution.

### Wave E — video benchmark (harness complete, live measurement blocked)

`npm run benchmark:video -- --udid <UDID>` now measures a no-stream control baseline, WDA MJPEG, and optionally qvh/H.264 while sampling screenshot/control latency. Keep current MJPEG until physical-device measurements prove lower contention/latency and acceptable reliability.

### Wave F — live acceptance and packaging (source harnesses complete, host blocked)

`npm run acceptance:live -- --udid <UDID>` now produces a receipt for health → screenshot → semantic tree → stream → optional input → optional scheduled task. launchd render/install/uninstall/status support also exists. The remaining proof requires full Xcode selected, Apple signing ready, PostgreSQL available and a physical iPhone attached; services must not be installed merely to create a crash loop on an unready host.
