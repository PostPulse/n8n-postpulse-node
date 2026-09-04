# Competed Tasks

## 2026-09-04

- [x] **001 — `scheduledTime` ignores the workflow timezone** (bug, high) —
  [plan](./plan/001-scheduled-time-workflow-timezone.md)
  `new Date(str).toISOString()` in `PostResource.ts` interpreted a naive
  date-time in the *n8n server's* timezone instead of the workflow timezone —
  a regression from 0.2.5, where the luxon-based handling was removed without
  a native replacement. Confirmed on a live run (workflow timezone
  `America/New_York`, 09:00 → sent as `06:00Z` instead of `13:00Z`).
  Fixed with a new `helpers/DateHelper.ts` → `toUtcIsoInTimezone()`, built on
  native `Intl` only (no new runtime dependency), DST-aware via a two-pass
  offset resolution; used by both `schedulePost` and `schedulePostLight`,
  with `NodeOperationError` + `{ itemIndex }` on an unparseable value.
  Verified across timezones, both 2026 `Europe/Berlin` DST switches, a
  half-hour-offset zone, and then on a live n8n run.

