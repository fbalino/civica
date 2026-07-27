import type { Metadata } from "next";
import Link from "next/link";
import { CivicaLogo } from "@/components/CivicaLogo";
import { Banner } from "@/components/editorial/Banner";
import "@/app/admin.css";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Independent coding sign in — Civica",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function PulseCodingSignInPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return (
    // Not a <main>: the root layout already provides the page's single main
    // landmark (src/app/layout.tsx), so this sign-in page is a <div> — same
    // pattern as the owner sign-in page (src/app/admin/sign-in/page.tsx).
    <div className="admin-signin-wrap">
      <section className="admin-signin-card" aria-labelledby="coding-signin-title">
        <div className="admin-signin-brand">
          <CivicaLogo size={36} />
          <span className="admin-signin-eyebrow">Civica Pulse</span>
          <h1 id="coding-signin-title" className="admin-signin-title">
            Independent coding
          </h1>
        </div>
        <p className="admin-signin-lede">
          Enter the private access code issued for your pseudonymous coder or
          adjudicator role. This workspace never exposes production labels,
          model votes, owner decisions, or another coder&apos;s submission.
        </p>
        {/* EXP-034: tabIndex + autoFocus move focus to the error banner on
            load (server-rendered POST-and-reload form, so the native
            `autofocus` HTML attribute does the work, not JS) — same pattern
            as src/app/admin/sign-in/page.tsx. */}
        {error ? (
          <div role="alert" id="coding-signin-error" tabIndex={-1} autoFocus>
            <Banner variant="danger" className="admin-signin-error">
              The access code is invalid, expired, or revoked.
            </Banner>
          </div>
        ) : null}
        <form action="/api/pulse-coding/session" method="post" className="admin-signin-form">
          <div className="admin-field">
            <label className="admin-field-label" htmlFor="access-code">
              Access code
            </label>
            <input
              className="admin-input"
              id="access-code"
              name="accessCode"
              type="password"
              autoComplete="one-time-code"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "coding-signin-error" : undefined}
            />
          </div>
          <button type="submit" className="btn btn--primary">
            Enter workspace <span className="btn__arrow" aria-hidden>→</span>
          </button>
        </form>
        <p className="admin-signin-lede coding-signin-footnote">
          Site administrators can use the separate <Link href="/admin/sign-in">owner sign-in</Link>.
        </p>
      </section>
    </div>
  );
}
