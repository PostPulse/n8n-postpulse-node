# 001 — `scheduledTime` ignores the workflow timezone (regression)

- **Type**: Bug / regression
- **Severity**: High — silently publishes posts at the wrong time
- **Status**: Done 2026-09-04 (verified on a live n8n run)
- **Found**: 2026-09-02, during memory-bank codebase analysis

## Problem

`PostResource.ts:31` (`schedulePost`) and `PostResource.ts:86`
(`schedulePostLight`) convert the user's scheduled time with:

```ts
scheduledTime = new Date(scheduledTimeStr).toISOString()
```

An ISO date-time string **without an offset** (what the n8n `dateTime` picker
produces, e.g. `2026-08-17T14:03:00`) is interpreted by `new Date()` as the
*local time of the n8n server process*. The workflow timezone is never read —
`this.getTimezone()` is not called anywhere in the file.

## Why this is a regression

- `0.2.2` (c3b8b2e) added the feature explicitly: "Interpret scheduled time
  field value using the workflow timezone", implemented with
  `DateTime.fromISO(str, { zone: this.getTimezone() }).toUTC().toISO()`.
- `0.2.5` (21feac1) removed the `luxon` dependency to satisfy the n8n
  "no runtime dependencies" rule. The commit message claims the offset is now
  attached "with native Intl APIs", but the replacement code does **not** do
  that — the timezone handling was dropped, not ported.

## Impact

The node currently contradicts its own documented behaviour in two places:

- the UI `notice` fields `timezoneNotice` (`PostPulse.node.ts:338` and `:507`):
  "Scheduled Time is interpreted using the Workflow Timezone";
- the `scheduledTime` field descriptions and `README.md`.

Any n8n instance whose server timezone differs from the workflow timezone
schedules posts at the wrong moment, with no error.

## Constraints

- **No new runtime dependency.** Luxon cannot come back — `dependencies` must
  stay empty (see steerings). Use native `Intl.DateTimeFormat` with
  `timeZone` + `timeZoneName: 'longOffset'`, or the `formatToParts` /
  UTC-difference technique, to resolve the offset for the target zone *at the
  given instant* (DST matters — a fixed offset is wrong half the year).
- Read the zone from `this.getTimezone()`.
- `scheduleMode: 'now'` must keep omitting `scheduledTime` entirely.
- Input may already carry an explicit offset or `Z` (an expression can feed
  the field). In that case respect the given offset instead of re-interpreting
  it in the workflow zone.

## Subtasks

1. Write a helper (e.g. `helpers/DateHelper.ts` →
   `toUtcIsoInTimezone(value: string, timezone: string): string`) that:
   - returns the value converted to UTC ISO when it already has an offset/`Z`;
   - otherwise interprets the naive local date-time in `timezone`, DST-aware,
     using native `Intl` only.
2. Use it in both `schedulePost` and `schedulePostLight`; drop the bare
   `new Date(...).toISOString()` calls (also add the missing semicolons).
3. Handle an unparseable value with `NodeOperationError` + `{ itemIndex }`
   instead of emitting `Invalid Date` / throwing a raw `RangeError`.
4. Verify against DST boundaries in a zone with DST (e.g.
   `Europe/Berlin` around the March/October switch) and in a half-hour-offset
   zone (e.g. `Asia/Kolkata`).
5. `npm run lint` + `npm run build`, then a manual n8n run with the workflow
   timezone set to something other than the server's.

## Definition of done

A post scheduled for `14:00` in a workflow whose timezone is set to
`Europe/Berlin` is sent to the API as the matching UTC instant, regardless of
the n8n server's own timezone, and both Schedule and Schedule (Light) behave
identically.

## Verification notes (2026-09-04)

A manual run on a local n8n install: workflow timezone `Europe/Kyiv`,
scheduled for `09:00` → the post appeared at `09:00` in the post-pulse.com
calendar. **This does not disprove the bug** — the test is inconclusive:

- the n8n host machine's own timezone is `Europe/Kiev` (UTC+3), i.e. identical
  to the workflow timezone, so `new Date(naiveString)` happens to produce the
  right instant by coincidence;
- the browser that filled the `dateTime` picker is in the same zone, so an
  offset embedded by the picker would also be `+03:00`;
- the post-pulse.com account renders the calendar in the same zone.

All four timezones coincide, so the code path that ignores `this.getTimezone()`
cannot be observed. n8n does **not** pre-convert `dateTime` parameters —
`getNodeParameter` returns the stored string verbatim; the workflow timezone is
only exposed through `this.getTimezone()` and must be applied by the node.

Decisive test: keep the same node and time (`09:00`), change **only** the
workflow timezone to e.g. `America/New_York`, and run it.

- Correct behaviour: the calendar shows `16:00` Kyiv time (09:00 EDT).
- Current behaviour (bug): the calendar still shows `09:00` Kyiv time.

Also worth capturing: export the workflow JSON and check whether the stored
`scheduledTime` value carries an offset (`...T09:00:00+03:00`) or is naive
(`...T09:00:00`) — that offset, when present, comes from the *browser*, not
from the workflow timezone, so the UI notice is wrong either way.

## Confirmed (2026-09-04, second run)

Decisive test executed. Workflow `PostPulse Node Test` (#zF9tbCy3Dt5jtMvM),
timezone set to `America/New_York`, node `Schedule a light post`
(`operation: scheduleLight`).

Exported workflow JSON stores the picker value **naive, without an offset**:

```json
"scheduledTime": "2026-09-05T09:00:00"
```

So the n8n `dateTime` picker attaches no offset at all — the whole
interpretation is the node's responsibility, and `PostResource.ts:86` resolves
it in the *server's* zone.

| | value |
|---|---|
| stored parameter | `2026-09-05T09:00:00` (naive) |
| workflow timezone | `America/New_York` (EDT, UTC-4) |
| n8n process timezone | `Europe/Kiev` (UTC+3) |
| expected (09:00 EDT) | `2026-09-05T13:00:00Z` |
| actually sent (`new Date(...)`) | `2026-09-05T06:00:00Z` |

7 hours off. The post-pulse.com calendar shows `09:00` on Sep 5, which matches
`06:00Z` rendered in the Kyiv zone — the buggy value. The correct behaviour
would have rendered `16:00`.

Remaining (cosmetic) confirmation: the API response in the n8n execution output
should carry `scheduledTime` = `...T06:00:00Z`, which removes the last
assumption about the calendar's display timezone.

## Implementation (2026-09-04)

- New `nodes/PostPulse/helpers/DateHelper.ts` exporting
  `toUtcIsoInTimezone(value: string | Date, timezone: string): string`:
  - a value carrying an offset or `Z` is respected as given, only normalised
    to UTC;
  - a naive value is read as wall-clock time in `timezone`, resolved with
    `Intl.DateTimeFormat(..., { timeZone, hourCycle: 'h23' }).formatToParts()`
    and a two-pass offset resolution, which is what makes DST transitions come
    out right (the offset depends on the instant, the instant on the offset);
  - overflowing components (`2026-02-30`, `09:75`) are rejected instead of
    silently rolling over, since `Date.UTC` accepts them;
  - no new runtime dependency - `dependencies` stays empty.
- `PostResource.ts` gained `resolveScheduledTime()`, used by both
  `schedulePost` and `schedulePostLight`; it wraps helper errors in
  `NodeOperationError` with `{ itemIndex }`. The bare
  `new Date(str).toISOString()` calls are gone.

Verified against the compiled helper: `America/New_York`, `Europe/Kyiv`,
`Asia/Kolkata` (half-hour offset), `UTC`, both `Europe/Berlin` DST switches of
2026 (Mar 29 / Oct 25, checked on either side), `Australia/Sydney` (southern
hemisphere DST), midnight (`hourCycle` sanity), explicit-offset and `Z` inputs,
fractional seconds, and the error paths (empty, unparseable, overflowing,
unknown timezone). `npm run build` and `npm run lint` are clean.

The exported test case now converts correctly: `2026-09-05T09:00:00` with the
workflow timezone `America/New_York` yields `2026-09-05T13:00:00.000Z`
(previously `06:00:00.000Z`).

Subtask 5 done: the `PostPulse Node Test` workflow was re-run on the local
n8n install with the rebuilt node and the workflow timezone is now honoured.
Task closed.
