import type { ReactNode } from "react";

interface EditorialPageProps {
  children: ReactNode;
  className?: string;
  breadcrumbs?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
}

export function EditorialPage({
  children,
  className = "editorial-page",
  breadcrumbs,
  title,
  meta,
  footer,
}: EditorialPageProps) {
  return (
    <div className={className}>
      {breadcrumbs ? <nav className="editorial-breadcrumbs">{breadcrumbs}</nav> : null}
      {title || meta ? (
        <header className="editorial-header">
          {title ? <h1>{title}</h1> : null}
          {meta ? <div className="editorial-meta">{meta}</div> : null}
        </header>
      ) : null}
      {children}
      {footer ? <footer className="editorial-footer">{footer}</footer> : null}
    </div>
  );
}
