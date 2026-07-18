import type { ReactNode } from "react";

/**
 * Structural wrapper for triage-list rows. The first cell contains the real
 * destination link, which keeps row navigation discoverable and keyboard
 * operable rather than turning a table row into a mouse-only pseudo-button.
 */
export function AdminRow({
  children,
}: {
  children: ReactNode;
}) {
  return <tr className="admin-row">{children}</tr>;
}
