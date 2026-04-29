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

export function TableHeader({
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }) {
  return <thead {...props}>{children}</thead>;
}

export function TableRow({
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
  return <tr {...props}>{children}</tr>;
}
