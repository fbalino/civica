import { isFrozenSource, sourceLabel } from "@/lib/data/sources";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not yet synced";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not yet synced";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function SourceDot({
  source,
  retrievedAt,
}: {
  source: string;
  retrievedAt: string | null | undefined;
}) {
  const isFrozen = isFrozenSource(source);
  const label = sourceLabel(source);
  const date = formatDate(retrievedAt);

  return (
    <span
      className={`source-dot ${isFrozen ? "source-dot--frozen" : "source-dot--live"}`}
      data-source={label}
      data-date={date}
      role="img"
      tabIndex={0}
      aria-label={`Source: ${label}, ${date}`}
    />
  );
}
