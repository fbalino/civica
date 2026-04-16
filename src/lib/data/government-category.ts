export type GovernmentCategoryKey =
  | "presidential"
  | "parliamentary"
  | "semi-presidential"
  | "federal"
  | "constitutional-monarchy"
  | "absolute-monarchy"
  | "theocratic"
  | "communist"
  | "military"
  | "one-party"
  | "other";

export interface GovernmentCategory {
  key: GovernmentCategoryKey;
  label: string;
  color: string;
}

const OTHER: GovernmentCategory = {
  key: "other",
  label: "Other",
  color: "var(--color-gov-other)",
};

// Order matters: more specific patterns must come first so a string like
// "semi-presidential republic" doesn't get classified as "presidential".
const CATEGORIES: { matchers: RegExp[]; cat: GovernmentCategory }[] = [
  {
    matchers: [/semi[- ]presidential/, /semipresidential/],
    cat: {
      key: "semi-presidential",
      label: "Semi-presidential",
      color: "var(--color-gov-semi-presidential)",
    },
  },
  {
    matchers: [/constitutional monarchy/, /parliamentary constitutional monarchy/],
    cat: {
      key: "constitutional-monarchy",
      label: "Constitutional monarchy",
      color: "var(--color-gov-parliamentary)",
    },
  },
  {
    matchers: [/absolute monarchy/, /absolute.+?sultanate/, /sultanate/, /emirate/],
    cat: {
      key: "absolute-monarchy",
      label: "Absolute monarchy",
      color: "var(--color-gov-absolute)",
    },
  },
  {
    matchers: [
      /theocrat/,
      /ecclesiastical.*monarchy/,
      /islamic republic/,
    ],
    cat: {
      key: "theocratic",
      label: "Theocratic",
      color: "var(--color-gov-theocratic)",
    },
  },
  {
    matchers: [/communist/, /marxist/],
    cat: {
      key: "communist",
      label: "Communist",
      color: "#E44040",
    },
  },
  {
    matchers: [/military regime/, /military junta/, /junta/],
    cat: {
      key: "military",
      label: "Military",
      color: "#9B6DC6",
    },
  },
  {
    matchers: [/one[- ]party/, /single[- ]party/, /dictatorship/, /authoritarian/],
    cat: {
      key: "one-party",
      label: "One-party",
      color: "#C4764E",
    },
  },
  {
    matchers: [
      /federal.*parliamentary/,
      /parliamentary.*federal/,
      /federal parliamentary/,
    ],
    cat: {
      key: "parliamentary",
      label: "Parliamentary",
      color: "var(--color-gov-parliamentary)",
    },
  },
  {
    matchers: [
      /federal.*presidential/,
      /presidential.*federal/,
      /federal presidential/,
      /federal republic/,
      /federation/,
    ],
    cat: {
      key: "federal",
      label: "Federal",
      color: "var(--color-gov-parliamentary)",
    },
  },
  {
    matchers: [/parliamentary/, /westminster/],
    cat: {
      key: "parliamentary",
      label: "Parliamentary",
      color: "var(--color-gov-parliamentary)",
    },
  },
  {
    matchers: [/presidential republic/, /presidential/],
    cat: {
      key: "presidential",
      label: "Presidential",
      color: "var(--color-gov-presidential)",
    },
  },
  {
    matchers: [/republic/, /democracy/],
    cat: {
      key: "presidential",
      label: "Republic",
      color: "var(--color-gov-presidential)",
    },
  },
];

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/_/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyGovernment(raw: string | null | undefined): GovernmentCategory {
  if (!raw) return OTHER;
  const text = normalize(raw);
  if (!text) return OTHER;
  for (const { matchers, cat } of CATEGORIES) {
    if (matchers.some((rx) => rx.test(text))) return cat;
  }
  return OTHER;
}

export function govLabel(raw: string | null | undefined): string {
  return classifyGovernment(raw).label;
}

export function govColor(raw: string | null | undefined): string {
  return classifyGovernment(raw).color;
}
