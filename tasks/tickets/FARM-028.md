# FARM-028 — Inline operational feedback

## Goal

Remove blocking browser alerts from ordinary operational failures while preserving confirmation dialogs for destructive or public actions.

## Shipped

- Runs actions report pending/success/error state through an accessible inline live region instead of `window.alert()`.
- Per-device schedule/execution actions reuse the existing queue-status live region for the same feedback.
- The non-themed fallback renderer reports request failures inline as well.
- Destructive/public `confirm()` gates remain intentionally unchanged.

## Acceptance

- Runs page exposes `runs-action-status` as an `aria-live` region.
- No `window.alert()` / `alert()` remains in dashboard TypeScript or the API-rendered dashboard scripts.
- Full regression/build/diff/secret gates pass before deployment.
