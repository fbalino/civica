import { LONGITUDINAL_VALIDATION_RELEASE_ID } from "./research-panel";
export const LONGITUDINAL_VALIDATION_INPUTS = Object.freeze({
  schemaVersion: "ci-longitudinal-validation-inputs/v2",
  releaseId: LONGITUDINAL_VALIDATION_RELEASE_ID,
  supersedes: "ci-longitudinal-validation-labels-2000-2022-v1",
  correction: "accept QoG binary numeric serialization 0.0/1.0; v1 remains immutable failed-ingestion evidence",
  period: { start: 2000, end: 2022 },
  indicator: {
    sourceId: "bjornskov_rode",
    indicatorId: "br_dem",
    definition:
      "Bjørnskov-Rode/CGV dichotomous democracy coding carried in the QoG Standard time-series release",
    nativeUnit: "binary 0/1",
    nativeMin: 0,
    nativeMax: 1,
    uncertainty: "no per-country probability distribution published",
  },
  captures: {
    qogJan26: {
      url: "https://www.qogdata.pol.gu.se/data/qog_std_ts_jan26.csv",
      sha256:
        "f8e140b706106e211460db54cf094de0d36eae0003e81c0f01c9427d0f756de0",
      retrievedAt: "2026-07-11T10:39:32Z",
      role: "frozen known-change labels",
    },
    qogJan25: {
      url: "https://www.qogdata.pol.gu.se/data/qog_std_ts_jan25.csv",
      sha256:
        "42dd8b26ad4ff3f640979b1d6ad814f6b2b8009bbab656beee0160fe0e9e71bf",
      retrievedAt: "2026-07-11T10:39:32Z",
      role: "label revision sensitivity",
    },
    qogJan24: {
      url: "https://www.qogdata.pol.gu.se/data/qog_std_ts_jan24.csv",
      sha256:
        "9ee069f36440636620e66556c1dfedcdae43ea4209ff0bbe9ff875d6ffc3656b",
      retrievedAt: "2026-07-11T10:39:32Z",
      role: "label revision sensitivity",
    },
    vdemV15: {
      url: "https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip",
      sha256:
        "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b",
      role: "current K1 democratic-quality input",
    },
    vdemV14: {
      url: "https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v14_csv.zip",
      sha256:
        "6bf73aa29897618af9a70fa790726bc2a009a8e9f908147a5a9fc5a00dc0f299",
      role: "source revision sensitivity",
    },
  },
  rights: {
    posture: "private_internal_research_only_academic_noncommercial",
    publicBulkValues: false,
  },
  missingness: { imputation: "none" },
  seriesType: "current_harmonized_backcast_not_as_published",
});
