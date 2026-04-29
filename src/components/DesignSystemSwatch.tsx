interface DesignSystemSwatchProps {
  label: string;
  bg: string;
  fg?: string;
}

/**
 * Documentation-only primitive for literal color swatches.
 * Raw color literals are allowed here so /design-system can show fixed palettes.
 */
export function DesignSystemSwatch({
  label,
  bg,
  fg = "inherit",
}: DesignSystemSwatchProps) {
  return (
    <div className="slot" style={{ background: bg, color: fg }}>
      {label}
    </div>
  );
}
