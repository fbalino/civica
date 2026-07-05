import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CivicaLogo } from "@/components/CivicaLogo";
import { Banner } from "@/components/editorial/Banner";
import { getAdminSession } from "@/lib/admin/session";
import "@/app/admin.css";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

/**
 * Admin sign-in.
 *
 * A centered card (hairline border, --radius-lg, soft shadow) with the Civica
 * mark, canonical rounded inputs, and a primary Button. The auth flow is
 * unchanged underneath: the form POSTs the reviewer name + ADMIN_API_KEY to
 * /api/admin/session, which constant-time-verifies the token and sets the
 * HttpOnly session cookie. On a bad token that route redirects back here with
 * ?error=1, surfaced via the danger Banner.
 *
 * This page sits OUTSIDE the (admin) route group so it doesn't inherit the
 * admin shell (or its session redirect). It imports admin.css directly for the
 * card classes.
 */
export default async function AdminSignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getAdminSession();
  if (session) redirect(params.redirect ?? "/admin/pulse-review");

  const error = params.error === "1";
  const redirectAfter =
    params.redirect && params.redirect.startsWith("/")
      ? params.redirect
      : "/admin/pulse-review";

  return (
    <div className="admin-signin-wrap">
      <div className="admin-signin-card">
        <div className="admin-signin-brand">
          <CivicaLogo size={44} />
          <span className="admin-signin-eyebrow">Civica Admin</span>
          <h1 className="admin-signin-title">Sign in</h1>
        </div>

        <p className="admin-signin-lede">
          Operator access to the review queues. Sign in with the shared admin
          key to triage Pulse events, data disputes, applications, and
          messages.
        </p>

        {error ? (
          <Banner variant="danger" className="admin-signin-error">
            That admin key did not match. Check the key and try again.
          </Banner>
        ) : null}

        <form
          action="/api/admin/session"
          method="post"
          className="admin-signin-form"
        >
          <input type="hidden" name="redirect" value={redirectAfter} />

          <div className="admin-field">
            <label className="admin-field-label" htmlFor="reviewerName">
              Reviewer name
            </label>
            <input
              id="reviewerName"
              className="admin-input"
              type="text"
              name="reviewerName"
              placeholder="e.g. Fernando"
              autoComplete="name"
              required
            />
          </div>

          <div className="admin-field">
            <label className="admin-field-label" htmlFor="token">
              Admin key
            </label>
            <input
              id="token"
              className="admin-input"
              type="password"
              name="token"
              autoComplete="off"
              required
            />
          </div>

          <button type="submit" className="btn btn--primary">
            <span>Sign in</span>
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
