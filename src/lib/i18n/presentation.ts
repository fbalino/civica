export const PUBLIC_CONTENT_LANGUAGE = "en" as const;
export const PUBLIC_PRESENTATION_LOCALE = "en-US" as const;
export const PUBLIC_COLLATION_VERSION =
  "civica-public-english-collation/v1" as const;

const publicCollator = new Intl.Collator(PUBLIC_PRESENTATION_LOCALE, {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
  ignorePunctuation: false,
});

export function comparePublicLabels(left: string, right: string): number {
  return publicCollator.compare(left.normalize("NFC"), right.normalize("NFC"));
}

export function formatPublicNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(PUBLIC_PRESENTATION_LOCALE, options).format(
    value,
  );
}

function publicDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
}

export function formatPublicDate(
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = publicDate(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(PUBLIC_PRESENTATION_LOCALE, {
    timeZone: "UTC",
    ...options,
  }).format(date);
}
