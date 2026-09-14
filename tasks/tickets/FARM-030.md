# FARM-030 — Device inventory command bar

Status: source implementation in progress.

## Goal

Keep the Overview device inventory usable as the farm grows without duplicating the richer Fleet wall.

## Scope

- Search across device name, UDID, tags, worker, platform/kind and configured account handles.
- Filter by online, offline or disconnected/disabled state.
- Filter by iOS or Android.
- Show a visible shown/total count and one-click reset.
- Preserve filters across HTMX device-fragment refreshes.
- Move Overview rename/connect/disconnect behavior into a dedicated versioned `overview.js` bundle instead of inline page script.
- Surface connect/disconnect failures inline in the command bar.

## Acceptance

- TypeScript and `build:web` green.
- Full source regression gate green.
- `git diff --check` and secret scan green.
- MiniPC rebuilt/healthy with the versioned Overview bundle served in production.
- Live smoke proves filter metadata and command-bar behavior with temporary devices, then removes all fixtures.
