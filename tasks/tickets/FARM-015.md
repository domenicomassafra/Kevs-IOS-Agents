# FARM-015 — launchd production supervision and one-command lifecycle

- Status: **blocked-live**
- Date: 2026-09-13

## Objective

After live acceptance, supervise web/worker/Appium/WDA-service with deterministic startup/shutdown and health checks.

## Acceptance / proof

- launchd units
- start/stop/status command
- restart proof

## Current state

Source work is implemented: four independent LaunchAgents (Appium, WDA service, worker, web) can be rendered, installed, uninstalled and inspected without a shell wrapper. Generated plists are syntax-checked separately. Actual installation/restart proof intentionally remains blocked until the host is live-ready so `KeepAlive` does not create crash loops against missing Xcode/database prerequisites.
