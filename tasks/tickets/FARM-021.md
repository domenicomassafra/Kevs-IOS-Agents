# FARM-021 — Cross-platform video transport bake-off

- Status: **planned-live**
- Date: 2026-09-13

## Objective

Replace the generic Appium screenshot-loop preview only when a measured transport is materially better, without coupling automation correctness to video.

## Candidates

- Android: `scrcpy` video/control transport, keeping Appium/UiAutomator2 as the deterministic automation API.
- iOS Simulator: Baguette H.264/MJPEG/WebSocket streaming and headless farm UX patterns.
- Physical iPhone: existing WDA MJPEG versus the separate qvh/H.264 benchmark already covered by FARM-013.

## Acceptance

- Measure first-frame time, fps, control latency, CPU, bandwidth and automation interference.
- Video failure must not take down scheduling/control.
- Dashboard uses one transport abstraction regardless of selected backend.
- Keep the screenshot-loop fallback for runtimes where no optimized video adapter exists.

