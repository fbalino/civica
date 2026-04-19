import fs from "node:fs";
import path from "node:path";

let cachedSvg: string | null = null;

function loadLogoSvg(): string {
  if (cachedSvg) return cachedSvg;
  const raw = fs.readFileSync(
    path.join(process.cwd(), "public", "civica-logo.svg"),
    "utf8",
  );
  cachedSvg = raw
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace(
      /<svg\b/,
      '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"',
    );
  return cachedSvg;
}

type Props = {
  size?: number;
  title?: string;
  className?: string;
};

export function CivicaLogo({ size = 28, title = "Civica", className }: Props) {
  const svg = loadLogoSvg();
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
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
