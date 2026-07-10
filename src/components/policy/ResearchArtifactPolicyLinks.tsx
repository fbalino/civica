import Link from "next/link";
import type { PolicyAnchor } from "@/lib/policy/research-artifacts";

const ANCHOR_LABELS: Record<PolicyAnchor, string> = {
  corrections: "Corrections policy",
  retractions: "Retraction policy",
  versioning: "Versioning policy",
  "known-limitations": "Known limitations",
  "data-api-corrections": "Data & API corrections",
  notification: "Notification policy",
};

interface ResearchArtifactPolicyLinksProps {
  anchors: readonly PolicyAnchor[];
}

/**
 * Link-only mirror for a research-artifact page that has no existing
 * footer-nav area of its own. Composed only from the site's existing
 * `.editorial-footer-nav` styles (CLM-016) — never restates policy
 * body prose, only links to `/policies#anchor`.
 */
export function ResearchArtifactPolicyLinks({
  anchors,
}: ResearchArtifactPolicyLinksProps) {
  return (
    <footer className="editorial-footer-nav">
      {anchors.map((anchor) => (
        <Link key={anchor} href={`/policies#${anchor}`}>
          {ANCHOR_LABELS[anchor]}
        </Link>
      ))}
    </footer>
  );
}
