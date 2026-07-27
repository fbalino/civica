import type { Metadata } from "next";
import { ConditionsReleaseExplorer } from "@/components/conditions/ConditionsReleaseExplorer";
import { getConditionsPublicRelease } from "@/lib/db/queries";
import { withOg } from "@/lib/og";
import { ResearchArtifactPolicyLinks } from "@/components/policy/ResearchArtifactPolicyLinks";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Civica Conditions — Material Conditions by Country",
  description:
    "Versioned source-native material indicators, with component years, provenance, and explicit coverage.",
  alternates: { canonical: "https://civicaatlas.org/civica-conditions" },
  openGraph: withOg({
    title: "Civica Conditions — Material Conditions by Country · Civica Atlas",
    description:
      "Versioned source-native material indicators, with component years, provenance, and explicit coverage.",
    url: "https://civicaatlas.org/civica-conditions",
  }),
};

export default async function CivicaConditionsPage({
  searchParams,
}: {
  searchParams: Promise<{ release?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedReleaseId =
    typeof params.release === "string" ? params.release : undefined;
  let release = null;
  let unavailableReason: string | undefined;
  try {
    release = await getConditionsPublicRelease(requestedReleaseId);
    if (!release) {
      unavailableReason = requestedReleaseId
        ? `The requested Conditions release (${requestedReleaseId}) is not available.`
        : undefined;
    }
  } catch {
    unavailableReason = "The versioned Conditions release is not available yet.";
  }

  return (
    <>
      <ConditionsReleaseExplorer release={release} unavailableReason={unavailableReason} />
      <div className="editorial-page editorial-page--full">
        <ResearchArtifactPolicyLinks anchors={["known-limitations", "corrections"]} />
      </div>
    </>
  );
}
