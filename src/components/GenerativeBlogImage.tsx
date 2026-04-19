"use client";

const PALETTES = [
  ["var(--color-gov-presidential)", "var(--color-accent)", "var(--color-gov-absolute)"],
  ["var(--color-gov-parliamentary)", "var(--color-gov-semi-presidential)", "var(--color-branch-judicial)"],
  ["var(--color-gov-semi-presidential)", "var(--color-gov-presidential)", "var(--color-gov-parliamentary)"],
  ["var(--color-branch-judicial)", "var(--color-gov-absolute)", "var(--color-gov-presidential)"],
  ["var(--color-accent)", "var(--color-gov-parliamentary)", "var(--color-gov-semi-presidential)"],
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

type PatternType = "dots" | "topo" | "waves" | "flow";

function generateDots(
  rand: () => number,
  w: number,
  h: number,
  colors: string[]
) {
  const elements: React.ReactElement[] = [];
  const count = 40 + Math.floor(rand() * 30);
  for (let i = 0; i < count; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const r = 1.5 + rand() * 4;
    const opacity = 0.15 + rand() * 0.45;
    const color = colors[Math.floor(rand() * colors.length)];
    elements.push(
      <circle
        key={`d${i}`}
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        opacity={opacity}
      />
    );
  }
  const lineCount = 8 + Math.floor(rand() * 6);
  for (let i = 0; i < lineCount; i++) {
    const x1 = rand() * w;
    const y1 = rand() * h;
    const x2 = x1 + (rand() - 0.5) * w * 0.6;
    const y2 = y1 + (rand() - 0.5) * h * 0.6;
    const color = colors[Math.floor(rand() * colors.length)];
    elements.push(
      <line
        key={`l${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={0.5}
        opacity={0.12}
      />
    );
  }
  return elements;
}

function generateTopo(
  rand: () => number,
  w: number,
  h: number,
  colors: string[]
) {
  const elements: React.ReactElement[] = [];
  const centers = 3 + Math.floor(rand() * 3);
  for (let c = 0; c < centers; c++) {
    const cx = w * 0.2 + rand() * w * 0.6;
    const cy = h * 0.2 + rand() * h * 0.6;
    const color = colors[c % colors.length];
    const rings = 5 + Math.floor(rand() * 5);
    for (let r = 0; r < rings; r++) {
      const radius = 20 + r * (15 + rand() * 10);
      const points: string[] = [];
      const steps = 60;
      for (let s = 0; s <= steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const wobble = 1 + (rand() - 0.5) * 0.3;
        const px = cx + Math.cos(angle) * radius * wobble;
        const py = cy + Math.sin(angle) * radius * wobble;
        points.push(`${s === 0 ? "M" : "L"}${px},${py}`);
      }
      points.push("Z");
      elements.push(
        <path
          key={`t${c}-${r}`}
          d={points.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          opacity={0.2 + (rings - r) * 0.04}
        />
      );
    }
  }
  return elements;
}

function generateWaves(
  rand: () => number,
  w: number,
  h: number,
  colors: string[]
) {
  const elements: React.ReactElement[] = [];
  const waveCount = 8 + Math.floor(rand() * 6);
  for (let i = 0; i < waveCount; i++) {
    const yBase = (h / (waveCount + 1)) * (i + 1);
    const amplitude = 10 + rand() * 25;
    const freq = 0.008 + rand() * 0.015;
    const phase = rand() * Math.PI * 2;
    const color = colors[i % colors.length];
    const points: string[] = [];
    for (let x = 0; x <= w; x += 3) {
      const y =
        yBase +
        Math.sin(x * freq + phase) * amplitude +
        Math.sin(x * freq * 2.3 + phase * 1.7) * amplitude * 0.3;
      points.push(`${x === 0 ? "M" : "L"}${x},${y}`);
    }
    elements.push(
      <path
        key={`w${i}`}
        d={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.2 + rand() * 0.15}
      />
    );
  }
  return elements;
}

function generateFlow(
  rand: () => number,
  w: number,
  h: number,
  colors: string[]
) {
  const elements: React.ReactElement[] = [];
  const angleOffsets = [rand() * Math.PI, rand() * Math.PI, rand() * Math.PI];
  const lineCount = 30 + Math.floor(rand() * 20);

  for (let i = 0; i < lineCount; i++) {
    let x = rand() * w;
    let y = rand() * h;
    const color = colors[Math.floor(rand() * colors.length)];
    const points: string[] = [`M${x},${y}`];
    const steps = 20 + Math.floor(rand() * 15);

    for (let s = 0; s < steps; s++) {
      const angle =
        Math.sin(x * 0.008 + angleOffsets[0]) * 2 +
        Math.cos(y * 0.006 + angleOffsets[1]) * 2 +
        Math.sin((x + y) * 0.004 + angleOffsets[2]);
      x += Math.cos(angle) * 4;
      y += Math.sin(angle) * 4;
      if (x < -10 || x > w + 10 || y < -10 || y > h + 10) break;
      points.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
    }

    if (points.length > 2) {
      elements.push(
        <path
          key={`f${i}`}
          d={points.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          opacity={0.18 + rand() * 0.12}
          strokeLinecap="round"
        />
      );
    }
  }
  return elements;
}

const PATTERNS: PatternType[] = ["dots", "topo", "waves", "flow"];

interface GenerativeBlogImageProps {
  slug: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function GenerativeBlogImage({
  slug,
  width = 600,
  height = 300,
  className,
  style,
}: GenerativeBlogImageProps) {
  const hash = hashString(slug);
  const rand = seededRandom(hash);
  const patternType = PATTERNS[hash % PATTERNS.length];
  const palette = PALETTES[hash % PALETTES.length];

  let elements: React.ReactElement[];
  switch (patternType) {
    case "dots":
      elements = generateDots(rand, width, height, palette);
      break;
    case "topo":
      elements = generateTopo(rand, width, height, palette);
      break;
    case "waves":
      elements = generateWaves(rand, width, height, palette);
      break;
    case "flow":
      elements = generateFlow(rand, width, height, palette);
      break;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        background: "transparent",
        ...style,
      }}
      aria-hidden="true"
    >
      {elements}
    </svg>
  );
}
