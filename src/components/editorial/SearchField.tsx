import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

/** Canonical, reusable text-search control for non-country directories. */
export function SearchField({
  label,
  className,
  ...props
}: SearchFieldProps) {
  return (
    <label
      className={[
        "editorial-search-field",
        className,
      ].filter(Boolean).join(" ")}
    >
      <span className="sr-only">{label}</span>
      <Search className="editorial-search-field__icon" aria-hidden />
      <input type="search" aria-label={label} {...props} />
    </label>
  );
}
