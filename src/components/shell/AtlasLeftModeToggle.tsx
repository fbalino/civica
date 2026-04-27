import Link from "next/link";

export type AtlasLeftMode = "countries" | "organizations";

/**
 * Phase A.5 — Two-button toggle in the Atlas left rail header.
 * Replaces the legacy `setLeftMode` state from the deleted AtlasApp.tsx
 * with a pair of <Link>s — selecting Organizations navigates to
 * /atlas/organizations/un (default), selecting Countries navigates to
 * /atlas (the map root).
 */
export function AtlasLeftModeToggle({ mode }: { mode: AtlasLeftMode }) {
  return (
    <div className="left-mode-toggle" style={{ marginTop: 10 }}>
      <Link
        href="/atlas"
        className={mode === "countries" ? "on" : ""}
        prefetch={false}
      >
        Countries
      </Link>
      <Link
        href="/atlas/organizations/un"
        className={mode === "organizations" ? "on" : ""}
        prefetch={false}
      >
        Organizations
      </Link>
    </div>
  );
}
