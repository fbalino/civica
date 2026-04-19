"use client";

interface PartySlice {
  name: string;
  seats: number;
  color: string;
}

interface HemicycleChartProps {
  totalSeats: number;
  parties: PartySlice[];
  chamberName: string;
}

function generateHemicycleDots(
  totalSeats: number,
  cx: number,
  cy: number,
  minR: number,
  maxR: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let placed = 0;
  const rows = Math.max(2, Math.ceil(Math.sqrt(totalSeats / 3)));
  const rowRadii: number[] = [];
  for (let i = 0; i < rows; i++) {
    rowRadii.push(minR + (maxR - minR) * (i / (rows - 1)));
  }

  const seatsPerRow: number[] = [];
  let totalArcLen = 0;
  const arcLens = rowRadii.map((r) => Math.PI * r);
  totalArcLen = arcLens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rows; i++) {
    const n = Math.round((arcLens[i] / totalArcLen) * totalSeats);
    seatsPerRow.push(n);
  }

  let diff = totalSeats - seatsPerRow.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; diff > 0 && i >= 0; i--) {
    seatsPerRow[i]++;
    diff--;
  }
  for (let i = 0; diff < 0 && i < rows; i++) {
    if (seatsPerRow[i] > 1) {
      seatsPerRow[i]--;
      diff++;
    }
  }

  for (let row = 0; row < rows; row++) {
    const n = seatsPerRow[row];
    if (n <= 0) continue;
    const r = rowRadii[row];
    for (let j = 0; j < n; j++) {
      const angle = Math.PI - (Math.PI * (j + 0.5)) / n;
      points.push({
        x: cx + r * Math.cos(angle),
        y: cy - r * Math.sin(angle),
      });
      placed++;
      if (placed >= totalSeats) return points;
    }
  }
  return points;
}

export function HemicycleChart({
  totalSeats,
  parties,
  chamberName,
}: HemicycleChartProps) {
  const actualTotal = parties.reduce((s, p) => s + p.seats, 0);
  const displayTotal = totalSeats > 0 ? totalSeats : actualTotal;

  if (displayTotal === 0) return null;

  const width = 500;
  const height = 290;
  const cx = width / 2;
  const cy = height - 20;
  const minR = displayTotal > 200 ? 80 : 60;
  const maxR = 220;

  const dots = generateHemicycleDots(displayTotal, cx, cy, minR, maxR);
  const dotR = Math.min(6, Math.max(2.5, 140 / Math.sqrt(displayTotal)));

  const partyRanges: { name: string; color: string; start: number; end: number; seats: number }[] = [];
  let idx = 0;
  for (const p of parties) {
    partyRanges.push({ name: p.name, color: p.color, start: idx, end: idx + p.seats, seats: p.seats });
    idx += p.seats;
  }

  return (
    <div className="cv-card" style={{ padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-24)",
          fontWeight: 400,
          margin: 0,
          color: "var(--color-text-primary)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          {chamberName}
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-source-live)", flexShrink: 0 }} />
        </h3>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-13)",
          color: "var(--color-text-40)",
        }}>
          {displayTotal} seats
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width, display: "block", margin: "0 auto" }}
        role="img"
        aria-label={`${chamberName} seat composition: ${parties.map((p) => `${p.name} ${p.seats}`).join(", ")}`}
      >
        {dots.map((dot, i) => {
          const party = partyRanges.find((p) => i >= p.start && i < p.end);
          return (
            <circle
              key={i}
              cx={dot.x}
              cy={dot.y}
              r={dotR}
              fill={party?.color ?? "var(--color-text-20)"}
            />
          );
        })}
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fill: "var(--color-text-40)",
          }}
        >
          {displayTotal} seats
        </text>
      </svg>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "12px 20px",
        marginTop: 12,
      }}>
        {parties.map((p) => (
          <span
            key={p.name}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-50)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: p.color,
              flexShrink: 0,
            }} />
            {p.name} {p.seats}
          </span>
        ))}
      </div>
    </div>
  );
}
