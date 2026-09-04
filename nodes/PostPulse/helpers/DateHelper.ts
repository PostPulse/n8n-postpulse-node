/**
 * Timezone-aware conversion of the `scheduledTime` parameter to a UTC ISO string.
 *
 * n8n stores a `dateTime` picker value as a naive local date-time (e.g.
 * `2026-09-05T09:00:00`) and never converts it: `getNodeParameter` returns the
 * stored string verbatim. The workflow timezone is only exposed through
 * `this.getTimezone()`, so the node has to apply it itself.
 *
 * Implemented with native `Intl` only - this package must keep an empty
 * `dependencies` list (n8n community node rule).
 */

// `2026-09-05T09:00`, `2026-09-05T09:00:00`, `2026-09-05 09:00:00.123`
const NAIVE_DATE_TIME =
	/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/;

// A trailing `Z` or an explicit `+HH:MM` / `-HHMM` offset
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Offset of `timeZone` from UTC, in milliseconds, at the given instant.
 * Positive east of Greenwich. DST-aware, because the offset is resolved for
 * that specific instant rather than taken as a constant.
 */
function getTimezoneOffsetMs(instant: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(instant);

	const field: Record<string, number> = {};
	for (const part of parts) {
		if (part.type !== 'literal') {
			field[part.type] = Number(part.value);
		}
	}

	// The wall-clock reading of `instant` in `timeZone`, re-read as if it were UTC.
	const asUtc = Date.UTC(
		field.year,
		field.month - 1,
		field.day,
		field.hour,
		field.minute,
		field.second,
		instant.getUTCMilliseconds(),
	);

	return asUtc - instant.getTime();
}

/**
 * Converts a scheduled-time value to a UTC ISO string.
 *
 * - A value that already carries an offset (or `Z`) is respected as given and
 *   only normalised to UTC.
 * - A naive value is interpreted as wall-clock time in `timezone`.
 *
 * @throws {Error} when the value cannot be parsed or the timezone is unknown.
 */
export function toUtcIsoInTimezone(value: string | Date, timezone: string): string {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new Error('The scheduled time is not a valid date');
		}
		return value.toISOString();
	}

	const trimmed = typeof value === 'string' ? value.trim() : '';
	if (trimmed === '') {
		throw new Error('The scheduled time is empty');
	}

	if (HAS_OFFSET.test(trimmed)) {
		const withOffset = new Date(trimmed);
		if (Number.isNaN(withOffset.getTime())) {
			throw new Error(`The scheduled time "${trimmed}" is not a valid date`);
		}
		return withOffset.toISOString();
	}

	const match = NAIVE_DATE_TIME.exec(trimmed);
	if (!match) {
		throw new Error(
			`The scheduled time "${trimmed}" is not a valid date-time. Expected a format like 2026-09-05T09:00:00`,
		);
	}

	const [, year, month, day, hour, minute, second, millisecond] = match;
	const wallClock = Date.UTC(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second ?? '0'),
		Number((millisecond ?? '').padEnd(3, '0') || '0'),
	);

	// `Date.UTC` silently rolls overflowing components over (2026-02-30 becomes
	// 2026-03-02), so reject anything that did not survive the round trip.
	const roundTrip = new Date(wallClock);
	if (
		Number.isNaN(wallClock) ||
		roundTrip.getUTCFullYear() !== Number(year) ||
		roundTrip.getUTCMonth() !== Number(month) - 1 ||
		roundTrip.getUTCDate() !== Number(day) ||
		roundTrip.getUTCHours() !== Number(hour) ||
		roundTrip.getUTCMinutes() !== Number(minute)
	) {
		throw new Error(`The scheduled time "${trimmed}" is not a valid date-time`);
	}

	// The offset depends on the instant, and the instant depends on the offset.
	// Resolve it once against the naive value read as UTC, then re-check against
	// the candidate instant - that second pass is what gets DST transitions right.
	let offset: number;
	try {
		offset = getTimezoneOffsetMs(new Date(wallClock), timezone);
	} catch {
		throw new Error(`Unknown workflow timezone "${timezone}"`);
	}

	let utc = wallClock - offset;
	const adjustedOffset = getTimezoneOffsetMs(new Date(utc), timezone);
	if (adjustedOffset !== offset) {
		utc = wallClock - adjustedOffset;
	}

	return new Date(utc).toISOString();
}
