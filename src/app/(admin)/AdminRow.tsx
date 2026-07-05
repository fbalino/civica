"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A table row whose ENTIRE area navigates to `href` on click — the admin
 * queues are triage lists where clicking anywhere on an event must open it.
 * The first cell still holds a real <Link> (keyboard focus, cmd/middle-click
 * to open in a new tab); this handler only adds mouse-anywhere navigation,
 * and ignores clicks that land on a genuine interactive child (link, button,
 * form control, provenance dot) so those keep their own behavior.
 */
export function AdminRow({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className="admin-row"
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            "a, button, input, select, textarea, [role='button'], [role='img']"
          )
        ) {
          return;
        }
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
