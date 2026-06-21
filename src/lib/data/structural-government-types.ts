import {
  STRUCTURAL_FAMILY_META,
  type StructuralFamilyKey,
} from "@/lib/government-taxonomy";

export interface StructuralGovernmentTypeInfo {
  slug: string;
  familyKey: StructuralFamilyKey;
  name: string;
  description: string[];
  characteristics: string[];
  color: string;
}

export const STRUCTURAL_GOVERNMENT_TYPES: StructuralGovernmentTypeInfo[] = [
  {
    slug: "parliamentary-democracy",
    familyKey: "parliamentary_democracy",
    name: "Parliamentary Democracy",
    description: [
      "Parliamentary democracies are systems in which the government depends on legislative confidence and can be removed without waiting for a fixed executive term to expire.",
      "In practice this usually means a prime minister and cabinet drawn from parliament, flexible coalition-building, and a direct line of accountability between the governing majority and the executive.",
      "Civica keeps parliamentary republics and related variants here as a shared structural family, then breaks out the subtypes on the Civica Index government-types page when readers want more detail.",
    ],
    characteristics: [
      "Executive depends on legislative confidence",
      "Prime minister or cabinet leads day-to-day government",
      "Coalitions and early elections are common adjustment mechanisms",
      "Parliamentary republics and federal parliamentary republics appear as subtypes",
    ],
    color: STRUCTURAL_FAMILY_META.parliamentary_democracy.fallback,
  },
  {
    slug: "presidential-republic",
    familyKey: "presidential_republic",
    name: "Presidential Republic",
    description: [
      "Presidential republics combine a republican head of state with a fixed-term executive that does not depend on parliamentary confidence to remain in office.",
      "The archetypal cases are systems like the United States or Brazil, but Civica also captures federal presidential republics and related variants as subtypes beneath the same structural family.",
      "This is a structural category, not a quality judgment. Performance still varies enormously across countries that share the label.",
    ],
    characteristics: [
      "Fixed-term executive independent of legislative confidence",
      "President usually combines head-of-state and head-of-government authority",
      "Federal presidential republics appear as a subtype where relevant",
      "Separation of powers is more explicit than in parliamentary systems",
    ],
    color: STRUCTURAL_FAMILY_META.presidential_republic.fallback,
  },
  {
    slug: "semi-presidential",
    familyKey: "semi_presidential",
    name: "Semi-Presidential System",
    description: [
      "Semi-presidential systems split executive authority between a president and a prime minister, creating a hybrid structure between parliamentary and presidential forms.",
      "These systems can look very different in practice depending on whether the president dominates, the prime minister dominates, or power genuinely alternates between them.",
      "Civica keeps them separate because the dual-executive structure matters analytically even when the regime-type layer later groups them by accountability rules.",
    ],
    characteristics: [
      "Dual executive: president plus prime minister",
      "Responsibility is divided between presidential and parliamentary institutions",
      "Cohabitation and power-sharing can define real-world behavior",
      "Semi-presidential republics and federations appear as subtypes",
    ],
    color: STRUCTURAL_FAMILY_META.semi_presidential.fallback,
  },
  {
    slug: "constitutional-monarchy",
    familyKey: "constitutional_monarchy",
    name: "Constitutional Monarchy",
    description: [
      "Constitutional monarchies preserve a monarch as head of state while locating day-to-day political power in elected institutions and ministers.",
      "Civica keeps constitutional monarchy visible as a structural family because academics and general readers both care about the continued constitutional role of monarchy even when regime datasets code these countries as parliamentary democracies.",
      "This family includes parliamentary constitutional monarchies and related forms where the monarch remains institutionally meaningful but not absolutely sovereign.",
    ],
    characteristics: [
      "Monarch remains part of the constitutional order",
      "Cabinet government and elected legislatures hold effective policy power",
      "The regime layer may still classify these countries as parliamentary democracies",
      "Useful for preserving form without confusing it with executive accountability",
    ],
    color: STRUCTURAL_FAMILY_META.constitutional_monarchy.fallback,
  },
  {
    slug: "absolute-monarchy",
    familyKey: "absolute_monarchy",
    name: "Absolute Monarchy",
    description: [
      "Absolute monarchies center political authority in a hereditary ruler or ruling royal structure rather than in a confidence-dependent elected cabinet.",
      "Some cases are unitary monarchies while others, like the UAE, require additional structural nuance because authority is distributed across hereditary subunits.",
      "Civica keeps this family separate from constitutional monarchy because the concentration of sovereign authority is categorically different.",
    ],
    characteristics: [
      "Hereditary authority remains politically decisive",
      "No confidence-dependent cabinet is the core constitutional mechanism",
      "Can include federal or emirate-based monarchical variants",
      "Often maps to royal dictatorship in the regime layer",
    ],
    color: STRUCTURAL_FAMILY_META.absolute_monarchy.fallback,
  },
  {
    slug: "one-party-state",
    familyKey: "one_party_state",
    name: "One-Party State",
    description: [
      "One-party states are structurally organized around the enduring dominance of a single party over the state apparatus, elections, and succession.",
      "Civica keeps this family separate because the party-state architecture is visible and important even when broader regime datasets classify these cases under civilian dictatorship.",
      "The point is to preserve truthful institutional form while still allowing the accountability lens to say something different when appropriate.",
    ],
    characteristics: [
      "Single-party dominance structures the state",
      "Opposition competition is tightly constrained or absent",
      "Party institutions and state institutions often overlap",
      "Communist party-state variants appear as subtypes where relevant",
    ],
    color: STRUCTURAL_FAMILY_META.one_party_state.fallback,
  },
  {
    slug: "military-rule",
    familyKey: "military_rule",
    name: "Military Rule",
    description: [
      "Military-rule systems are organized around military command, junta structures, or transitional armed-force councils rather than stable civilian constitutional accountability.",
      "Civica treats this as a structural family because the institutional center of power is different from both party-states and personalist civilian dictatorships.",
      "The family is intentionally narrow: it is meant to capture the constitutional location of authority, not simply a large military presence in politics.",
    ],
    characteristics: [
      "Armed forces or a junta occupy the governing center",
      "Civilian institutions are suspended, subordinated, or transitional",
      "Often associated with coups or provisional councils",
      "Maps naturally to military dictatorship in the regime layer",
    ],
    color: STRUCTURAL_FAMILY_META.military_rule.fallback,
  },
  {
    slug: "theocracy",
    familyKey: "theocracy",
    name: "Theocracy",
    description: [
      "Theocracies embed clerical or religious authority directly into the constitutional structure of the state, making religious rule part of the governing design rather than merely the cultural environment.",
      "Civica keeps theocracy separate from monarchy and civilian dictatorship because the source of authority and institutional logic are materially different.",
      "This family includes cases where a religious office, doctrine, or clerical order has constitutionally privileged authority over the state.",
    ],
    characteristics: [
      "Religious authority is structurally embedded in rule",
      "Clerical oversight or direct clerical control shapes government",
      "Can overlap with monarchical or elective religious offices",
      "Often diverges sharply from the regime-type layer in public interpretation",
    ],
    color: STRUCTURAL_FAMILY_META.theocracy.fallback,
  },
  {
    slug: "directorial-republic",
    familyKey: "directorial_republic",
    name: "Directorial Republic",
    description: [
      "Directorial republics organize executive power collegially rather than around a single president or prime minister. They are rare but conceptually important.",
      "Civica surfaces this family so that cases like Switzerland do not disappear into a generic presidential or parliamentary bucket that misstates how the executive is actually structured.",
      "These cases are small in number, but they matter precisely because they reveal where a single headline government label becomes too coarse.",
    ],
    characteristics: [
      "Executive power is collegial rather than singular",
      "A council or directorate functions as the effective executive",
      "Useful for truthfully handling exceptional but academically important cases",
      "Can diverge from the regime layer without contradiction",
    ],
    color: STRUCTURAL_FAMILY_META.directorial_republic.fallback,
  },
];
