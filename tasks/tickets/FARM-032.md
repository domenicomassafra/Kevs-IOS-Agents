# FARM-032 — Automation Studio workflow hierarchy

Status: source implementation in progress.

## Goal

Make Portable Flow Studio read as one calm operator path instead of a dense wall of equally weighted controls.

## Scope

- Present the primary workflow as Target → Flow → Schedule → Run.
- Remove duplicated capability/promotional chrome from the working surface.
- Keep target selection primary while grouping allocation-pool management as secondary.
- Keep flow name, steps and Save primary; group version/restore/duplicate/export/delete actions behind one secondary surface.
- Separate timing configuration from the final Run/Schedule action.
- Keep Semantic Inspector available but collapsed by default.
- Preserve all existing APIs, IDs, versioning, pool allocation and scheduler behavior.
- Match the existing black / graphite / white Overview and Device List visual system.

## Acceptance

- Full source gate (127+ tests + TypeScript) green.
- `build:web`, `git diff --check` and gitleaks green.
- MiniPC rebuilt from the exact application commit; PostgreSQL/control-plane healthy, `/health` ok and doctor ready.
- Production browser proves the four-stage hierarchy, grouped secondary actions and populated target selector using temporary devices.
- All smoke fixtures and temporary browser/profile artifacts removed before closeout.
