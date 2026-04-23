"use client";

export type HistoryPoint = { quarter: string; score: number };

export interface TimelineSeries {
  name: string;
  colorVar: string;
  data: HistoryPoint[];
}

function formatQuarter(q: string): string {
  const m = q.match(/^(\d{4})-Q(\d)$/);
  if (!m) return q;
  return `Q${m[2]} ${m[1]}`;
}

export function CompareTimelineOverlay({ series }: { series: TimelineSeries[] }) {
  const allPoints = series.flatMap((s) => s.data);
  if (allPoints.length === 0) return null;

  const quartersSet = new Set(allPoints.map((p) => p.quarter));
  const quarters = [...quartersSet].sort();
  if (quarters.length < 2) return null;

  const W = 1120;
  const H = 340;
  const PAD = { top: 0, right: 0, bottom: 24, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const minScore = 0;
  const maxScore = 100;
  const xStep = chartW / (quarters.length - 1);

  const xAt = (i: number) => PAD.left + i * xStep;
  const yAt = (score: number) =>
    PAD.top + chartH - ((score - minScore) / (maxScore - minScore)) * chartH;

  const bandTops = [
    { from: 100, to: 90, color: "var(--tier-exceptional)" },
    { from: 90, to: 75, color: "var(--tier-strong)" },
    { from: 75, to: 50, color: "var(--tier-mixed)" },
    { from: 50, to: 25, color: "var(--tier-weak)" },
    { from: 25, to: 0, color: "var(--tier-failed)" },
  ];

  const xLabelIdx = new Set<number>([0, quarters.length - 1]);
  if (quarters.length > 6) {
    xLabelIdx.add(Math.round(quarters.length / 3));
    xLabelIdx.add(Math.round((2 * quarters.length) / 3));
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 340 }}
      aria-label="Civica Index timeline overlay"
    >
      {bandTops.map((b) => (
        <rect
          key={b.from}
          x={PAD.left}
          y={yAt(b.from)}
          width={chartW}
          height={yAt(b.to) - yAt(b.from)}
          fill={b.color}
          opacity="0.06"
        />
      ))}
      <g stroke="var(--color-divider)" strokeWidth="1" opacity="0.6">
        {[90, 75, 50, 25].map((v) => (
          <line
            key={v}
            x1={PAD.left}
            y1={yAt(v)}
            x2={PAD.left + chartW}
            y2={yAt(v)}
          />
        ))}
      </g>
      {[100, 90, 75, 50, 25].map((v) => (
        <text
          key={v}
          x={4}
          y={yAt(v) + 3}
          fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
          fontSize="10"
          fill="var(--color-text-30)"
          fontWeight="500"
        >
          {v}
        </text>
      ))}
      {series.map((s) => {
        const pts = quarters
          .map((q, i) => {
            const pt = s.data.find((d) => d.quarter === q);
            return pt ? { x: xAt(i), y: yAt(pt.score) } : null;
          })
          .filter(Boolean) as { x: number; y: number }[];
        if (pts.length < 2) return null;
        const d = pts
          .map((p, pi) => `${pi === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ");
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.colorVar} strokeWidth="2" />
            {pts.map((p, pi) => (
              <circle key={pi} cx={p.x} cy={p.y} r={3} fill={s.colorVar} />
            ))}
          </g>
        );
      })}
      <g
        fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
        fontSize="10"
        fill="var(--color-text-30)"
        fontWeight="500"
      >
        {quarters.map((q, i) =>
          xLabelIdx.has(i) ? (
            <text
              key={q}
              x={xAt(i)}
              y={H - 6}
              textAnchor={
                i === 0 ? "start" : i === quarters.length - 1 ? "end" : "middle"
              }
            >
              {formatQuarter(q)}
            </text>
          ) : null
        )}
      </g>
    </svg>
  );
}
