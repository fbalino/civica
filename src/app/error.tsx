"use client";

/**
 * PLT-026 — route-segment error boundary.
 *
 * An uncaught error in a server component (e.g. a database/query/service
 * failure) renders here with an HTTP 500 status — transient and NOT indexable,
 * unlike a 404. This is the boundary that stops a DB outage from turning every
 * country page into a cacheable, indexable "not found". A genuinely absent
 * entity still calls `notFound()` and renders the branded 404 instead.
 */
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/editorial/Button";
import { reportClientBoundaryError } from "@/lib/platform/error-monitoring-client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Never serialize an error message, stack, or digest from the browser.
    // The monitor retains only the route template and closed boundary code.
    reportClientBoundaryError("route_boundary");
  }, [error]);

  return (
    // Not a <main>: the root layout already provides the page's single main
    // landmark (src/app/layout.tsx), so this route-segment error boundary is
    // a <div>.
    <div className="editorial-page">
      <section className="editorial-section" aria-labelledby="error-title">
        <span className="editorial-eyebrow">Temporary problem</span>
        <h1 id="error-title" className="page-heading">
          This page didn&rsquo;t load.
        </h1>
        <p>
          Something went wrong on our side — this is a temporary error, not a
          missing page. Please try again in a moment.
          {error.digest ? <> Reference <code>{error.digest}</code>.</> : null}
        </p>
        <div className="editorial-footer-nav">
          <Button onClick={() => reset()}>Try again</Button>
          <Link href="/">Return home</Link>
        </div>
      </section>
    </div>
  );
}
