"use client";

// flagcdn.com only serves these widths. Asking for any other (e.g. w56)
// returns a 404 and the flag fails to load.
const FLAGCDN_WIDTHS = [20, 40, 80, 160, 320, 640, 1280, 2560] as const;

function pickFlagWidth(desired: number): number {
  for (const w of FLAGCDN_WIDTHS) {
    if (w >= desired) return w;
  }
  return FLAGCDN_WIDTHS[FLAGCDN_WIDTHS.length - 1];
}

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
  const w1x = pickFlagWidth(size * 2);
  const w2x = pickFlagWidth(size * 3);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: Math.round(size * 0.75),
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/w${w1x}/${code}.png`}
        srcSet={`https://flagcdn.com/w${w1x}/${code}.png 1x, https://flagcdn.com/w${w2x}/${code}.png 2x`}
        alt={`Flag of ${iso2.toUpperCase()}`}
        width={size}
        height={Math.round(size * 0.75)}
        loading="lazy"
        style={{
          objectFit: "cover",
          borderRadius: 2,
          display: "block",
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
