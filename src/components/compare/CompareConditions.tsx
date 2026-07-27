import Link from "next/link";

import { Banner } from "@/components/editorial/Banner";
import { CivicaConditionsPanel } from "@/components/conditions/CivicaConditionsPanel";
import type { ConditionsPublicRelease } from "@/lib/conditions/public-release";

import { CompareColumnHeader } from "./CompareColumnHeader";

export interface CompareConditionsProps {
  countries: Array<{
    jurisdiction: { id: string; slug: string; name: string; iso2: string | null };
    seriesColor: string;
  }>;
  release: ConditionsPublicRelease | null;
  releaseUnavailable?: boolean;
}

/**
 * Side-by-side view of a single immutable Conditions release. It deliberately
 * reuses the country panel so the comparison cannot drop component units,
 * reference years, source names, or missingness decisions.
 */
export function CompareConditions({
  countries,
  release,
  releaseUnavailable = false,
}: CompareConditionsProps) {
  if (countries.length === 0) return null;

  const releaseHref = release
    ? `/civica-conditions?release=${encodeURIComponent(release.release.releaseId)}`
    : "/civica-conditions";

  if (!release) {
    return (
      <>
        <Banner variant="info">
          Values here will be source-native components from one Conditions
          release. Reference years can differ across countries or conditions;
          Civica will not normalize, rank, or combine them here.
        </Banner>
        {releaseUnavailable ? (
          <Banner variant="warn">
            Conditions comparison is temporarily unavailable. A data outage
            does not mean that no versioned release exists.
          </Banner>
        ) : (
          <p className="editorial-empty">
            No versioned Conditions release is currently available for comparison.
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <Banner variant="info">
        Values below are source-native components from one Conditions release.
        Reference years can differ across countries or conditions; Civica does
        not normalize, rank, or combine them here.
      </Banner>
      <p className="editorial-tool-dek">
        Release {release.release.releaseId} · {release.release.methodologyVersion}
        {" · "}
        <Link href={releaseHref}>inspect the full release</Link>
        {" or "}
        <Link href="/civica-conditions/methodology">read the codebook</Link>.
      </p>
      <div className="conditions-country-grid">
        {countries.map((country) => (
          <div key={country.jurisdiction.id}>
            <CompareColumnHeader
              slug={country.jurisdiction.slug}
              name={country.jurisdiction.name}
              iso2={country.jurisdiction.iso2}
              seriesColor={country.seriesColor}
            />
            <CivicaConditionsPanel
              jurisdictionId={country.jurisdiction.id}
              release={release}
              showHeading={false}
              stacked
            />
          </div>
        ))}
      </div>
    </>
  );
}
