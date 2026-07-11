import { formatGovernmentType, stripHtml } from "@/lib/text/clean";
import { GOVERNMENT_TAXONOMY_OVERRIDES } from "./overrides";

export const DEFAULT_GOVERNMENT_TAXONOMY_VERSION = "2026_v1";
export const BJORNKSKOV_RODE_SOURCE_ID = "bjornskov_rode";
export const BJORNKSKOV_RODE_DATASET_VERSION = "QoG Standard Jan26";
export const BJORNKSKOV_RODE_SOURCE_DATASET_VERSION = "Bjørnskov-Rode regime data v6.1";
export const BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR = 2022;

export type GovernmentTaxonomyLens = "raw" | "structural" | "regime";

export type StructuralFamilyKey =
  | "parliamentary_democracy"
  | "presidential_republic"
  | "semi_presidential"
  | "constitutional_monarchy"
  | "absolute_monarchy"
  | "one_party_state"
  | "military_rule"
  | "theocracy"
  | "directorial_republic"
  | "other";

export type RegimeTypeKey =
  | "parliamentary_democracy"
  | "semi_presidential_democracy"
  | "presidential_democracy"
  | "civilian_dictatorship"
  | "military_dictatorship"
  | "royal_dictatorship";

export interface StructuralFamilyMeta {
  label: string;
  colorVar: string;
  fallback: string;
  order: number;
}

export interface RegimeTypeMeta {
  label: string;
  colorVar: string;
  fallback: string;
  order: number;
}

export interface StructuralDerivationInput {
  slug?: string | null;
  iso3?: string | null;
  governmentType?: string | null;
  governmentTypeDetail?: string | null;
}

export interface BjornskovRodeSignals {
  regimeDatasetVersion?: string | null;
  regimeYear?: number | null;
  brDem?: number | null;
  brPres?: number | null;
  brMon?: number | null;
  brCom?: number | null;
}

export interface GovernmentTaxonomyRowLike {
  taxonomyVersion?: string | null;
  regimeTypeCgv?: string | null;
  regimeDatasetVersion?: string | null;
  regimeYear?: number | null;
  structuralFamily?: string | null;
  structuralSubtype?: string | null;
  isFederal?: boolean | null;
  isMonarchy?: boolean | null;
  executiveStructure?: string | null;
  governmentDependency?: string | null;
  overrideNote?: string | null;
  provenance?: Record<string, unknown> | null;
}

export interface DerivedStructuralTaxonomy {
  structuralFamily: StructuralFamilyKey;
  structuralFamilyLabel: string;
  structuralSubtype: string;
  structuralSubtypeLabel: string;
  isFederal: boolean;
  isMonarchy: boolean;
  executiveStructure: string;
  governmentDependency: string;
  overrideNote: string | null;
  provenance: Record<string, unknown>;
}

export interface DerivedRegimeTaxonomy {
  regimeTypeCgv: RegimeTypeKey | null;
  regimeTypeLabel: string | null;
  regimeDatasetVersion: string | null;
  regimeYear: number | null;
  provenance: Record<string, unknown>;
}

export interface GovernmentClassification {
  taxonomyVersion: string;
  rawLabel: string | null;
  regimeType: RegimeTypeKey | null;
  regimeTypeLabel: string | null;
  regimeSource: string | null;
  regimeDatasetVersion: string | null;
  regimeYear: number | null;
  structuralFamily: StructuralFamilyKey | null;
  structuralFamilyLabel: string | null;
  structuralSubtype: string | null;
  structuralSubtypeLabel: string | null;
  structuralColorVar: string | null;
  structuralColorFallback: string | null;
  regimeColorVar: string | null;
  regimeColorFallback: string | null;
  primitives: {
    isFederal: boolean | null;
    isMonarchy: boolean | null;
    executiveStructure: string | null;
    governmentDependency: string | null;
  };
  overrideNote: string | null;
  provenance: Record<string, unknown> | null;
}

export const STRUCTURAL_FAMILY_META: Record<
  StructuralFamilyKey,
  StructuralFamilyMeta
> = {
  parliamentary_democracy: {
    label: "Parliamentary democracy",
    colorVar: "var(--gov-parl, #4E8BD4)",
    fallback: "#4E8BD4",
    order: 100,
  },
  presidential_republic: {
    label: "Presidential republic",
    colorVar: "var(--gov-pres, #D4764E)",
    fallback: "#D4764E",
    order: 200,
  },
  semi_presidential: {
    label: "Semi-presidential",
    colorVar: "var(--gov-semi, #9B6DC6)",
    fallback: "#9B6DC6",
    order: 300,
  },
  constitutional_monarchy: {
    label: "Constitutional monarchy",
    colorVar: "var(--gov-mon, #C4A44E)",
    fallback: "#C4A44E",
    order: 400,
  },
  absolute_monarchy: {
    label: "Absolute monarchy",
    colorVar: "var(--gov-abs, #B8893A)",
    fallback: "#B8893A",
    order: 500,
  },
  one_party_state: {
    label: "One-party state",
    colorVar: "var(--gov-one, #C65A37)",
    fallback: "#C65A37",
    order: 600,
  },
  military_rule: {
    label: "Military rule",
    colorVar: "var(--gov-mil, #C64E3A)",
    fallback: "#C64E3A",
    order: 700,
  },
  theocracy: {
    label: "Theocracy",
    colorVar: "var(--gov-theo, #5CAA6E)",
    fallback: "#5CAA6E",
    order: 800,
  },
  directorial_republic: {
    label: "Directorial republic",
    colorVar: "var(--gov-dir, #4AA7A3)",
    fallback: "#4AA7A3",
    order: 850,
  },
  other: {
    label: "Other",
    colorVar: "var(--gov-other, #8899AA)",
    fallback: "#8899AA",
    order: 900,
  },
};

export const REGIME_TYPE_META: Record<RegimeTypeKey, RegimeTypeMeta> = {
  parliamentary_democracy: {
    label: "Parliamentary democracy",
    colorVar: "var(--gov-parl, #4E8BD4)",
    fallback: "#4E8BD4",
    order: 100,
  },
  semi_presidential_democracy: {
    label: "Semi-presidential democracy",
    colorVar: "var(--gov-semi, #9B6DC6)",
    fallback: "#9B6DC6",
    order: 200,
  },
  presidential_democracy: {
    label: "Presidential democracy",
    colorVar: "var(--gov-pres, #D4764E)",
    fallback: "#D4764E",
    order: 300,
  },
  civilian_dictatorship: {
    label: "Civilian dictatorship",
    colorVar: "var(--gov-one, #C65A37)",
    fallback: "#C65A37",
    order: 400,
  },
  military_dictatorship: {
    label: "Military dictatorship",
    colorVar: "var(--gov-mil, #C64E3A)",
    fallback: "#C64E3A",
    order: 500,
  },
  royal_dictatorship: {
    label: "Royal dictatorship",
    colorVar: "var(--gov-abs, #B8893A)",
    fallback: "#B8893A",
    order: 600,
  },
};

function toNormalizedSource(
  raw: string | null | undefined,
  rawFallback?: string | null | undefined,
): string {
  const text = stripHtml(raw ?? rawFallback ?? "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function hasAny(source: string, needles: string[]): boolean {
  return needles.some((needle) => source.includes(needle));
}

function toDisplayLabel(raw: string | null | undefined): string {
  return formatGovernmentType(raw ?? "") || "Other";
}

function slugifyDisplayLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findOverride(input: StructuralDerivationInput) {
  const iso3 = input.iso3?.toUpperCase() ?? null;
  if (iso3 && iso3 in GOVERNMENT_TAXONOMY_OVERRIDES) {
    return GOVERNMENT_TAXONOMY_OVERRIDES[iso3 as keyof typeof GOVERNMENT_TAXONOMY_OVERRIDES];
  }
  const slug = input.slug?.toLowerCase() ?? null;
  if (slug && slug in GOVERNMENT_TAXONOMY_OVERRIDES) {
    return GOVERNMENT_TAXONOMY_OVERRIDES[slug as keyof typeof GOVERNMENT_TAXONOMY_OVERRIDES];
  }
  return null;
}

function structuralLabelForSubtype(subtype: string): string {
  const explicit: Record<string, string> = {
    federal_parliamentary_republic: "Federal Parliamentary Republic",
    parliamentary_republic: "Parliamentary Republic",
    parliamentary_constitutional_monarchy: "Parliamentary Constitutional Monarchy",
    constitutional_monarchy: "Constitutional Monarchy",
    co_principality: "Co-principality",
    absolute_monarchy: "Absolute Monarchy",
    federal_emirate_monarchy: "Federal Emirate Monarchy",
    semi_presidential_republic: "Semi-presidential Republic",
    semi_presidential_federation: "Semi-presidential Federation",
    presidential_republic: "Presidential Republic",
    federal_presidential_republic: "Federal Presidential Republic",
    federal_directorial_republic: "Federal Directorial Republic",
    directorial_republic: "Directorial Republic",
    communist_party_state: "Communist Party-state",
    one_party_republic: "One-party Republic",
    military_junta: "Military Junta",
    military_transitional_authority: "Military Transitional Authority",
    theocratic_republic: "Theocratic Republic",
    elective_theocratic_monarchy: "Elective Theocratic Monarchy",
    theocratic_monarchy: "Theocratic Monarchy",
  };
  return explicit[subtype] ?? toDisplayLabel(subtype);
}

export function deriveStructuralTaxonomy(
  input: StructuralDerivationInput,
): DerivedStructuralTaxonomy {
  const rawLabel = input.governmentTypeDetail ?? input.governmentType ?? null;
  const source = toNormalizedSource(input.governmentTypeDetail, input.governmentType);
  const override = findOverride(input);

  if (override) {
    return {
      structuralFamily: override.structuralFamily as StructuralFamilyKey,
      structuralFamilyLabel:
        STRUCTURAL_FAMILY_META[override.structuralFamily as StructuralFamilyKey]
          .label,
      structuralSubtype: override.structuralSubtype,
      structuralSubtypeLabel: structuralLabelForSubtype(
        override.structuralSubtype,
      ),
      isFederal: override.isFederal,
      isMonarchy: override.isMonarchy,
      executiveStructure: override.executiveStructure,
      governmentDependency: override.governmentDependency,
      overrideNote: override.overrideNote,
      provenance: {
        derivation: "override",
        overrideKey: input.iso3 ?? input.slug ?? null,
        rawLabel,
      },
    };
  }

  const isFederal = hasAny(source, [
    "federal",
    "federation",
    "confederation",
    "emirates",
  ]);
  const isMonarchy = hasAny(source, [
    "monarchy",
    "kingdom",
    "realm",
    "principality",
    "prince",
    "sultanate",
    "emirate",
  ]);

  const make = (
    structuralFamily: StructuralFamilyKey,
    structuralSubtype: string,
    executiveStructure: string,
    governmentDependency: string,
  ): DerivedStructuralTaxonomy => ({
    structuralFamily,
    structuralFamilyLabel: STRUCTURAL_FAMILY_META[structuralFamily].label,
    structuralSubtype,
    structuralSubtypeLabel: structuralLabelForSubtype(structuralSubtype),
    isFederal,
    isMonarchy,
    executiveStructure,
    governmentDependency,
    overrideNote: null,
    provenance: {
      derivation: "heuristic",
      rawLabel,
      normalizedSource: source,
    },
  });

  if (!source) {
    return make("other", "other", "unknown", "unknown");
  }

  if (
    hasAny(source, ["theocracy", "theocratic", "ecclesiastical", "holy see"]) ||
    source.includes("islamic republic")
  ) {
    return make(
      "theocracy",
      isMonarchy ? "elective_theocratic_monarchy" : "theocratic_republic",
      isMonarchy ? "clerical_monarchic" : "clerical_executive",
      "clerical_rule",
    );
  }

  if (hasAny(source, ["military", "junta", "armed forces"])) {
    return make(
      "military_rule",
      hasAny(source, ["transitional", "provisional"])
        ? "military_transitional_authority"
        : "military_junta",
      "military_council",
      "military_rule",
    );
  }

  if (
    hasAny(source, ["one party", "one-party", "single party", "single-party"]) ||
    hasAny(source, ["communist", "socialist state", "party-state"])
  ) {
    return make(
      "one_party_state",
      hasAny(source, ["communist", "socialist"])
        ? "communist_party_state"
        : "one_party_republic",
      "party_state",
      "single_party_rule",
    );
  }

  if (
    hasAny(source, ["absolute monarchy", "absolute", "sultanate", "emirate"]) &&
    !hasAny(source, ["constitutional monarchy"])
  ) {
    return make(
      "absolute_monarchy",
      isFederal ? "federal_emirate_monarchy" : "absolute_monarchy",
      isFederal ? "collective_monarchic" : "monarchic_executive",
      "absolute_rule",
    );
  }

  if (
    hasAny(source, ["directorial", "collegial", "collective executive"]) ||
    source.includes("confederation")
  ) {
    return make(
      "directorial_republic",
      isFederal ? "federal_directorial_republic" : "directorial_republic",
      "collegial_executive",
      "fixed_term",
    );
  }

  if (source.includes("semi presidential") || source.includes("semi-presidential")) {
    return make(
      "semi_presidential",
      isFederal ? "semi_presidential_federation" : "semi_presidential_republic",
      "dual_executive",
      "mixed_dependency",
    );
  }

  if (isMonarchy) {
    return make(
      "constitutional_monarchy",
      hasAny(source, ["parliamentary", "commonwealth realm", "realm"])
        ? "parliamentary_constitutional_monarchy"
        : source.includes("co principality") || source.includes("co-principality")
          ? "co_principality"
          : "constitutional_monarchy",
      hasAny(source, ["co principality", "co-principality"])
        ? "dual_monarchic_head_of_state"
        : "monarchic_head_of_state",
      "legislative_confidence",
    );
  }

  if (source.includes("parliamentary") || source.includes("westminster")) {
    return make(
      "parliamentary_democracy",
      isFederal ? "federal_parliamentary_republic" : "parliamentary_republic",
      "cabinet_executive",
      "legislative_confidence",
    );
  }

  if (source.includes("presidential")) {
    return make(
      "presidential_republic",
      isFederal ? "federal_presidential_republic" : "presidential_republic",
      "single_executive",
      "fixed_term",
    );
  }

  if (source.includes("republic")) {
    return make(
      isFederal ? "presidential_republic" : "other",
      isFederal ? "federal_presidential_republic" : "presidential_republic",
      "single_executive",
      isFederal ? "fixed_term" : "mixed_dependency",
    );
  }

  return make("other", slugifyDisplayLabel(toDisplayLabel(rawLabel)) || "other", "unknown", "unknown");
}

export function deriveRegimeTypeCgv(
  input: StructuralDerivationInput & BjornskovRodeSignals,
): DerivedRegimeTaxonomy {
  const structural = deriveStructuralTaxonomy(input);
  const brDem = input.brDem ?? null;
  const brPres = input.brPres ?? null;
  const brMon = input.brMon ?? null;
  const rawLabel = input.governmentTypeDetail ?? input.governmentType ?? null;

  let regimeTypeCgv: RegimeTypeKey | null = null;

  if (brDem !== null) {
    if (brDem >= 0.5) {
      if (structural.structuralFamily === "semi_presidential") {
        regimeTypeCgv = "semi_presidential_democracy";
      } else if (brPres !== null && brPres >= 0.5) {
        regimeTypeCgv = "presidential_democracy";
      } else {
        regimeTypeCgv = "parliamentary_democracy";
      }
    } else if (brMon !== null && brMon >= 0.5) {
      regimeTypeCgv = "royal_dictatorship";
    } else if (structural.structuralFamily === "military_rule") {
      regimeTypeCgv = "military_dictatorship";
    } else {
      regimeTypeCgv = "civilian_dictatorship";
    }
  }

  return {
    regimeTypeCgv,
    regimeTypeLabel: regimeTypeCgv ? REGIME_TYPE_META[regimeTypeCgv].label : null,
    regimeDatasetVersion:
      input.regimeDatasetVersion ?? BJORNKSKOV_RODE_DATASET_VERSION,
    regimeYear: input.regimeYear ?? null,
    provenance: {
      source: "bjornskov_rode_qog",
      rawLabel,
      brDem,
      brPres,
      brMon,
      brCom: input.brCom ?? null,
      structuralFamily: structural.structuralFamily,
      mixedDisambiguation:
        regimeTypeCgv === "semi_presidential_democracy"
          ? "raw_structural_label"
          : "not_needed",
    },
  };
}

export function buildGovernmentClassification(
  input: StructuralDerivationInput,
  taxonomyRow?: GovernmentTaxonomyRowLike | null,
): GovernmentClassification {
  const rawLabel =
    input.governmentTypeDetail ??
    (input.governmentType ? formatGovernmentType(input.governmentType) : null);

  const structural = taxonomyRow?.structuralFamily
    ? {
        structuralFamily: taxonomyRow.structuralFamily as StructuralFamilyKey,
        structuralFamilyLabel:
          STRUCTURAL_FAMILY_META[
            taxonomyRow.structuralFamily as StructuralFamilyKey
          ]?.label ?? toDisplayLabel(taxonomyRow.structuralFamily),
        structuralSubtype: taxonomyRow.structuralSubtype ?? taxonomyRow.structuralFamily,
        structuralSubtypeLabel: structuralLabelForSubtype(
          taxonomyRow.structuralSubtype ?? taxonomyRow.structuralFamily ?? "other",
        ),
        isFederal: taxonomyRow.isFederal ?? null,
        isMonarchy: taxonomyRow.isMonarchy ?? null,
        executiveStructure: taxonomyRow.executiveStructure ?? null,
        governmentDependency: taxonomyRow.governmentDependency ?? null,
        overrideNote: taxonomyRow.overrideNote ?? null,
        provenance: taxonomyRow.provenance ?? null,
      }
    : deriveStructuralTaxonomy(input);

  const regimeType =
    (taxonomyRow?.regimeTypeCgv as RegimeTypeKey | null | undefined) ??
    null;
  const regimeMeta = regimeType ? REGIME_TYPE_META[regimeType] : null;
  const structuralMeta =
    STRUCTURAL_FAMILY_META[structural.structuralFamily as StructuralFamilyKey] ??
    STRUCTURAL_FAMILY_META.other;

  return {
    taxonomyVersion:
      taxonomyRow?.taxonomyVersion ?? DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
    rawLabel,
    regimeType,
    regimeTypeLabel: regimeMeta?.label ?? null,
    regimeSource: regimeType ? "Bjornskov-Rode / CGV (QoG Standard)" : null,
    regimeDatasetVersion: taxonomyRow?.regimeDatasetVersion ?? null,
    regimeYear: taxonomyRow?.regimeYear ?? null,
    structuralFamily: structural.structuralFamily as StructuralFamilyKey,
    structuralFamilyLabel: structural.structuralFamilyLabel,
    structuralSubtype: structural.structuralSubtype,
    structuralSubtypeLabel: structural.structuralSubtypeLabel,
    structuralColorVar: structuralMeta.colorVar,
    structuralColorFallback: structuralMeta.fallback,
    regimeColorVar: regimeMeta?.colorVar ?? null,
    regimeColorFallback: regimeMeta?.fallback ?? null,
    primitives: {
      isFederal: structural.isFederal,
      isMonarchy: structural.isMonarchy,
      executiveStructure: structural.executiveStructure,
      governmentDependency: structural.governmentDependency,
    },
    overrideNote: structural.overrideNote,
    provenance: structural.provenance,
  };
}

export function getGovernmentTaxonomyGroupingLabel(
  classification: GovernmentClassification,
  lens: GovernmentTaxonomyLens,
): string {
  if (lens === "regime") {
    return classification.regimeTypeLabel ?? "Unclassified";
  }
  if (lens === "structural") {
    return classification.structuralFamilyLabel ?? "Other";
  }
  return classification.rawLabel ?? "Unclassified";
}

export function getGovernmentTaxonomyGroupingKey(
  classification: GovernmentClassification,
  lens: GovernmentTaxonomyLens,
): string {
  if (lens === "regime") {
    return classification.regimeType ?? "unclassified";
  }
  if (lens === "structural") {
    return classification.structuralFamily ?? "other";
  }
  return slugifyDisplayLabel(classification.rawLabel ?? "unclassified");
}

export function getGovernmentTaxonomyColor(
  classification: GovernmentClassification,
  lens: GovernmentTaxonomyLens,
): { colorVar: string; fallback: string } {
  if (lens === "regime" && classification.regimeType) {
    return REGIME_TYPE_META[classification.regimeType];
  }
  if (classification.structuralFamily) {
    return STRUCTURAL_FAMILY_META[classification.structuralFamily];
  }
  return STRUCTURAL_FAMILY_META.other;
}
