export const INDEX_QUARANTINE_VERSION = "civica-index-public-disposition/v2";

export interface IndexQuarantineSurfaces {
  desktopNavigation: string;
  mobileNavigation: string;
  indexLanding: string;
  home: string;
  countryData: string;
  compare: string;
  rankings: string;
  embed: string;
  generalCountryApi: string;
  auxiliaryCountryScores: string;
  apiDeprecation: string;
  apiSummaries: readonly { pathTemplate: string; summary: string }[];
  atlasLoader: string;
  atlasLayers: string;
  atlasRelease: string;
  sitemap: string;
  rightsManifest: string;
  publicClaims: readonly { id: string; tier: string; exactClaim: string }[];
}

const REQUIRED_CLAIMS = [
  "home.visible-positioning",
  "home.secondary-research",
  "index.public-disposition",
  "citation.index-estimate",
  "embeds.retired-index",
] as const;

export function indexQuarantineErrors(surface: IndexQuarantineSurfaces): string[] {
  const errors: string[] = [];
  if (!surface.desktopNavigation.includes("Governance Evidence")) errors.push("desktop navigation does not lead with Governance Evidence");
  if (!surface.mobileNavigation.includes("Governance Evidence")) errors.push("mobile navigation does not lead with Governance Evidence");
  for (const phrase of ["Current public disposition", "Governance Evidence Dashboard", "Composite research", "fails the original-information test"]) {
    if (!surface.indexLanding.includes(phrase)) errors.push(`Index status page omits disposition phrase: ${phrase}`);
  }
  if (surface.home.includes("getCIRankings") || surface.home.includes("home-index-score")) errors.push("homepage still renders the composite leaderboard");
  const homeLower = surface.home.toLowerCase();
  if (!homeLower.includes("source-native dashboard") && !homeLower.includes("source-native evidence")) errors.push("homepage omits source-native evidence posture");
  if (surface.countryData.includes("CivicaIndexPanel") || !surface.countryData.includes("GovernanceEvidenceTable")) errors.push("country data page does not use source-native evidence");
  if (surface.compare.includes("CompareCivicaIndex") || !surface.compare.includes("GovernanceEvidenceTable")) errors.push("compare page still exposes the composite");
  if (surface.rankings.includes("civica_index") || surface.rankings.includes("governance_quality")) errors.push("rankings table still exposes derived Index columns");
  if (!surface.embed.includes("status: 410") || surface.embed.includes("getCICountryDetail")) errors.push("legacy embed does not fail closed without score data");
  if (surface.generalCountryApi.includes("civicaIndex:") || surface.generalCountryApi.includes("getCICountryDetail")) errors.push("general country API still bundles the composite");
  if (
    surface.auxiliaryCountryScores.includes("buildCivicaIndexRow") ||
    surface.auxiliaryCountryScores.includes('id: "civica-index"') ||
    surface.auxiliaryCountryScores.includes("ciCompositeScores")
  ) errors.push("auxiliary country scores still bundle the composite");
  for (const field of ["INDEX_COMPOSITE_SUNSET_DATE", "retiredIndexApiResponse", "status: 410"]) if (!surface.apiDeprecation.includes(field)) errors.push(`API retirement contract omits ${field}`);
  const indexRoutes = surface.apiSummaries.filter((route) => route.pathTemplate.startsWith("/api/v1/index/"));
  if (indexRoutes.length !== 6) errors.push("API registry does not contain the six sunset Index routes");
  for (const route of indexRoutes) if (!/^DEPRECATED/i.test(route.summary)) errors.push(`${route.pathTemplate} summary is not deprecated`);
  for (const forbidden of ["ciCompositeScores", "CURRENT_CI_METHODOLOGY_VERSION", "ciScore"]) if (surface.atlasLoader.includes(forbidden)) errors.push(`Atlas loader still depends on ${forbidden}`);
  if (surface.atlasLayers.includes('value: "ci"') || surface.atlasLayers.includes('case "ci"')) errors.push("Atlas still offers a composite choropleth");
  if (!surface.atlasRelease.includes("Civica Index, Pulse") || !surface.atlasRelease.includes("excluded")) errors.push("Atlas release does not exclude Index outputs explicitly");
  if (surface.sitemap.includes('/civica-index/widget"') || surface.sitemap.includes('/civica-index/government-types"')) errors.push("sitemap still advertises retired composite pages");
  if (!surface.rightsManifest.includes('productId: "index-bulk-release"') || !surface.rightsManifest.includes('publicBulkExport: "blocked"')) errors.push("Index bulk release is not blocked");
  for (const id of REQUIRED_CLAIMS) {
    const claim = surface.publicClaims.find((row) => row.id === id);
    if (!claim) errors.push(`public claim registry omits ${id}`);
  }
  return errors;
}
