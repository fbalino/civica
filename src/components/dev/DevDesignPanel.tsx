"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEV_TOKEN_BY_VAR,
  DEV_TOKEN_GROUPS,
  DEV_TOKEN_STORAGE_KEY,
  type DevToken,
  type DevTokenType,
} from "./dev-tokens";

/*
 * DevDesignPanel — live token editor.
 *
 * Renders a right-drawer with one row per controllable token. Mutating
 * a row applies the change instantly (CSS custom property on :root)
 * AND persists it to localStorage so it survives navigation + reloads.
 *
 * The drawer is rendered into the normal DOM (no portal) and is
 * positioned fixed; the rest of the site is unaffected.
 */

type Overrides = Record<string, string>;

function readOverrides(): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DEV_TOKEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

function writeOverrides(o: Overrides) {
  try {
    window.localStorage.setItem(DEV_TOKEN_STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* quota or disabled — ignore */
  }
}

function applyToken(cssVar: string, value: string) {
  document.documentElement.style.setProperty(cssVar, value);
}

function clearToken(cssVar: string) {
  document.documentElement.style.removeProperty(cssVar);
}

/** Hex normaliser used by the color input — accepts shorthand. */
function normaliseHex(input: string): string {
  let v = input.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#([0-9a-f]{3})$/i.test(v)) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v.toUpperCase();
}

export function DevDesignPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEV_TOKEN_GROUPS.map((g) => [g.id, true])),
  );
  const [copied, setCopied] = useState(false);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    const o = readOverrides();
    setOverrides(o);
    Object.entries(o).forEach(([k, v]) => applyToken(k, v));
  }, []);

  const setOverride = (cssVar: string, value: string | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === null || value === "") {
        delete next[cssVar];
        clearToken(cssVar);
        const fallback = DEV_TOKEN_BY_VAR[cssVar]?.defaultValue;
        if (fallback) applyToken(cssVar, fallback);
      } else {
        next[cssVar] = value;
        applyToken(cssVar, value);
      }
      writeOverrides(next);
      return next;
    });
  };

  const resetSection = (groupId: string) => {
    const tokens = DEV_TOKEN_GROUPS.find((g) => g.id === groupId)?.tokens ?? [];
    setOverrides((prev) => {
      const next = { ...prev };
      tokens.forEach((t) => {
        delete next[t.cssVar];
        clearToken(t.cssVar);
        applyToken(t.cssVar, t.defaultValue);
      });
      writeOverrides(next);
      return next;
    });
  };

  const resetAll = () => {
    Object.keys(overrides).forEach(clearToken);
    DEV_TOKEN_GROUPS.forEach((g) =>
      g.tokens.forEach((t) => applyToken(t.cssVar, t.defaultValue)),
    );
    setOverrides({});
    writeOverrides({});
  };

  const exportCss = useMemo(() => {
    const rows = Object.entries(overrides);
    if (rows.length === 0) return "/* No overrides — site is using v2 defaults. */";
    const body = rows
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");
    return `:root {\n${body}\n}\n`;
  }, [overrides]);

  const copyCss = async () => {
    try {
      await navigator.clipboard.writeText(exportCss);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  if (!open) return null;

  const dirtyCount = Object.keys(overrides).length;

  return (
    <aside className="dev-panel" role="dialog" aria-label="Civica design system editor">
      <header className="dev-panel__header">
        <div className="dev-panel__title-stack">
          <span className="dev-panel__eyebrow">Civica · Dev design mode</span>
          <h2 className="dev-panel__title">Live token editor</h2>
          <span className="dev-panel__sub">
            {dirtyCount > 0
              ? `${dirtyCount} override${dirtyCount === 1 ? "" : "s"} applied`
              : "No overrides — v2 defaults"}
          </span>
        </div>
        <button
          type="button"
          className="dev-panel__close"
          aria-label="Close panel"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      <div className="dev-panel__toolbar">
        <button type="button" className="dev-panel__btn" onClick={resetAll}>
          Reset all
        </button>
        <button type="button" className="dev-panel__btn" onClick={copyCss}>
          {copied ? "Copied!" : "Copy as CSS"}
        </button>
      </div>

      <div className="dev-panel__body">
        {DEV_TOKEN_GROUPS.map((group) => (
          <section key={group.id} className="dev-panel__section">
            <button
              type="button"
              className="dev-panel__section-head"
              onClick={() =>
                setOpenSections((s) => ({ ...s, [group.id]: !s[group.id] }))
              }
            >
              <span className="dev-panel__caret" aria-hidden>
                {openSections[group.id] ? "▾" : "▸"}
              </span>
              <span className="dev-panel__section-title">{group.title}</span>
              <span
                className="dev-panel__section-reset"
                onClick={(e) => {
                  e.stopPropagation();
                  resetSection(group.id);
                }}
              >
                reset
              </span>
            </button>

            {openSections[group.id] && (
              <div className="dev-panel__rows">
                {group.tokens.map((tok) => (
                  <DevTokenRow
                    key={tok.cssVar}
                    token={tok}
                    value={overrides[tok.cssVar] ?? tok.defaultValue}
                    overridden={tok.cssVar in overrides}
                    onChange={(v) => setOverride(tok.cssVar, v)}
                    onReset={() => setOverride(tok.cssVar, null)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}

// ---------- per-row controls ----------

function DevTokenRow({
  token,
  value,
  overridden,
  onChange,
  onReset,
}: {
  token: DevToken;
  value: string;
  overridden: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="dev-row">
      <div className="dev-row__head">
        <span className="dev-row__label" title={token.cssVar}>
          {token.label}
        </span>
        {overridden && (
          <button
            type="button"
            className="dev-row__reset"
            onClick={onReset}
            aria-label={`Reset ${token.label}`}
          >
            ↺
          </button>
        )}
      </div>
      <div className="dev-row__control">
        <DevTokenInput type={token.type} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function DevTokenInput({
  type,
  value,
  onChange,
}: {
  type: DevTokenType;
  value: string;
  onChange: (v: string) => void;
}) {
  if (type === "color") {
    const isHex = /^#([0-9a-f]{6})$/i.test(value.trim());
    return (
      <div className="dev-color">
        <input
          type="color"
          className="dev-color__swatch"
          value={isHex ? value : "#000000"}
          onChange={(e) => onChange(normaliseHex(e.target.value))}
        />
        <input
          type="text"
          className="dev-color__hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v.startsWith("#")) onChange(normaliseHex(v));
          }}
          spellCheck={false}
        />
      </div>
    );
  }
  if (type === "shadow") {
    return (
      <textarea
        className="dev-input dev-input--shadow"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        spellCheck={false}
      />
    );
  }
  return (
    <input
      type="text"
      className="dev-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
    />
  );
}
