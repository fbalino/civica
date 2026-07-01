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

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        lineHeight: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/${code}.svg`}
        alt={`Flag of ${iso2.toUpperCase()}`}
        width={size}
        // Reserve a flag-shaped box (~5:3) BEFORE load. Critical with
        // loading="lazy": an `height:auto` image is 0px tall pre-load, so the
        // lazy observer never sees it enter the viewport and never loads it.
        // The attr seeds the box; CSS `height:auto` corrects to the flag's true
        // aspect once the SVG's intrinsic 2:1 / 3:2 / 1:1 ratio is known.
        height={Math.round(size * 0.6)}
        loading="lazy"
        style={{
          // Size by WIDTH and let height follow the flag's natural aspect ratio,
          // so wide ensigns (Montserrat, UK, most 2:1 flags) are shown whole
          // instead of being cropped by a fixed 4:3 box. `maxHeight` + contain
          // gracefully caps the rare tall/near-square flag (Switzerland 1:1,
          // Nepal) inside a square rather than stretching it.
          width: size,
          height: "auto",
          maxHeight: size,
          objectFit: "contain",
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
