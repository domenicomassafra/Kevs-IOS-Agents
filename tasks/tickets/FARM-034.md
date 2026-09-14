# FARM-034 — Runs workspace hierarchy and evidence UX

Status: source implementation in progress.

## Goal

Bring Runs to the same operational hierarchy as Overview, Device List, Automation Studio and the device workspace without changing scheduler semantics.

## Scope

- Recent execution history is the primary surface; schedules are secondary.
- Dedicated search plus Device, Flow and Status filters.
- Explicit live-refresh control, manual refresh and last-updated feedback.
- Run-level status summary for recent, in-flight, succeeded and attention-needed executions.
- Readable run cards with device/flow context and bounded error preview.
- Execution details expose status, run id, device, schedule, timestamps, exit code, error and evidence logs.
- Exact device links and exact saved-flow source links when `sourceFlowId` exists.
- Black / graphite / white presentation consistent with the other converged surfaces.
- Preserve all existing stop/retry/schedule-edit safety behavior.

## Acceptance

- Full source gate: 127+ tests, TypeScript, `build:web`, `git diff --check`, gitleaks.
- MiniPC rebuild completes and control-plane/PostgreSQL are healthy; `/health` and doctor are green.
- Production browser acceptance proves filtering and a populated execution detail against temporary fixtures, followed by complete cleanup.
- Physical-iPhone WDA Add Device acceptance remains live-gated and is not claimed by this ticket.
