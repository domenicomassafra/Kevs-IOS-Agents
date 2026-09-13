# FARM-020 — Portable Automation Studio

- Status: **source-complete**
- Date: 2026-09-13

## Objective

Make general mobile automation a first-class product surface rather than keeping recorded gestures inside one TikTok workflow implementation.

## Implemented

- Built-in `com.phone-farm.flow/flow@1` task contract.
- Bounded portable steps: launch, terminate, wait, tap, swipe, type, Home/lock/wake/unlock/volume and screenshot.
- Same pg-boss scheduling, stop semantics, logs and execution evidence as every other task.
- Browser Automation Studio with device picker, ordered step editor, per-step parameters, reordering/removal and Run now.
- Device page exposes a Portable Flow entry point on every runtime.
- Appium runtimes hide iPhone/WDA-specific social calibration UI instead of pretending those recipes are portable.
- Existing TikTok/Instagram recipes are explicitly rejected on generic Appium runtimes until they are ported semantically.

## Verification

- Flow validation and execution-order tests pass.
- Full repository gate: 110/110 tests + TypeScript green.

## Follow-up

- Add named assertions/waits/selectors to the visual builder using the stable-ref semantic layer.
- Add save/version/duplicate/import/export for user-authored flow definitions.
- Consider a Maestro-compatible import/export adapter rather than replacing the scheduler with Maestro.

