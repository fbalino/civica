import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminCounts } from "@/lib/admin/counts";
import { CivicaLogo } from "@/components/CivicaLogo";
import { AdminNav } from "./AdminNav";
import "@/app/admin.css";

export const revalidate = 0;

/**
 * Admin shell.
 *
 * One chrome for every `(admin)/*` route: a "Civica Admin" wordmark bar, a
 * sticky left nav with live count badges, and a 1200px content column. The
 * layout is a server component — it runs the session gate and fetches the nav
 * counts; the nav itself is a thin client component (active-link highlighting).
 *
 * Auth is unchanged: if there's no valid admin session the layout redirects to
 * /admin/sign-in (which lives OUTSIDE this route group, so it never triggers
 * this redirect on itself). The session semantics live in
 * `src/lib/admin/session.ts` and are deliberately untouched.
 *
 * All styling is in `.admin-*` classes (admin.css); this file composes them.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/sign-in");

  const counts = await getAdminCounts();

  return (
    <div className="admin-shell">
      <div className="admin-masthead">
        <Link href="/admin/pulse-review" className="admin-wordmark">
          <CivicaLogo size={32} />
          <span className="admin-wordmark-text">
            <span className="admin-wordmark-eyebrow">Civica</span>
            <span className="admin-wordmark-name">Admin</span>
          </span>
        </Link>

        <div className="admin-masthead-right">
          <span className="admin-reviewer">
            <span className="admin-reviewer-label">Reviewer</span>
            <span className="admin-reviewer-name">{session.reviewerId}</span>
          </span>
          <form action="/api/admin/sign-out" method="post">
            <button type="submit" className="btn btn--secondary btn--sm">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="admin-shell-grid">
        <AdminNav counts={counts} />
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
