import type { ReactNode } from "react";

type EditorialWidth = "narrow" | "wide" | "full";

interface EditorialPageProps {
  children: ReactNode;
  /**
   * Layout width. Maps to the global modifier classes defined in
   * `src/app/editorial.css`:
   *   narrow → max-width 760px (short-form editorial / blog posts)
   *   wide   → max-width 960px (changelog/list surfaces)
   *   full   → max-width 1200px (atlas-scale layouts, no sidebar)
   *
   * IMPORTANT — read DESIGN.md before picking a width. Methodology
   * pages do NOT use any of these widths; they use
   * `<EditorialPage className="methodology-layout">` paired with a
   * `<ReaderSidebar>` and an `<article className="methodology-content">`.
   * This component's width prop is for non-methodology editorial pages
   * only. See DESIGN.md → "Picking the layout" for the decision table.
   *
   * Do not default to "narrow" because prose is long. Long methodology
   * prose still uses the methodology-layout. The narrow column is for
   * short-form editorial / blog posts.
   */
  width?: EditorialWidth;
  /**
   * Override the wrapper className entirely. When set, the default
   * `editorial-page` class and `width` modifier are NOT applied —
   * legacy pages that ship their own layout pass their custom class
   * here for backwards compatibility.
   */
  className?: string;
  breadcrumbs?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
}

export function EditorialPage({
  children,
  width = "narrow",
  className,
  breadcrumbs,
  title,
  meta,
  footer,
}: EditorialPageProps) {
  const widthClass =
    width === "wide"
      ? " editorial-page--wide"
      : width === "full"
        ? " editorial-page--full"
        : "";
  const wrapClass = className ?? `editorial-page${widthClass}`;

  return (
    <div className={wrapClass}>
      {breadcrumbs ? (
        <nav className="editorial-breadcrumbs">{breadcrumbs}</nav>
      ) : null}
      {title || meta ? (
        <header className="editorial-header">
          {title ? <h1 className="editorial-page-title">{title}</h1> : null}
          {meta ? <div className="editorial-meta">{meta}</div> : null}
        </header>
      ) : null}
      {children}
      {footer ? (
        <footer className="editorial-footer-nav">{footer}</footer>
      ) : null}
    </div>
  );
}
