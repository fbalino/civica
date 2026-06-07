"use client";

import { useMemo, useState } from "react";
import type { AtlasCountry } from "@/lib/atlas/load-atlas-data";
import { Check, Copy } from "lucide-react";

const PUBLIC_ORIGIN = "https://civicaatlas.org";

const DATAPOINTS: Array<{ key: string; label: string; hint?: string }> = [
  { key: "ci", label: "Civica Index" },
  { key: "capital", label: "Capital" },
  { key: "gov", label: "Government type" },
  { key: "pop", label: "Population" },
  { key: "gdp", label: "GDP" },
  { key: "area", label: "Area" },
];

const THEMES: Array<{ key: "auto" | "light" | "dark"; label: string }> = [
  { key: "auto", label: "Auto" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

const WIDTH_PRESETS = [
  { key: 320, label: "Narrow" },
  { key: 360, label: "Default" },
  { key: 420, label: "Wide" },
];

const HEIGHT_PRESETS = [
  { key: 240, label: "Short" },
  { key: 320, label: "Tall" },
  { key: 420, label: "Full" },
];

export interface WidgetBuilderProps {
  countries: AtlasCountry[];
  initialSlug: string;
}

/**
 * Phase G — widget builder.
 *
 * Replaces the old "pick a country, get 3 fixed cards" gallery with a
 * configurable builder: country picker + datapoint checkboxes + a live
 * preview iframe + a copy-paste snippet. The preview hits
 * /embed/<slug>?size=custom&include=...&theme=...&w=...&h=... so the
 * actual widget lives in the same route as the presets.
 */
export function WidgetBuilder({ countries, initialSlug }: WidgetBuilderProps) {
  const [slug, setSlug] = useState(initialSlug);
  const [query, setQuery] = useState("");
  const [includeKeys, setIncludeKeys] = useState<Set<string>>(
    () => new Set(["ci", "capital", "gov"]),
  );
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");
  const [width, setWidth] = useState<number>(360);
  const [height, setHeight] = useState<number>(320);
  const [copied, setCopied] = useState(false);

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return countries
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, countries]);

  const country = countries.find((c) => c.slug === slug);

  const includeParam = useMemo(
    () =>
      Array.from(includeKeys)
        .filter(Boolean)
        .join(","),
    [includeKeys],
  );

  const previewSrc = useMemo(() => {
    const qs = new URLSearchParams({
      size: "custom",
      include: includeParam,
      w: String(width),
      h: String(height),
    });
    if (theme !== "auto") qs.set("theme", theme);
    return `/embed/${slug}?${qs.toString()}`;
  }, [slug, includeParam, width, height, theme]);

  const snippet = useMemo(() => {
    return `<iframe src="${PUBLIC_ORIGIN}${previewSrc}" width="${width}" height="${height}" frameborder="0" loading="lazy" title="Civica Index — ${country?.name ?? slug}"></iframe>`;
  }, [previewSrc, width, height, country, slug]);

  const toggleInclude = (key: string) => {
    setIncludeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="wb">
      <div className="wb-header">
        <div className="wb-eyebrow">Build a custom widget</div>
        <h2 className="wb-title">Pick a country and the data you want.</h2>
        <p className="wb-lede">
          Each datapoint adds a row to the widget. Width and height adjust on
          the fly. Copy the iframe and embed it anywhere.
        </p>
      </div>

      <div className="wb-grid">
        <div className="wb-controls">
          {/* Country picker */}
          <div className="wb-field">
            <label className="wb-label">Country</label>
            <input
              type="search"
              autoComplete="off"
              value={query}
              placeholder={country?.name ?? "Search a country"}
              onChange={(e) => setQuery(e.target.value)}
              className="wb-input"
            />
            {matched.length > 0 && (
              <ul className="wb-results" role="listbox">
                {matched.map((c) => (
                  <li
                    key={c.id}
                    role="option"
                    aria-selected={c.slug === slug}
                    className={`wb-result${c.slug === slug ? " on" : ""}`}
                    onMouseDown={() => {
                      setSlug(c.slug);
                      setQuery("");
                    }}
                  >
                    <span>{c.name}</span>
                    <span className="wb-result-iso">{c.id.toUpperCase()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Datapoints */}
          <div className="wb-field">
            <label className="wb-label">Datapoints</label>
            <div className="wb-checkboxes">
              {DATAPOINTS.map((d) => {
                const on = includeKeys.has(d.key);
                return (
                  <label key={d.key} className={`wb-check${on ? " on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleInclude(d.key)}
                    />
                    <span className="wb-check-label">{d.label}</span>
                    {d.hint ? (
                      <span className="wb-check-hint">{d.hint}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Theme */}
          <div className="wb-field">
            <label className="wb-label">Theme</label>
            <div className="wb-toggle-row">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`wb-toggle${theme === t.key ? " on" : ""}`}
                  onClick={() => setTheme(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="wb-field">
            <label className="wb-label">Width</label>
            <div className="wb-toggle-row">
              {WIDTH_PRESETS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  className={`wb-toggle${width === w.key ? " on" : ""}`}
                  onClick={() => setWidth(w.key)}
                >
                  {w.label}
                  <span className="wb-toggle-sub">{w.key}px</span>
                </button>
              ))}
            </div>
          </div>
          <div className="wb-field">
            <label className="wb-label">Height</label>
            <div className="wb-toggle-row">
              {HEIGHT_PRESETS.map((h) => (
                <button
                  key={h.key}
                  type="button"
                  className={`wb-toggle${height === h.key ? " on" : ""}`}
                  onClick={() => setHeight(h.key)}
                >
                  {h.label}
                  <span className="wb-toggle-sub">{h.key}px</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview + snippet */}
        <div className="wb-preview-col">
          <div className="wb-field">
            <label className="wb-label">Preview</label>
            <div className="wb-preview-frame">
              {includeKeys.size > 0 ? (
                <iframe
                  // Force a remount on key changes so the iframe doesn't
                  // race against the URL update (Next dev otherwise sometimes
                  // serves the previous configuration).
                  key={previewSrc}
                  src={previewSrc}
                  width={width}
                  height={height}
                  loading="lazy"
                  title={`Preview — ${country?.name ?? slug}`}
                />
              ) : (
                <div className="wb-preview-empty">
                  Select at least one datapoint to preview.
                </div>
              )}
            </div>
          </div>

          <div className="wb-field">
            <label className="wb-label">Embed snippet</label>
            <pre className="wb-snippet">{snippet}</pre>
            <button
              type="button"
              onClick={handleCopy}
              className="wb-copy"
              aria-label="Copy embed snippet"
            >
              {copied ? (
                <>
                  <Check size={13} aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <Copy size={13} aria-hidden="true" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
