import { createHash } from "node:crypto";
import { stableStringify } from "@/lib/data/frozen-vintage";

export const K1_SOURCE_ECOSYSTEM_MAP = Object.freeze({
  schemaVersion: "civica-index-source-ecosystem-map/v1",
  units: [
    {
      id: "vdem",
      publisher: "V-Dem Institute",
      product: "Liberal Democracy Index",
      evidenceType: "expert-coded latent-construct estimate",
      civicaObservation: false,
      upstreamFamilies: ["country_experts", "vdem_measurement_model"],
    },
    {
      id: "worldbank_wgi",
      publisher: "World Bank",
      product: "Worldwide Governance Indicators",
      evidenceType: "aggregate of surveys and expert assessments",
      civicaObservation: false,
      upstreamFamilies: ["vdem", "freedom_house", "eiu", "bertelsmann", "other_wgi_sources"],
    },
    {
      id: "freedom_house",
      publisher: "Freedom House",
      product: "Freedom in the World",
      evidenceType: "expert assessment",
      civicaObservation: false,
      upstreamFamilies: ["freedom_house_analysts", "country_experts"],
    },
    {
      id: "transparency_intl",
      publisher: "Transparency International",
      product: "Corruption Perceptions Index",
      evidenceType: "aggregate of corruption-perception sources",
      civicaObservation: false,
      upstreamFamilies: ["freedom_house", "eiu", "bertelsmann", "other_cpi_sources"],
    },
  ],
  documentedEdges: [
    { from: "vdem", to: "worldbank_wgi", code: "VDM", kind: "constituent_source" },
    { from: "freedom_house", to: "worldbank_wgi", code: "FRH", kind: "constituent_source" },
    { from: "freedom_house", to: "transparency_intl", code: "Freedom House Nations in Transit", kind: "same_publisher_family" },
    { from: "eiu", to: "worldbank_wgi", code: "EIU", kind: "shared_upstream_source" },
    { from: "eiu", to: "transparency_intl", code: "Economist Intelligence Unit Country Ratings", kind: "shared_upstream_source" },
    { from: "bertelsmann", to: "worldbank_wgi", code: "BTI", kind: "shared_upstream_source" },
    { from: "bertelsmann", to: "transparency_intl", code: "Bertelsmann Transformation Index", kind: "shared_upstream_source" },
  ],
  evidence: [
    {
      artifact: "WGI 2025 dataset with source data",
      sha256: "25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8",
      url: "https://www.worldbank.org/content/dam/sites/govindicators/doc/wgidataset_with_sourcedata-2025.xlsx",
      inspectedFields: ["FRH mean", "VDM mean", "EIU mean", "BTI mean"],
    },
    {
      artifact: "CPI 2024 Results and trends",
      sha256: "34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736",
      url: "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx",
      inspectedFields: ["Freedom House Nations in Transit", "Economist Intelligence Unit Country Ratings", "Bertelsmann Foundation Transformation Index"],
    },
  ],
  independenceRule: "Publisher separation is not evidence independence. Direct inputs and upstream source families must both be disclosed.",
  deletionLimit: "WGI and CPI do not expose recomputed aggregate estimates with each shared upstream family removed; upstream-family deletion is therefore not identifiable from the captured releases.",
} as const);

export function sourceEcosystemHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
