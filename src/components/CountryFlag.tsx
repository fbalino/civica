"use client";

function emojiFlag(iso2: string): string {
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function CountryFlag({
  iso2,
  size = 32,
  className,
}: {
  iso2: string | null;
  size?: number;
  className?: string;
}) {
  if (!iso2) return <span style={{ fontSize: size, lineHeight: 1 }} className={className} />;

  const code = iso2.toLowerCase();
  const height = Math.round(size * 0.75);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/${code}.svg`}
        alt={`Flag of ${iso2.toUpperCase()}`}
        width={size}
        height={height}
        loading="lazy"
        style={{
          width: size,
          height,
          objectFit: "cover",
          borderRadius: 2,
          display: "block",
          // Faint hairline ring so light flags (e.g. Japan) still read an
          // edge against white/ivory cards, in both themes.
          boxShadow:
            "inset 0 0 0 1px color-mix(in oklab, var(--color-text-primary) 8%, transparent)",
        }}
        onError={(e) => {
          const target = e.currentTarget;
          const parent = target.parentElement;
          if (parent) {
            parent.textContent = emojiFlag(iso2);
            parent.style.fontSize = `${size}px`;
          }
        }}
      />
    </span>
  );
}
