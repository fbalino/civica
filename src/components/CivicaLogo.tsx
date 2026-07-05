import fs from "node:fs";
import path from "node:path";

// The Civica mark is a highly detailed vector export (~228 KB, 463 <path>
// elements). Inlining the full geometry at every render put ~3 copies on every
// page (header logo + header small logo + footer logo) — roughly 686 KB of
// duplicated markup per view. Instead the geometry is emitted ONCE per document
// as a hidden <symbol> (<CivicaLogoSprite>, mounted at the top of <body> in the
// root layout), and each <CivicaLogo> renders a tiny <use> reference to it.

const SYMBOL_ID = "civica-logo-symbol";

let cachedSymbol: string | null = null;

/**
 * Build the reusable <symbol> body from the source file. The raw asset is a
 * standalone <svg> with its own <style> block and width/height; we convert the
 * root element to a <symbol> (keeping viewBox for scaling) and drop the inline
 * <style> — the `--logo-fg` / `--logo-bg` tokens the paths reference are defined
 * globally in globals.css, so theming still works.
 */
function loadLogoSymbol(): string {
  if (cachedSymbol) return cachedSymbol;
  const raw = fs.readFileSync(
    path.join(process.cwd(), "public", "civica-logo.svg"),
    "utf8",
  );
  cachedSymbol = raw
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    // Root <svg ...attrs...> → <symbol id=... ...attrs...>; keep viewBox etc.
    .replace(/<svg\b([^>]*)>/, `<symbol id="${SYMBOL_ID}"$1>`)
    .replace(/<\/svg>\s*$/, "</symbol>");
  return cachedSymbol;
}

/**
 * Renders the shared logo geometry exactly once per document. Mount this near
 * the top of <body> (root layout) BEFORE any <CivicaLogo> instances. The sprite
 * SVG is visually hidden and removed from the accessibility tree; the visible
 * logos are the <use>-referencing instances.
 */
export function CivicaLogoSprite() {
  const symbol = loadLogoSymbol();
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={0}
      height={0}
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: symbol }}
    />
  );
}

type Props = {
  size?: number;
  title?: string;
  className?: string;
};

export function CivicaLogo({ size = 28, title = "Civica", className }: Props) {
  return (
    <span
      role="img"
      aria-label={title}
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1024 1024"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <use href={`#${SYMBOL_ID}`} />
      </svg>
    </span>
  );
}
