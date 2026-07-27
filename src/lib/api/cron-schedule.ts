const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_LOOKBACK_DAYS = 370;

interface ParsedField {
  wildcard: boolean;
  values: ReadonlySet<number>;
  descending: readonly number[];
}

function parseNumber(value: string, minimum: number, maximum: number): number {
  if (!/^\d+$/.test(value))
    throw new Error(`Invalid cron field value: ${value}`);
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    throw new Error(
      `Cron field value ${value} is outside ${minimum}-${maximum}`,
    );
  }
  return parsed;
}

function parseField(
  source: string,
  minimum: number,
  maximum: number,
): ParsedField {
  const values = new Set<number>();

  for (const part of source.split(",")) {
    const [rangeSource, stepSource] = part.split("/");
    if (part.split("/").length > 2) {
      throw new Error(`Invalid cron field: ${source}`);
    }
    const step = stepSource
      ? parseNumber(stepSource, 1, maximum - minimum + 1)
      : 1;
    let start: number;
    let end: number;

    if (rangeSource === "*") {
      start = minimum;
      end = maximum;
    } else if (rangeSource.includes("-")) {
      const bounds = rangeSource.split("-");
      if (bounds.length !== 2) throw new Error(`Invalid cron range: ${part}`);
      start = parseNumber(bounds[0], minimum, maximum);
      end = parseNumber(bounds[1], minimum, maximum);
      if (start > end) throw new Error(`Descending cron range: ${part}`);
    } else {
      if (stepSource)
        throw new Error(`Cron step requires * or a range: ${part}`);
      start = parseNumber(rangeSource, minimum, maximum);
      end = start;
    }

    for (let value = start; value <= end; value += step) values.add(value);
  }

  if (values.size === 0) throw new Error(`Empty cron field: ${source}`);
  return {
    wildcard: values.size === maximum - minimum + 1,
    values,
    descending: [...values].sort((left, right) => right - left),
  };
}

interface ParsedSchedule {
  minute: ParsedField;
  hour: ParsedField;
  dayOfMonth: ParsedField;
  month: ParsedField;
  dayOfWeek: ParsedField;
}

function parseSchedule(schedule: string): ParsedSchedule {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Cron schedule must contain five fields: ${schedule}`);
  }
  const parsed = {
    minute: parseField(fields[0], 0, 59),
    hour: parseField(fields[1], 0, 23),
    dayOfMonth: parseField(fields[2], 1, 31),
    month: parseField(fields[3], 1, 12),
    dayOfWeek: parseField(fields[4], 0, 6),
  };
  if (!parsed.dayOfMonth.wildcard && !parsed.dayOfWeek.wildcard) {
    throw new Error(
      `Vercel cron schedules cannot constrain day-of-month and day-of-week together: ${schedule}`,
    );
  }
  return parsed;
}

function matchesDate(schedule: ParsedSchedule, date: Date): boolean {
  return (
    schedule.dayOfMonth.values.has(date.getUTCDate()) &&
    schedule.month.values.has(date.getUTCMonth() + 1) &&
    schedule.dayOfWeek.values.has(date.getUTCDay())
  );
}

/** Return the latest UTC schedule occurrence at or before `now`. */
export function latestCronScheduleSlot(schedule: string, now: Date): Date {
  if (!Number.isFinite(now.getTime())) throw new Error("Cron clock is invalid");
  const parsed = parseSchedule(schedule);
  const cursorMs = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS;
  const cursor = new Date(cursorMs);
  const currentDayMs = Date.UTC(
    cursor.getUTCFullYear(),
    cursor.getUTCMonth(),
    cursor.getUTCDate(),
  );

  // Search calendar days, then at most 24 allowed hours. This avoids the
  // half-million Date allocations a minute-by-minute annual scan can create.
  for (let dayOffset = 0; dayOffset <= MAX_LOOKBACK_DAYS; dayOffset++) {
    const dayMs = currentDayMs - dayOffset * DAY_MS;
    const day = new Date(dayMs);
    if (!matchesDate(parsed, day)) continue;

    const latestHour = dayOffset === 0 ? cursor.getUTCHours() : 23;
    for (const hour of parsed.hour.descending) {
      if (hour > latestHour) continue;
      const latestMinute =
        dayOffset === 0 && hour === cursor.getUTCHours()
          ? cursor.getUTCMinutes()
          : 59;
      const minute = parsed.minute.descending.find(
        (candidate) => candidate <= latestMinute,
      );
      if (minute === undefined) continue;
      return new Date(dayMs + hour * 60 * MINUTE_MS + minute * MINUTE_MS);
    }
  }

  throw new Error(`No cron schedule occurrence found in 370 days: ${schedule}`);
}

export function currentMinuteSlot(now: Date): Date {
  if (!Number.isFinite(now.getTime())) throw new Error("Cron clock is invalid");
  return new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS);
}
