import { createHash } from "node:crypto";

export const STATISTICAL_REPRODUCIBILITY_CONTRACT =
  "civica-statistical-reproducibility/v1" as const;

export interface StatisticalAnalysisReproducibilityRecord {
  id: string;
  resultPath: string;
  resultFileSha256: string;
  resultSha256: string;
  resultIdentityKey: "releaseId" | "auditId";
  replayCommand: string;
  inputArtifacts: readonly { path: string; sha256: string }[];
  derivedArtifacts?: readonly { path: string; sha256: string }[];
  /** The analysis entrypoint is version-pinned independently of its output. */
  methodArtifacts: readonly { path: string; sha256: string }[];
  seeds: readonly { value: string; sourcePath: string }[];
  tolerance: "byte_exact";
}

const panelInput = {
  path: "data/releases/ci-research-panel-2000-2024-v3/manifest.v3.json",
  sha256: "f9f83964c34693cc17944e418818f0092c2a03f158f32e5e3adddfa50bfe0c84",
} as const;
const uncertaintyInput = {
  path: "data/releases/ci-k1-uncertainty-inputs-2024-v2/manifest.v1.json",
  sha256: "15e2fa5ec8fa00bbdfcf10fe93ae9d49d79c666dce9418dd7fc15e10bce9fb99",
} as const;
const longitudinalInput = {
  path: "data/releases/ci-longitudinal-validation-labels-2000-2022-v2/manifest.v1.json",
  sha256: "8eca6c15c93f683bc1a60e1d93b44b407b3b303a201ab16d1aa843aab5683a2d",
} as const;
const subgroupInput = {
  path: "data/releases/index-subgroup-classifications-2026-07-11-v1/classifications.v1.json",
  sha256: "f21924d98095adf66ddf2d1383a3e0ed550843a828ec41736ae39f78ef3db6d4",
} as const;
const dimensionalityResult = {
  path: "data/releases/index-dimensionality-analysis-v1/result.v1.json",
  sha256: "da3e54a515814e829287abb2600f52edd0eb02daf5920b1ebe2cc3aa63801e9f",
} as const;
const incrementalResult = {
  path: "data/releases/index-incremental-information-v1/result.v1.json",
  sha256: "25a6b5efc02dea337a69343e89da0c9784f44e119296cbd8e4fba98012245124",
} as const;
const longitudinalResult = {
  path: "data/releases/index-longitudinal-analysis-v1/result.v1.json",
  sha256: "fbca344ee15d3039010732a00a820c7e76b0726c8a812f9dc2419d88250423fd",
} as const;
const sensitivityResult = {
  path: "data/releases/index-sensitivity-analysis-v1/result.v1.json",
  sha256: "5d6676552e34e12bd3b75ab7f514ac508557e692c6fa7582bbcd08911f5b4f39",
} as const;
const oosStaticInputs = [
  panelInput,
  { path: "data/releases/ci-index-baselines-v3/manifest.v3.json", sha256: "b33e849ec082e8042a90b274aabdb4b694342d2aa5ce44ad1a9317b4ea129cce" },
  { path: "data/releases/k1-current-composite-tournament-v1/manifest.v1.json", sha256: "0e6c24d58dc59710deebe47fadbeb4c12e2879440cfad9137628653cfa994e5b" },
  incrementalResult,
  { path: "data/releases/k3-power-transfer-ledger-prototype-v1/manifest.v1.json", sha256: "a630c639941b009d56fc84674d31ac32baca52cbced631b3d623d2a79c65519d" },
  { path: "data/releases/k4-constitution-practice-pairings-2024-v1/manifest.v1.json", sha256: "9ac2e28a6ae8061cd31e1d0dd70148069e803a33bbc3e9597917f5ed44da3bb0" },
  { path: "data/releases/k5-institutional-relation-candidates-v1/manifest.v1.json", sha256: "f45cbe8a1c612a0583080fb5dfcacc36974698e158572df1543f2bdf216481cb" },
] as const;

/**
 * Every checked analytical result is bound to its exact input-manifest bytes,
 * deterministic replay command, any RNG seed, and table/figure bytes. A new
 * input or method version must therefore create a new record rather than
 * silently retaining a prior result file.
 */
export const STATISTICAL_ANALYSIS_REPRODUCIBILITY: readonly StatisticalAnalysisReproducibilityRecord[] = [
  {
    id: "dimensionality",
    resultPath: "data/releases/index-dimensionality-analysis-v1/result.v1.json",
    resultFileSha256: "da3e54a515814e829287abb2600f52edd0eb02daf5920b1ebe2cc3aa63801e9f",
    resultSha256: "07b3b8b5513622fb3a7f3fabb8e8e811d0f55ae4f7a642f7f1681cfeb8ddf954",
    resultIdentityKey: "releaseId",
    replayCommand: "validate:index-dimensionality",
    inputArtifacts: [panelInput],
    derivedArtifacts: [
      { path: "data/releases/index-dimensionality-analysis-v1/table.v1.csv", sha256: "d5d2ec2279a4affd063cfe4caccf2c76f7f345b5bbd05a15975807485506b381" },
      { path: "data/releases/index-dimensionality-analysis-v1/pc1-level-comparison.v1.svg", sha256: "7dafa5b35f0e99e105e349cf295a936f4b5dda51d8d149ca1e3f7d82ddb4de35" },
    ],
    methodArtifacts: [{ path: "scripts/generate-index-dimensionality-analysis.ts", sha256: "67e2a15b3a80f92774202e4e945aad01cabd7997a8d13f7661fe7943e9b3a070" }],
    seeds: [],
    tolerance: "byte_exact",
  },
  {
    id: "validity",
    resultPath: "data/releases/index-validity-analysis-v1/result.v1.json",
    resultFileSha256: "4ecc0c9a985d4eee07911136ec031d511d288fd0b0d961ed4aef358951ba4e9e",
    resultSha256: "6b7f3642f135b8ca217b47ae6c44f8bbd98fa3edd1e7448b99f6927266cd5b03",
    resultIdentityKey: "releaseId",
    replayCommand: "validate:index-validity",
    inputArtifacts: [panelInput],
    methodArtifacts: [{ path: "scripts/generate-index-validity-analysis.ts", sha256: "1f45f3f2852eb0f1fd02931e550e0f71e980c26754a7705cb951ce829866c827" }],
    seeds: [{ value: "civica-index-validity-bootstrap-v1", sourcePath: "src/lib/ci/validity-preregistration.ts" }],
    tolerance: "byte_exact",
  },
  {
    id: "incremental-information",
    resultPath: "data/releases/index-incremental-information-v1/result.v1.json",
    resultFileSha256: "25a6b5efc02dea337a69343e89da0c9784f44e119296cbd8e4fba98012245124",
    resultSha256: "d723adf25baf589ec4c53bbab7ef85fcb0429f5fddd36edebff73f42ce7b48fb",
    resultIdentityKey: "releaseId",
    replayCommand: "validate:index-incremental-information",
    inputArtifacts: [panelInput],
    methodArtifacts: [{ path: "scripts/generate-index-incremental-information.ts", sha256: "f5ed4526bc6156d0d26e324279fbcb3e8ab4c2eaac12a51161278b05b319a878" }],
    seeds: [{ value: "civica-index-incremental-bootstrap-v1", sourcePath: "src/lib/ci/incremental-information-analysis.ts" }],
    tolerance: "byte_exact",
  },
  {
    id: "longitudinal",
    resultPath: "data/releases/index-longitudinal-analysis-v1/result.v1.json",
    resultFileSha256: "fbca344ee15d3039010732a00a820c7e76b0726c8a812f9dc2419d88250423fd",
    resultSha256: "cccb941f868e4366ceb118d3780d8dc619a5c02ec3ffdcdbbf7ded7245c191d4",
    resultIdentityKey: "releaseId",
    replayCommand: "validate:index-longitudinal",
    inputArtifacts: [panelInput, longitudinalInput],
    methodArtifacts: [{ path: "scripts/generate-index-longitudinal-analysis.ts", sha256: "d6633b2d6aa2f96a5e88ba7a56a00e6f60e35fdfca382accc991c86404eae82a" }],
    seeds: [{ value: "civica-longitudinal-bootstrap-v1", sourcePath: "src/lib/ci/longitudinal-analysis.ts" }],
    tolerance: "byte_exact",
  },
  {
    id: "out-of-sample",
    resultPath: "data/releases/index-oos-validation-v1/result.v1.json",
    resultFileSha256: "279d8379df018d59345b747375e62b1d5787dbeef6c43b7800e2ffb58c8623af",
    resultSha256: "8cd1f8c218b5ccf080168c2c896d7f5dc07673001801291924e2396f2a55ba45",
    resultIdentityKey: "releaseId",
    replayCommand: "validate:index-oos-validation",
    inputArtifacts: oosStaticInputs,
    methodArtifacts: [{ path: "scripts/generate-index-oos-validation.ts", sha256: "90644c3b28f97c1575703c9ad2af0e34460fd8ee207e4ead71fc480a6ff7b8ca" }],
    seeds: [],
    tolerance: "byte_exact",
  },
  {
    id: "sensitivity",
    resultPath: "data/releases/index-sensitivity-analysis-v1/result.v1.json",
    resultFileSha256: "5d6676552e34e12bd3b75ab7f514ac508557e692c6fa7582bbcd08911f5b4f39",
    resultSha256: "49576076eaf6920594d4c51290fb0164b8ab8e82abec5e4a7b05ab313aa8b7c6",
    resultIdentityKey: "releaseId",
    replayCommand: "validate:index-sensitivity",
    inputArtifacts: [panelInput, uncertaintyInput, dimensionalityResult, longitudinalResult],
    methodArtifacts: [{ path: "scripts/generate-index-sensitivity-analysis.ts", sha256: "ff1ea5f6d27a0001906b46c845f1b03027499e380f23d7468a4bdd85c7ab98a7" }],
    seeds: [],
    tolerance: "byte_exact",
  },
  {
    id: "source-dependence",
    resultPath: "data/releases/index-source-dependence-v1/result.v1.json",
    resultFileSha256: "b34ff36c5e82f4b50fa71eb3f349ef0224848a3fb1141aef9e4fb86e64ffa14f",
    resultSha256: "1ec636ae39cce86e10bea561f84b3b0d6e7bd9aeafc3926a862799fd98170bc6",
    resultIdentityKey: "releaseId",
    replayCommand: "validate:index-source-dependence",
    inputArtifacts: [sensitivityResult, dimensionalityResult, incrementalResult],
    methodArtifacts: [{ path: "scripts/generate-index-source-dependence.ts", sha256: "432d2ddb11878f36ca6aab7494bd2c5b761093a0e1e89870d214ff9d0f4acef4" }],
    seeds: [],
    tolerance: "byte_exact",
  },
  {
    id: "subgroup-fairness",
    resultPath: "data/releases/index-subgroup-fairness-v1/result.v1.json",
    resultFileSha256: "1108c521d1fa6131fc379c6f3b60132eae5a77e0c97c33582b09694643e18a30",
    resultSha256: "11ab6e662191099ef399f710a9ff15751dac25f87d7f1790c382338b1411ac1c",
    resultIdentityKey: "releaseId",
    replayCommand: "validate:index-subgroup-fairness",
    inputArtifacts: [panelInput, uncertaintyInput, subgroupInput],
    methodArtifacts: [{ path: "scripts/generate-index-subgroup-fairness.ts", sha256: "65cfe26feead23244ef2ee949450360b819740312b2e7a38abaa3b2a57a974ae" }],
    seeds: [],
    tolerance: "byte_exact",
  },
  {
    id: "misuse-audit",
    resultPath: "data/releases/index-misuse-audit-v1/result.v1.json",
    resultFileSha256: "983e9b38f283b3b9503dbb70946fc70f9a2105f322f92c67be6387737d403e83",
    resultSha256: "7bb620bbf3c4664717c08ebe4756868394d995fb32b598301cfe1451a1c5257b",
    resultIdentityKey: "auditId",
    replayCommand: "validate:index-misuse-audit",
    inputArtifacts: [],
    methodArtifacts: [{ path: "scripts/generate-index-misuse-audit.ts", sha256: "6a09467a2a3bb87710cfbf83497740aa5b17fe6a721996e799f3aacbf2be84d0" }],
    seeds: [],
    tolerance: "byte_exact",
  },
];

export interface StatisticalReproducibilityReader {
  readBytes(path: string): Uint8Array;
  readText(path: string): string;
  packageScripts: Record<string, string | undefined>;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function statisticalReproducibilityErrors(
  reader: StatisticalReproducibilityReader,
  records = STATISTICAL_ANALYSIS_REPRODUCIBILITY,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) errors.push(`duplicate analysis id: ${record.id}`);
    ids.add(record.id);
    let result: Record<string, unknown>;
    try {
      const bytes = reader.readBytes(record.resultPath);
      if (sha256(bytes) !== record.resultFileSha256) {
        errors.push(`${record.id}: result bytes drifted`);
      }
      result = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    } catch (error) {
      errors.push(`${record.id}: result is unreadable (${String(error)})`);
      continue;
    }
    if (!String(result[record.resultIdentityKey] ?? "").trim()) {
      errors.push(`${record.id}: result has no ${record.resultIdentityKey}`);
    }
    if (result.resultSha256 !== record.resultSha256) {
      errors.push(`${record.id}: semantic result hash drifted`);
    }
    if (record.tolerance !== "byte_exact") errors.push(`${record.id}: tolerance is not declared`);
    const replay = reader.packageScripts[record.replayCommand];
    if (!replay?.includes("scripts/validate-")) {
      errors.push(`${record.id}: replay command is missing or not a validator`);
    }
    for (const input of record.inputArtifacts) {
      try {
        if (sha256(reader.readBytes(input.path)) !== input.sha256) {
          errors.push(`${record.id}: frozen input bytes drifted: ${input.path}`);
        }
      } catch (error) {
        errors.push(`${record.id}: frozen input is unreadable: ${input.path} (${String(error)})`);
      }
    }
    for (const artifact of record.derivedArtifacts ?? []) {
      try {
        if (sha256(reader.readBytes(artifact.path)) !== artifact.sha256) {
          errors.push(`${record.id}: derived artifact bytes drifted: ${artifact.path}`);
        }
      } catch (error) {
        errors.push(`${record.id}: derived artifact is unreadable: ${artifact.path} (${String(error)})`);
      }
    }
    for (const method of record.methodArtifacts) {
      try {
        if (sha256(reader.readBytes(method.path)) !== method.sha256) {
          errors.push(`${record.id}: method code bytes drifted: ${method.path}`);
        }
      } catch (error) {
        errors.push(`${record.id}: method code is unreadable: ${method.path} (${String(error)})`);
      }
    }
    for (const seed of record.seeds) {
      try {
        if (!reader.readText(seed.sourcePath).includes(seed.value)) {
          errors.push(`${record.id}: seed is not recorded in ${seed.sourcePath}`);
        }
      } catch (error) {
        errors.push(`${record.id}: seed source is unreadable: ${seed.sourcePath} (${String(error)})`);
      }
    }
  }
  return errors;
}
