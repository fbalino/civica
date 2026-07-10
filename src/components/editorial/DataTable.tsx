import type { HTMLAttributes, ReactNode } from "react";

export function DataTable({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  // The canonical `editorial-data-table` styling (cell padding, hairline
  // borders, header typography) is ALWAYS applied; a caller-supplied
  // className is additive, never a replacement — otherwise a page-level
  // class silently strips the whole table system (bit the admin tables).
  return (
    <div className="editorial-table-scroll editorial-table-scroll--wrap">
      <table
        className={
          className
            ? `editorial-data-table ${className}`
            : "editorial-data-table"
        }
        {...props}
      >
        {children}
      </table>
    </div>
  );
}
