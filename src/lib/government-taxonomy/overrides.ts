export const GOVERNMENT_TAXONOMY_OVERRIDES = {
  CHE: {
    structuralFamily: "directorial_republic",
    structuralSubtype: "federal_directorial_republic",
    isFederal: true,
    isMonarchy: false,
    executiveStructure: "collegial_executive",
    governmentDependency: "fixed_term",
    overrideNote:
      "Switzerland's Federal Council is a fixed-term collegial executive, so Civica keeps the BR/CGV regime coding but overrides the structural form away from a conventional presidential republic.",
  },
  SMR: {
    structuralFamily: "parliamentary_democracy",
    structuralSubtype: "parliamentary_republic",
    isFederal: false,
    isMonarchy: false,
    executiveStructure: "collegial_head_of_state",
    governmentDependency: "legislative_confidence",
    overrideNote:
      "San Marino remains a parliamentary republic structurally, but the Captains Regent make the head-of-state arrangement collective rather than singular.",
  },
  VAT: {
    structuralFamily: "theocracy",
    structuralSubtype: "elective_theocratic_monarchy",
    isFederal: false,
    isMonarchy: true,
    executiveStructure: "clerical_monarchic",
    governmentDependency: "clerical_rule",
    overrideNote:
      "Vatican City is treated as a theocratic elective monarchy rather than a generic monarchy or republic.",
  },
  UAE: {
    structuralFamily: "absolute_monarchy",
    structuralSubtype: "federal_emirate_monarchy",
    isFederal: true,
    isMonarchy: true,
    executiveStructure: "collective_monarchic",
    governmentDependency: "absolute_rule",
    overrideNote:
      "The United Arab Emirates is a federation of hereditary emirates, so the structural form is modeled as a federal emirate monarchy.",
  },
  AND: {
    structuralFamily: "constitutional_monarchy",
    structuralSubtype: "co_principality",
    isFederal: false,
    isMonarchy: true,
    executiveStructure: "dual_monarchic_head_of_state",
    governmentDependency: "legislative_confidence",
    overrideNote:
      "Andorra's co-princes make it a dual-monarchic constitutional system rather than a standard constitutional monarchy.",
  },
  LIE: {
    structuralFamily: "constitutional_monarchy",
    structuralSubtype: "constitutional_monarchy",
    isFederal: false,
    isMonarchy: true,
    executiveStructure: "monarchic_executive",
    governmentDependency: "legislative_confidence",
    overrideNote:
      "Liechtenstein retains an unusually strong princely executive inside a constitutional monarchy.",
  },
} as const;
