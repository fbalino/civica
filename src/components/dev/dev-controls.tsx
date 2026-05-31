"use client";

import { useState } from "react";

/* ============================================================
 * SliderControl — for "size" / "weight" / numeric token values
 * ============================================================ */

export function SliderControl({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "px",
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const num = parseFloat(value) || 0;
  const set = (n: number) => onChange(`${n}${unit}`);
  return (
    <div className="dev-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) => set(parseFloat(e.target.value))}
        className="dev-slider__range"
      />
      <input
        type="number"
        value={num}
        min={min}
        max={max}
        step={step}
        onChange={(e) => set(parseFloat(e.target.value || "0"))}
        className="dev-slider__num"
      />
      <span className="dev-slider__unit">{unit}</span>
    </div>
  );
}

/* ============================================================
 * NumericRawControl — slider for unitless / em / ms tokens
 * (font-weight, leading, tracking, motion duration)
 * ============================================================ */

type RawNumericFlavor = "unitless" | "em" | "ms" | "weight";

const RAW_FLAVOR_CONFIG: Record<
  RawNumericFlavor,
  { min: number; max: number; step: number; unit: string }
> = {
  unitless: { min: 0.8, max: 2.0, step: 0.05, unit: "" },
  em: { min: -0.05, max: 0.3, step: 0.005, unit: "em" },
  ms: { min: 0, max: 1000, step: 10, unit: "ms" },
  weight: { min: 100, max: 900, step: 100, unit: "" },
};

export function detectRawFlavor(
  cssVar: string,
  defaultValue: string,
): RawNumericFlavor | null {
  if (cssVar.startsWith("--font-weight-")) return "weight";
  if (cssVar.startsWith("--leading-")) return "unitless";
  if (cssVar.startsWith("--tracking-")) return "em";
  if (cssVar.startsWith("--motion-") && /ms$/.test(defaultValue)) return "ms";
  return null;
}

export function NumericRawControl({
  value,
  onChange,
  flavor,
}: {
  value: string;
  onChange: (v: string) => void;
  flavor: RawNumericFlavor;
}) {
  const cfg = RAW_FLAVOR_CONFIG[flavor];
  const num = parseFloat(value) || cfg.min;
  const set = (n: number) => onChange(`${n}${cfg.unit}`);
  return (
    <div className="dev-slider">
      <input
        type="range"
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={num}
        onChange={(e) => set(parseFloat(e.target.value))}
        className="dev-slider__range"
      />
      <input
        type="number"
        value={num}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        onChange={(e) => set(parseFloat(e.target.value || "0"))}
        className="dev-slider__num"
      />
      {cfg.unit && <span className="dev-slider__unit">{cfg.unit}</span>}
    </div>
  );
}

/* ============================================================
 * Color + alpha picker (for shadow layer colors)
 * ============================================================ */

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(s: string): RGBA {
  const t = s.trim();
  // rgba(r, g, b, a) or rgb(r, g, b)
  const rgbaM = t.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i,
  );
  if (rgbaM) {
    return {
      r: +rgbaM[1],
      g: +rgbaM[2],
      b: +rgbaM[3],
      a: rgbaM[4] != null ? +rgbaM[4] : 1,
    };
  }
  // #rrggbb / #rgb
  const hex6 = t.match(/^#([0-9a-f]{6})$/i);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, a: 1 };
  }
  const hex3 = t.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [r, g, b] = hex3[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  // Fallback opaque black.
  return { r: 0, g: 0, b: 0, a: 1 };
}

function rgbToHex({ r, g, b }: RGBA): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function rgbaString({ r, g, b, a }: RGBA): string {
  return a >= 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

export function ColorAlphaPicker({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  const rgba = parseColor(value);
  const hex = rgbToHex(rgba);
  return (
    <div className={`dev-color-alpha${compact ? " dev-color-alpha--compact" : ""}`}>
      <input
        type="color"
        value={hex}
        onChange={(e) => {
          const next = parseColor(e.target.value);
          onChange(rgbaString({ ...next, a: rgba.a }));
        }}
        className="dev-color-alpha__swatch"
      />
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={rgba.a}
        onChange={(e) => onChange(rgbaString({ ...rgba, a: parseFloat(e.target.value) }))}
        className="dev-color-alpha__alpha"
        title="Opacity"
      />
      <span className="dev-color-alpha__pct">{Math.round(rgba.a * 100)}%</span>
    </div>
  );
}

/* ============================================================
 * Shadow editor — multi-layer, slider-driven, with live preview
 *
 * Parses + reserialises CSS box-shadow strings of the form:
 *   <x>px <y>px <blur>px [<spread>px] <color>
 * separated by commas. `inset`, `none`, and `var(...)` colors are
 * not supported in v0; they fall back to the raw textarea.
 * ============================================================ */

type ShadowLayer = {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
};

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

// Accepts both "0 1px 2px rgba(...)" and "0px 1px 2px 0px rgba(...)" — px
// suffix is optional on every length so bare-zero values parse cleanly.
const SHADOW_RE =
  /^([+-]?\d+(?:\.\d+)?)(?:px)?\s+([+-]?\d+(?:\.\d+)?)(?:px)?\s+(\d+(?:\.\d+)?)(?:px)?(?:\s+([+-]?\d+(?:\.\d+)?)(?:px)?)?\s+(.+)$/;

export function parseShadow(value: string): ShadowLayer[] | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none") return [];
  if (/inset|var\(/.test(trimmed)) return null;
  const parts = splitTopLevel(trimmed, ",").map((p) => p.trim());
  const layers: ShadowLayer[] = [];
  for (const p of parts) {
    const m = p.match(SHADOW_RE);
    if (!m) return null;
    layers.push({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
      blur: parseFloat(m[3]),
      spread: m[4] ? parseFloat(m[4]) : 0,
      color: m[5].trim(),
    });
  }
  return layers;
}

function stringifyShadow(layers: ShadowLayer[]): string {
  if (layers.length === 0) return "none";
  return layers
    .map(
      (l) =>
        `${l.x}px ${l.y}px ${l.blur}px${l.spread !== 0 ? ` ${l.spread}px` : ""} ${l.color}`,
    )
    .join(", ");
}

export function ShadowEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = parseShadow(value);
  const [rawMode, setRawMode] = useState(parsed === null);

  // If parser fails, fall back to raw textarea — and offer to switch.
  if (parsed === null || rawMode) {
    return (
      <div className="dev-shadow">
        <textarea
          className="dev-input dev-input--shadow"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          spellCheck={false}
        />
        {parsed !== null && (
          <button
            type="button"
            className="dev-shadow__mode"
            onClick={() => setRawMode(false)}
          >
            Use visual editor
          </button>
        )}
        {parsed === null && (
          <p className="dev-shadow__hint">
            Visual editor unavailable for this shadow (uses inset or var()).
            Edit as text.
          </p>
        )}
        <div className="dev-shadow__preview">
          <div className="dev-shadow__sample" style={{ boxShadow: value }} />
        </div>
      </div>
    );
  }

  const update = (next: ShadowLayer[]) => onChange(stringifyShadow(next));

  return (
    <div className="dev-shadow">
      <div className="dev-shadow__head">
        <span className="dev-shadow__count">
          {parsed.length} layer{parsed.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          className="dev-shadow__mode"
          onClick={() => setRawMode(true)}
        >
          Edit as text
        </button>
      </div>

      {parsed.map((layer, i) => (
        <ShadowLayerRow
          key={i}
          index={i}
          layer={layer}
          onChange={(l) => update(parsed.map((p, j) => (j === i ? l : p)))}
          onRemove={() =>
            update(parsed.filter((_, j) => j !== i))
          }
        />
      ))}

      <button
        type="button"
        className="dev-shadow__add"
        onClick={() =>
          update([
            ...parsed,
            { x: 0, y: 4, blur: 12, spread: 0, color: "rgba(11, 18, 32, 0.10)" },
          ])
        }
      >
        + Add layer
      </button>

      <div className="dev-shadow__preview">
        <div className="dev-shadow__preview-label">Preview</div>
        <div
          className="dev-shadow__sample"
          style={{ boxShadow: stringifyShadow(parsed) }}
        />
      </div>
    </div>
  );
}

function ShadowLayerRow({
  index,
  layer,
  onChange,
  onRemove,
}: {
  index: number;
  layer: ShadowLayer;
  onChange: (l: ShadowLayer) => void;
  onRemove: () => void;
}) {
  return (
    <div className="dev-shadow-layer">
      <div className="dev-shadow-layer__head">
        <span className="dev-shadow-layer__title">Layer {index + 1}</span>
        <button
          type="button"
          className="dev-shadow-layer__remove"
          onClick={onRemove}
          aria-label={`Remove layer ${index + 1}`}
        >
          ×
        </button>
      </div>

      <ShadowSlider
        label="X"
        value={layer.x}
        min={-50}
        max={50}
        onChange={(v) => onChange({ ...layer, x: v })}
      />
      <ShadowSlider
        label="Y"
        value={layer.y}
        min={-50}
        max={50}
        onChange={(v) => onChange({ ...layer, y: v })}
      />
      <ShadowSlider
        label="Blur"
        value={layer.blur}
        min={0}
        max={100}
        onChange={(v) => onChange({ ...layer, blur: v })}
      />
      <ShadowSlider
        label="Spread"
        value={layer.spread}
        min={-50}
        max={50}
        onChange={(v) => onChange({ ...layer, spread: v })}
      />
      <div className="dev-shadow-layer__color">
        <span className="dev-shadow-layer__lbl">Color</span>
        <ColorAlphaPicker
          value={layer.color}
          onChange={(c) => onChange({ ...layer, color: c })}
          compact
        />
      </div>
    </div>
  );
}

function ShadowSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="dev-shadow-layer__row">
      <span className="dev-shadow-layer__lbl">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="dev-slider__range"
      />
      <span className="dev-shadow-layer__num">{value}</span>
    </div>
  );
}
