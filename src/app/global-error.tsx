"use client";

/**
 * PLT-026 — root error boundary. Replaces the whole document (including the
 * root layout) when the layout itself throws, so it must render its own
 * <html>/<body>. Kept minimal and inline-styled with design tokens because no
 * app CSS or providers are guaranteed to have loaded at this point. Carries a
 * robots noindex so a transient failure is never indexed.
 */
import { useEffect } from "react";
import { reportClientBoundaryError } from "@/lib/platform/error-monitoring-client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Never serialize an error message, stack, or digest from the browser.
    // The monitor retains only the route template and closed boundary code.
    reportClientBoundaryError("global_boundary");
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <title>Temporary problem — Civica Atlas</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--color-page-bg)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-body, ui-sans-serif, system-ui, sans-serif)",
        }}
      >
        <main style={{ maxWidth: "32rem", padding: "2rem", textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading, Georgia, serif)",
              fontSize: "1.75rem",
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong.
          </h1>
          <p style={{ lineHeight: 1.5, opacity: 0.85 }}>
            This is a temporary error, not a missing page. Please try again.
            {error.digest ? ` Reference ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.25rem",
              padding: "0.6rem 1.25rem",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              background: "var(--color-ink-navy)",
              color: "var(--color-page-bg)",
              fontSize: "1rem",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
