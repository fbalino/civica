import { K1_UNCERTAINTY_INPUT_RELEASE_ID } from "./research-panel";
export const K1_UNCERTAINTY_INPUTS = Object.freeze({
  schemaVersion: "ci-k1-uncertainty-inputs/v2",
  releaseId: K1_UNCERTAINTY_INPUT_RELEASE_ID,
  supersedes: "ci-k1-uncertainty-inputs-2024-v1",
  correction:
    "pair intervals with exact publisher point estimates; v1 exposed six V-Dem republisher/publisher mismatches and remains immutable failed evidence",
  referenceYear: 2024,
  basePanel: "ci-research-panel-2000-2024-v3",
  identities: [
    "vdem:v2x_libdem",
    "worldbank_wgi:va.est",
    "worldbank_wgi:rl.est",
    "freedom_house:pr_cl_total",
    "transparency_intl:score",
  ],
  captures: {
    vdem: {
      url: "https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip",
      sha256:
        "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b",
      interval: "publisher codelow/codehigh credible region",
    },
    wgi: {
      url: "https://www.worldbank.org/content/dam/sites/govindicators/doc/wgidataset_with_sourcedata-2025.xlsx",
      sha256:
        "25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8",
      interval: "publisher 90% estimate interval",
    },
    freedomHouse: {
      url: "https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx",
      sha256:
        "d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88",
      interval: "no per-country probability distribution published",
    },
    cpi: {
      url: "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx",
      sha256:
        "34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736",
      interval: "publisher Lower CI/Upper CI",
    },
  },
  rights: {
    posture: "private_internal_research_only_pending_mixed_source_terms",
    publicBulkValues: false,
  },
  missingness: "no imputation; missing interval remains absent",
  purpose:
    "sensitivity scenarios only, not a calibrated composite confidence interval",
});
