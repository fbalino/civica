// The Civica mark is served as one static, browser-cached file
// (`public/brand/civica-logo-mask.svg`) and painted through a CSS mask, so no
// page ships the mark's geometry in its HTML or RSC payload. The `.civica-logo`
// class in globals.css fills the mask with `--logo-fg`, which keeps the mark
// themed in light and dark mode. The mask is derived from the master artwork
// `public/civica-logo.svg`; see DESIGN.md "Civica logo".

export const CIVICA_LOGO_MASK_URL = "/brand/civica-logo-mask.svg";

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
      className={className ? `civica-logo ${className}` : "civica-logo"}
      style={{ width: size, height: size }}
    />
  );
}
