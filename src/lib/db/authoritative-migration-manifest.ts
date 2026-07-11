import type { AuthoritativeMigration } from "./authoritative-migrations";

export const AUTHORITATIVE_MIGRATIONS: readonly AuthoritativeMigration[] = [
  {
    id: "0000_authoritative_baseline",
    path: "drizzle/authoritative/0000_authoritative_baseline.sql",
    sha256: "3ba983b97fc6eeaad67c38c069ec72edf0371e62c2f7037380d86343dc13a418",
    baseline: true,
  },
  {
    id: "0001_aspiring_bloodaxe",
    path: "drizzle/authoritative/0001_aspiring_bloodaxe.sql",
    sha256: "113c545226364b362f78480f3a9a83cee52605e39b37eeb3e27ae651d520e4d0",
    baseline: false,
  },
  {
    id: "0002_quarantine_numeric_outliers",
    path: "drizzle/authoritative/0002_quarantine_numeric_outliers.sql",
    sha256: "76cca42a16ab01d41889922b72b15b7cd84e966145871b4a17a6070dd3b4c776",
    baseline: false,
  },
  {
    id: "0003_mixed_mockingbird",
    path: "drizzle/authoritative/0003_mixed_mockingbird.sql",
    sha256: "1d9741679ac592fe6ffdeb05e6d711a72b8ecd9520ed80969a2648ff37e15823",
    baseline: false,
  },
  {
    id: "0004_naive_dust",
    path: "drizzle/authoritative/0004_naive_dust.sql",
    sha256: "521113620700811c93b9acaf91c5766e0be302d9e8ecb6e9049e3fd8f11d235e",
    baseline: false,
  },
  {
    id: "0005_freeze_reconciliation_candidates",
    path: "drizzle/authoritative/0005_freeze_reconciliation_candidates.sql",
    sha256: "d2fd01385d030d8e670eea144eb1ad3ed61a02cb15f8e4c79ecf6abefb518420",
    baseline: false,
  },
  {
    id: "0006_staged_candidate_publication",
    path: "drizzle/authoritative/0006_staged_candidate_publication.sql",
    sha256: "85f2603f1e13235b07b5cb20228e5b1eb02bdc542220d45dde615f03a87a4088",
    baseline: false,
  },
  {
    id: "0007_slippery_warhawk",
    path: "drizzle/authoritative/0007_slippery_warhawk.sql",
    sha256: "24f9a4633386177aa556b21f1c4a95e49fe8e8d1457a8853eff086de722c23bf",
    baseline: false,
  },
  {
    id: "0008_material_wildside",
    path: "drizzle/authoritative/0008_material_wildside.sql",
    sha256: "80e413e417af4cd33c40beff3c38da4a58f3bce4b9ca7c651dd35f75a9070f16",
    baseline: false,
  },
  {
    id: "0009_ambiguous_maverick",
    path: "drizzle/authoritative/0009_ambiguous_maverick.sql",
    sha256: "bdeca05751fd26c59251bf26661ab6f70bebc01bf1752b664aebcdff6b24db36",
    baseline: false,
  },
] as const;
