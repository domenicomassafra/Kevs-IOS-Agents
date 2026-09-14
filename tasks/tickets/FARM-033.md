# FARM-033 — Single-device workspace hierarchy and resilient preview

Status: source implementation in progress.

## Goal

Bring the Open-device workspace up to the same black/graphite/white interaction hierarchy as Overview and Device List without changing device-control authority.

## Scope

- Status-first device summary with runtime/backend/tags and enabled state.
- Local command bar: reconnect, enable/disable, tasks/runs, grouped management actions.
- Live stream controls separated from device lifecycle actions.
- Automatic live-stream → still-screenshot fallback and explicit still refresh.
- Group system controls and reduce visible action noise.
- Capability-gate WDA/iPhone-only configuration on Appium runtimes.
- Keep queue clear / stop controls inside the Tasks & runs workspace.
- Preserve the physical-iPhone WDA Add Device acceptance as live-gated until full Xcode + a real iPhone are available.

## Acceptance

- Full source gate passes.
- MiniPC rebuild is healthy on the exact application commit.
- Production browser proof covers an Appium fixture and a WDA fixture, capability gating, lifecycle controls and live→still fallback.
- All fixtures/browser profiles/temp files are removed before closeout.
