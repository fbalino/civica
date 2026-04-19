"use client";

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PARTY_COLORS = [
  "oklch(55% 0.15 25)",
  "oklch(55% 0.18 15)",
  "oklch(58% 0.13 145)",
  "oklch(60% 0.14 270)",
  "oklch(62% 0.14 55)",
  "oklch(52% 0.15 300)",
];

type CoverVariant = "lead" | "card" | "hero";

interface HemicycleCoverProps {
  slug: string;
  variant?: CoverVariant;
}

function generateSeats(
  rand: () => number,
  rows: number,
  perRow: number,
  cx: number,
  cy: number,
  startRadius: number,
  spacing: number,
  seatRadius: number
): React.ReactElement[] {
  const seats: React.ReactElement[] = [];
  const numParties = 3 + Math.floor(rand() * 3);
  const parties = PARTY_COLORS.slice(0, numParties);

  for (let r = 0; r < rows; r++) {
    const rad = startRadius + r * spacing;
    for (let i = 0; i < perRow; i++) {
      const t = Math.PI - (i / (perRow - 1)) * Math.PI;
      const x = Math.cos(t) * rad;
      const y = -Math.sin(t) * rad;
      seats.push(
        <circle
          key={`s${r}-${i}`}
          cx={cx + x}
          cy={cy + y}
          r={seatRadius}
          fill={parties[Math.floor((i / perRow) * parties.length)]}
        />
      );
    }
  }
  return seats;
}

export function HemicycleCover({ slug, variant = "card" }: HemicycleCoverProps) {
  const hash = hashString(slug);
  const rand = seededRandom(hash);

  if (variant === "lead") {
    const vw = 600;
    const vh = 480;
    const seats = generateSeats(rand, 6, 34, 300, 360, 90, 22, 3);
    return (
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ width: "100%", height: "100%", display: "block" }}
        aria-hidden="true"
      >
        <defs>
          <pattern id={`dots-${slug}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="currentColor" opacity="0.3" />
          </pattern>
        </defs>
        <rect width={vw} height={vh} fill="var(--color-surface-elevated)" />
        <rect width={vw} height={vh} fill={`url(#dots-${slug})`} style={{ color: "var(--color-text-40)" }} />
        <g transform="translate(300 360)" style={{ color: "var(--color-text-primary)" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M -220 0 A 220 220 0 0 1 220 0" />
            <path d="M -180 0 A 180 180 0 0 1 180 0" />
            <path d="M -140 0 A 140 140 0 0 1 140 0" />
            <path d="M -100 0 A 100 100 0 0 1 100 0" />
            <path d="M -60 0 A 60 60 0 0 1 60 0" />
          </g>
          <g>{seats}</g>
          <line x1="0" y1="0" x2="0" y2="-240" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="6 6" />
        </g>
        <rect x="12" y="12" width={vw - 24} height={vh - 24} fill="none" stroke="var(--color-text-primary)" strokeWidth="1" />
      </svg>
    );
  }

  if (variant === "hero") {
    const vw = 1200;
    const vh = 515;
    const seats = generateSeats(rand, 7, 52, 600, 430, 110, 50, 3.2);
    return (
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ width: "100%", height: "100%", display: "block" }}
        aria-hidden="true"
      >
        <defs>
          <pattern id={`dotsH-${slug}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="currentColor" opacity="0.28" />
          </pattern>
        </defs>
        <rect width={vw} height={vh} fill="var(--color-surface-elevated)" />
        <rect width={vw} height={vh} fill={`url(#dotsH-${slug})`} style={{ color: "var(--color-text-40)" }} />
        <g transform="translate(600 430)" style={{ color: "var(--color-text-primary)" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M -440 0 A 440 440 0 0 1 440 0" />
            <path d="M -380 0 A 380 380 0 0 1 380 0" />
            <path d="M -320 0 A 320 320 0 0 1 320 0" />
            <path d="M -260 0 A 260 260 0 0 1 260 0" />
            <path d="M -200 0 A 200 200 0 0 1 200 0" />
            <path d="M -140 0 A 140 140 0 0 1 140 0" />
            <path d="M -80 0 A 80 80 0 0 1 80 0" />
          </g>
          <g>{seats}</g>
          <line x1="0" y1="0" x2="0" y2="-480" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="6 6" />
        </g>
      </svg>
    );
  }

  // Card variant — smaller, simpler
  const vw = 400;
  const vh = 300;
  const shapeType = hash % 3;
  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden="true"
    >
      <rect width={vw} height={vh} fill="var(--color-surface-elevated)" />
      {shapeType === 0 && (
        // Hemicycle
        <g transform="translate(200 220)" style={{ color: "var(--color-text-primary)" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M -140 0 A 140 140 0 0 1 140 0" />
            <path d="M -110 0 A 110 110 0 0 1 110 0" />
            <path d="M -80 0 A 80 80 0 0 1 80 0" />
          </g>
          <g fill="var(--color-accent)">
            <circle cx={-70} cy={-50} r={4} />
            <circle cx={-20} cy={-80} r={4} />
            <circle cx={30} cy={-80} r={4} />
            <circle cx={80} cy={-50} r={4} />
            <circle cx={110} cy={-10} r={4} />
          </g>
        </g>
      )}
      {shapeType === 1 && (
        // Opposing benches
        <g style={{ color: "var(--color-text-primary)" }} fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="40" y="100" width="140" height="24" />
          <rect x="40" y="134" width="140" height="24" />
          <rect x="40" y="168" width="140" height="24" />
          <rect x="220" y="100" width="140" height="24" />
          <rect x="220" y="134" width="140" height="24" />
          <rect x="220" y="168" width="140" height="24" />
          <line x1="200" y1="80" x2="200" y2="220" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4 4" />
        </g>
      )}
      {shapeType === 2 && (
        // Round chamber
        <g transform="translate(200 170)" style={{ color: "var(--color-text-primary)" }}>
          <circle cx="0" cy="0" r="90" fill="none" stroke="currentColor" />
          <circle cx="0" cy="0" r="60" fill="none" stroke="currentColor" />
          <circle cx="0" cy="0" r="30" fill="none" stroke="currentColor" />
          <g fill="var(--color-accent)">
            <circle cx="0" cy="-90" r={4} />
            <circle cx="90" cy="0" r={4} />
            <circle cx="0" cy="90" r={4} />
            <circle cx="-90" cy="0" r={4} />
          </g>
        </g>
      )}
    </svg>
  );
}
