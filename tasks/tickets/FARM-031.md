# FARM-031 — Device inventory hierarchy, density and view controls

Status: source implementation in progress.

## Goal

Make the Overview inventory calm and scannable as the farm grows, without turning it into a second Fleet wall.

## Scope

- Add semantic sorting by status, name, platform/kind and execution host.
- Add persistent Grid / Compact views.
- Tighten card hierarchy: name + status first, runtime/host metadata second, tags/accounts tertiary.
- Make `Open` the primary inventory action and keep `Automate` secondary.
- Move Rename / Disconnect into a compact secondary-actions menu.
- Keep disconnected-device recovery obvious while moving Rename behind the same secondary menu.
- Preserve search/filter/sort/view behavior across HTMX fragment refreshes.

## Acceptance

- Full repository tests + TypeScript green.
- `build:web`, `git diff --check` and gitleaks green.
- Production MiniPC rebuilt to healthy on the exact application commit.
- The actually served Overview page exposes the sort selector, Grid/Compact controls, compact rendering, quiet action menu and stable sorting.
- Any production smoke fixtures are removed before closeout.
