import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin/session";

/**
 * Phase 5.7 — admin chrome.
 *
 * Wraps every (admin)/* route with a thin status bar and a session
 * check. If no admin session is present, the layout redirects to
 * /admin/sign-in (which lives OUTSIDE the (admin) route group so it
 * doesn't trigger this redirect itself).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/sign-in");

  return (
    <div>
      <div
        style={{
          background: "var(--color-card-bg)",
          borderBottom: "1px solid var(--color-card-border)",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-11)",
          fontWeight: "var(--font-weight-mono)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-text-40)",
        }}
      >
        <div style={{ display: "inline-flex", gap: 16, alignItems: "center" }}>
          <Link
            href="/admin/pulse-review"
            style={{
              color: "var(--color-status-warning)",
              textDecoration: "none",
            }}
          >
            Pulse review
          </Link>
          <span aria-hidden style={{ color: "var(--color-text-40)" }}>
            ·
          </span>
          <Link
            href="/admin/data-disputes"
            style={{
              color: "var(--color-text-60)",
              textDecoration: "none",
            }}
          >
            Data disputes
          </Link>
          <span aria-hidden style={{ color: "var(--color-text-40)" }}>
            ·
          </span>
          <Link
            href="/admin/data-disputes/audit"
            style={{
              color: "var(--color-text-60)",
              textDecoration: "none",
            }}
          >
            Audit log
          </Link>
        </div>
        <div
          style={{
            display: "inline-flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <span>Reviewer: {session.reviewerId}</span>
          <form action="/api/admin/sign-out" method="post">
            <button
              type="submit"
              style={{
                padding: "4px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-11)",
                fontWeight: "var(--font-weight-mono)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-page-bg)",
                color: "var(--color-text-60)",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
