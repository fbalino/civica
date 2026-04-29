import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  dek?: ReactNode;
}

export function SectionHeader({ eyebrow, title, dek }: SectionHeaderProps) {
  return (
    <header className="editorial-section-header">
      {eyebrow ? <span className="editorial-eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {dek ? <p>{dek}</p> : null}
    </header>
  );
}
