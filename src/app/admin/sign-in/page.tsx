import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CivicaLogo } from "@/components/CivicaLogo";
import { Banner } from "@/components/editorial/Banner";
import { getAdminSession } from "@/lib/admin/session";
import { isGoogleSignInConfigured } from "@/lib/admin/google-oauth";
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
 * mark, canonical rounded inputs, and a primary Button. The form POSTs a
 * username + password to /api/admin/session, which constant-time-verifies the
 * username against ADMIN_USERNAME and the password against the salted scrypt
 * hash in ADMIN_PASSWORD_HASH, then sets the HttpOnly session cookie. On a bad
 * credential that route redirects back here with ?error=1, surfaced via the
 * danger Banner.
 *
 * When Google sign-in is configured (GOOGLE_CLIENT_ID/SECRET +
 * ADMIN_GOOGLE_EMAIL all set), a second "Sign in with Google" option appears
 * below the form. It's an alternate door into the SAME single-owner admin
 * session, not a new account type — see src/lib/admin/google-oauth.ts.
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
  const googleError = params.error === "google";
  const redirectAfter = safeInternalPathOr(
    params.redirect,
    "/admin/pulse-review",
  );
  const googleConfigured = isGoogleSignInConfigured();

  return (
    <div className="admin-signin-wrap">
      <div className="admin-signin-card">
        <div className="admin-signin-brand">
          <CivicaLogo size={44} />
          <span className="admin-signin-eyebrow">Civica Admin</span>
          <h1 className="admin-signin-title">Sign in</h1>
        </div>

        <p className="admin-signin-lede">
          Operator access to the review queues. Sign in with your admin username
          and password to triage Pulse events, data disputes, applications, and
          messages.
        </p>

        {error ? (
          <Banner variant="danger" className="admin-signin-error">
            That username or password did not match. Check your credentials and
            try again.
          </Banner>
        ) : null}

        {googleError ? (
          <Banner variant="danger" className="admin-signin-error">
            That Google account isn&rsquo;t authorized for admin access.
          </Banner>
        ) : null}

        <form
          action="/api/admin/session"
          method="post"
          className="admin-signin-form"
        >
          <input type="hidden" name="redirect" value={redirectAfter} />

          <div className="admin-field">
            <label className="admin-field-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="admin-input"
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>

          <div className="admin-field">
            <label className="admin-field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="admin-input"
              type="password"
              name="password"
              autoComplete="current-password"
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

        {googleConfigured ? (
          <>
            <div className="admin-signin-divider" role="separator">
              <span>or</span>
            </div>

            <a
              href={`/api/admin/google/start?redirect=${encodeURIComponent(redirectAfter)}`}
              className="btn btn--secondary admin-signin-google"
            >
              <span>Sign in with Google</span>
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
