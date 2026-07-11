import report from "../src/lib/provenance/domain-coverage.generated.json";
import {
  DOMAIN_IDS,
  validateDomainCoverageReport,
  type DomainCoverageReport,
} from "../src/lib/provenance/domain-coverage";

const checked = report as DomainCoverageReport;
validateDomainCoverageReport(checked);

for (const domain of checked.domains) {
  if (!domain.completeness.length) throw new Error(`${domain.id} has no field-completeness measures`);
  if (!domain.sources.length) throw new Error(`${domain.id} has no source-family disclosure`);
  if (!domain.threshold.countryCoverageWarnBelow || !domain.threshold.fieldCompletenessWarnBelow || !domain.threshold.staleAfterDays) {
    throw new Error(`${domain.id} has incomplete alert thresholds`);
  }
}

console.log("=== DAT-020 domain source coverage ===\n");
console.log(`Domains: ${checked.domains.length}/${DOMAIN_IDS.length}`);
console.log(`Current: ${checked.summary.current}`);
console.log(`Attention: ${checked.summary.attention}`);
console.log(`Alerts: ${checked.summary.alerts}`);
console.log("\nPASS — domain closure, counts, freshness, completeness, sources, gaps, and alerts agree.");
