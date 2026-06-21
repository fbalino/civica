import type { HTMLAttributes, ReactNode } from "react";

export function DataTable({
  children,
  ...props
}: HTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <table className="editorial-data-table" {...props}>
      {children}
    </table>
  );
}

