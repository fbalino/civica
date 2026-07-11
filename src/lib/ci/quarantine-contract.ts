export const INDEX_QUARANTINE_VERSION = "civica-index-quarantine/v1";

export interface IndexQuarantineSurfaces {
  desktopNavigation: string;
  mobileNavigation: string;
  indexLanding: string;
  apiHelpers: string;
  apiSummaries: readonly { pathTemplate: string; summary: string }[];
  atlasLoader: string;
  atlasRelease: string;
  rightsManifest: string;
  publicClaims: readonly { id: string; tier: string; exactClaim: string }[];
}

const REQUIRED_CLAIMS = [
  "home.visible-positioning",
  "home.secondary-research",
  "index.composite-estimate",
  "about.metadata-positioning",
  "citation.index-estimate",
] as const;

export function indexQuarantineErrors(surface: IndexQuarantineSurfaces): string[] {
  const errors: string[] = [];
  if (!surface.desktopNavigation.includes("Index · Beta")) errors.push("desktop navigation does not mark the Index Beta");
  if (!surface.mobileNavigation.includes('descriptor: "Civica Index (beta)"')) errors.push("mobile navigation does not mark the Index Beta");
  for (const phrase of ["A research-beta governance composite.", "A secondary research experiment", "has not completed independent review", "No country grades"]) if (!surface.indexLanding.includes(phrase)) errors.push(`Index landing omits quarantine phrase: ${phrase}`);
  for (const field of ['standing: "secondary_research_experiment"', "independent_validation: false", "atlas_dependency: false"]) if (!surface.apiHelpers.includes(field)) errors.push(`API methodology metadata omits ${field}`);
  const indexRoutes = surface.apiSummaries.filter((route) => route.pathTemplate.startsWith("/api/v1/index/"));
  if (indexRoutes.length === 0) errors.push("API registry has no Index routes");
  for (const route of indexRoutes) if (!/research-beta/i.test(route.summary)) errors.push(`${route.pathTemplate} summary does not say research-beta`);
  if (!surface.atlasLoader.includes("for (const jurisdiction of juris) ensure(jurisdiction.iso3!.toLowerCase())")) errors.push("Atlas layer does not initialize jurisdictions independently of Index rows");
  if (!surface.atlasLoader.includes("ciScore: null")) errors.push("Atlas layer has no explicit missing-Index state");
  if (!surface.atlasRelease.includes("Civica Index, Pulse") || !surface.atlasRelease.includes("excluded")) errors.push("Atlas release does not exclude Index outputs explicitly");
  if (!surface.rightsManifest.includes('productId: "index-bulk-release"') || !surface.rightsManifest.includes('publicBulkExport: "blocked"')) errors.push("Index bulk release is not blocked while experimental");
  for (const id of REQUIRED_CLAIMS) {
    const claim = surface.publicClaims.find((row) => row.id === id);
    if (!claim) { errors.push(`public claim registry omits ${id}`); continue; }
    if (id.includes("index") && claim.tier !== "research-beta-estimate") errors.push(`${id} is not tiered research-beta-estimate`);
  }
  return errors;
}
