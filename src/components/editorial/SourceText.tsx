import { Chip } from "./Pill";

type SourceTextProps = {
  children: string;
  languageTag: string;
  label?: string;
  className?: string;
};

export function SourceText({
  children,
  languageTag,
  label,
  className,
}: SourceTextProps) {
  return (
    <span className={["source-text", className].filter(Boolean).join(" ")}>
      <bdi dir="auto" lang={languageTag} className="source-text__value">
        {children}
      </bdi>
      {label ? <Chip variant="neutral">{label}</Chip> : null}
    </span>
  );
}
