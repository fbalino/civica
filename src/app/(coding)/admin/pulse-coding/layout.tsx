import Link from "next/link";
import { redirect } from "next/navigation";
import { CivicaLogo } from "@/components/CivicaLogo";
import { Chip } from "@/components/editorial/Pill";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import { CodingNav } from "./CodingNav";
import "@/app/admin.css";

export default async function PulseCodingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPulseCodingSession();
  if (!session) redirect("/admin/pulse-coding/sign-in");

  return (
    <div className="admin-shell coding-shell">
      <div className="admin-masthead">
        <Link href="/admin/pulse-coding" className="admin-wordmark">
          <CivicaLogo size={32} />
          <span className="admin-wordmark-text">
            <span className="admin-wordmark-eyebrow">Civica Pulse</span>
            <span className="admin-wordmark-name">Independent coding</span>
          </span>
        </Link>
        <div className="admin-masthead-right">
          <Chip variant={session.useStatus === "dry_run_not_gold" ? "warn" : "blue"}>
            {session.useStatus === "dry_run_not_gold"
              ? "Dry run — not gold"
              : "Evaluation candidate"}
          </Chip>
          <span className="admin-reviewer">
            <span className="admin-reviewer-label">{session.role}</span>
            <span className="admin-reviewer-name">{session.pseudonym}</span>
          </span>
          {session.kind === "participant" ? (
            <form action="/api/pulse-coding/sign-out" method="post">
              <button type="submit" className="btn btn--secondary btn--sm">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/admin/pulse-review" className="btn btn--secondary btn--sm">
              Production admin
            </Link>
          )}
        </div>
      </div>
      <div className="admin-shell-grid">
        <CodingNav role={session.role} />
        {/* Not a <main>: the root layout already provides the page's single
            main landmark (src/app/layout.tsx) — same pattern as the
            production admin shell (src/app/(admin)/layout.tsx). */}
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
