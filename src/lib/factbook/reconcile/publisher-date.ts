export type PublisherDatePrecision = "year" | "month" | "day" | "unknown";

export type PublisherDate = {
  precision: PublisherDatePrecision;
  year: number | null;
  month: number | null;
  day: number | null;
};

export type StoredPublisherDate = {
  publisherDate: PublisherDate;
};

function precisionLabel(precision: number | undefined): PublisherDatePrecision {
  if (precision === 11) return "day";
  if (precision === 10) return "month";
  if (precision === 9) return "year";
  return "unknown";
}
export function parseWikidataPublisherDate(
  pointInTime: string | undefined,
  precision: number | undefined,
): {
  asOf: string | null;
  factYear: number | null;
  valueJson: StoredPublisherDate | null;
} {
  if (!pointInTime) {
    return { asOf: null, factYear: null, valueJson: null };
  }
  const cleaned = pointInTime.startsWith("+")
    ? pointInTime.slice(1)
    : pointInTime;
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { asOf: null, factYear: null, valueJson: null };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const label = precisionLabel(precision);
  const publisherDate: PublisherDate = {
    precision: label,
    year,
    month: label === "month" || label === "day" ? month : null,
    day: label === "day" ? day : null,
  };
  const validDay =
    label === "day" &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31;
  return {
    asOf: validDay
      ? `${match[1]}-${match[2]}-${match[3]}`
      : null,
    factYear: year,
    valueJson: { publisherDate },
  };
}

export function storedPublisherDate(valueJson: unknown): PublisherDate | null {
  if (!valueJson || typeof valueJson !== "object") return null;
  const date = (valueJson as { publisherDate?: unknown }).publisherDate;
  if (!date || typeof date !== "object") return null;
  const row = date as Partial<PublisherDate>;
  if (
    !["year", "month", "day", "unknown"].includes(row.precision ?? "") ||
    (row.year !== null && row.year !== undefined && !Number.isInteger(row.year)) ||
    (row.month !== null &&
      row.month !== undefined &&
      (!Number.isInteger(row.month) || row.month < 1 || row.month > 12)) ||
    (row.day !== null &&
      row.day !== undefined &&
      (!Number.isInteger(row.day) || row.day < 1 || row.day > 31))
  ) {
    return null;
  }
  return {
    precision: row.precision as PublisherDatePrecision,
    year: row.year ?? null,
    month: row.month ?? null,
    day: row.day ?? null,
  };
}

export function formatPublisherDate(
  publisherDate: PublisherDate,
  locale = "en-US",
): string {
  if (!publisherDate.year) return "Unknown date";
  if (publisherDate.precision === "year" || !publisherDate.month) {
    return String(publisherDate.year);
  }
  if (publisherDate.precision === "month" || !publisherDate.day) {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(
      new Date(
        Date.UTC(publisherDate.year, publisherDate.month - 1, 1),
      ),
    );
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(
      Date.UTC(
        publisherDate.year,
        publisherDate.month - 1,
        publisherDate.day,
      ),
    ),
  );
}
