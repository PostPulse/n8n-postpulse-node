# Backlog

## Planned

Findings from the 2026-09-02 codebase analysis. Not yet started; details in
[`./plan/`](./plan/).

- [x] **001 — `scheduledTime` ignores the workflow timezone** (bug, high) — *done 2026-09-04* —
  [plan](./plan/001-scheduled-time-workflow-timezone.md)
  `new Date(str).toISOString()` in `PostResource.ts:31,86` interprets a naive
  date-time in the *server's* timezone. The workflow-timezone handling added
  in 0.2.2 was dropped in 0.2.5 together with luxon and never reimplemented,
  so the node contradicts its own UI notice and README. Must be fixed with
  native `Intl` — no new runtime dependency.
- [ ] **002 — Remove dead `makeApiRequestWithFormData`** (cleanup, low) —
  [plan](./plan/002-remove-unused-form-data-helper.md)
  Unused since the presigned-URL upload flow landed in 0.1.9; does not follow
  the current `NodeApiError` convention.

Suggested order: 001 first (user-visible bug), 002 can ride along in the same
release.
