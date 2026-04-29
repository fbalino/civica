import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { getAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

export default async function AdminSignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getAdminSession();
  if (session) redirect(params.redirect ?? "/admin/pulse-review");

  const error = params.error === "1";
  const redirectAfter = params.redirect ?? "/admin/pulse-review";

  return (
    <EditorialPage>
      <h1 className="editorial-page-title">Admin sign-in</h1>
      <p className="editorial-page-subtitle">
        Internal Pulse review queue. Operators with the ADMIN_API_KEY can
        sign in to review queued events.
      </p>

      {error ? (
        <div
          className="editorial-warning"
          role="alert"
          style={{
            background:
              "color-mix(in oklch, var(--tier-failed) 10%, var(--color-page-bg) 90%)",
            borderColor: "var(--tier-failed)",
          }}
        >
          Token did not match. Try again.
        </div>
      ) : null}

      <form
        action="/api/admin/session"
        method="post"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 480,
          marginTop: 16,
        }}
      >
        <input type="hidden" name="redirect" value={redirectAfter} />

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-11)",
            fontWeight: "var(--font-weight-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-40)",
          }}
        >
          Reviewer name
          <input
            type="text"
            name="reviewerName"
            placeholder="e.g. Fernando"
            required
            style={{
              padding: "8px 10px",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-14)",
              border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-page-bg)",
              color: "var(--color-text-primary)",
              textTransform: "none",
              letterSpacing: "0",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-11)",
            fontWeight: "var(--font-weight-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-40)",
          }}
        >
          Admin token
          <input
            type="password"
            name="token"
            autoComplete="off"
            required
            style={{
              padding: "8px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-13)",
              border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-page-bg)",
              color: "var(--color-text-primary)",
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: "8px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-12)",
            fontWeight: "var(--font-weight-mono)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            border: "1px solid var(--color-accent)",
            borderRadius: "var(--radius-sm)",
            background:
              "color-mix(in oklch, var(--color-accent) 14%, var(--color-page-bg) 86%)",
            color: "var(--color-text-primary)",
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Sign in
        </button>
      </form>
    </EditorialPage>
  );
}
