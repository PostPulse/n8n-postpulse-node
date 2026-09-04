# Active Tasks

## In Progress

- [ ] **001 — `scheduledTime` ignores the workflow timezone** (bug, high) —
  [plan](./plan/001-scheduled-time-workflow-timezone.md)
  Code fixed and verified against the compiled helper; awaiting the live n8n
  re-run (subtask 5) before it moves to completed.
  - [x] 1. `helpers/DateHelper.ts` → `toUtcIsoInTimezone()`, native `Intl` only
  - [x] 2. Used in `schedulePost` and `schedulePostLight`
  - [x] 3. `NodeOperationError` + `{ itemIndex }` on an unparseable value
  - [x] 4. DST boundaries (`Europe/Berlin`) and half-hour offset (`Asia/Kolkata`)
  - [x] `npm run lint` + `npm run build`
  - [ ] 5. Manual n8n run with the workflow timezone ≠ the server's
