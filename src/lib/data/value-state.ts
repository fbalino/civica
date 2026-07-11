export const DATA_VALUE_STATUSES = [
  "observed",
  "missing",
  "unknown",
  "not_applicable",
  "not_observed",
  "disputed",
  "withheld",
] as const;

export type DataValueStatus = (typeof DATA_VALUE_STATUSES)[number];

export const DATA_VALUE_STATUS_META: Record<
  DataValueStatus,
  { label: string; description: string; exposesValue: boolean }
> = {
  observed: {
    label: "Observed",
    description: "A source supplied a publishable value.",
    exposesValue: true,
  },
  missing: {
    label: "Missing",
    description: "A value was expected but is absent because the data pipeline or record is incomplete.",
    exposesValue: false,
  },
  unknown: {
    label: "Unknown",
    description: "The source explicitly reports that the value is unknown.",
    exposesValue: false,
  },
  not_applicable: {
    label: "Not applicable",
    description: "The concept does not apply to this jurisdiction or indicator.",
    exposesValue: false,
  },
  not_observed: {
    label: "Not observed",
    description: "The concept is in scope, but the source has no observation for this unit or period.",
    exposesValue: false,
  },
  disputed: {
    label: "Disputed",
    description: "A value is present, but an unresolved evidence conflict is recorded.",
    exposesValue: true,
  },
  withheld: {
    label: "Withheld",
    description: "A value is not published because its release or reuse is restricted.",
    exposesValue: false,
  },
};

export type StoredDataValue = {
  valueStatus?: string | null;
  valueStatusReason?: string | null;
};

export function parseDataValueStatus(value: string | null | undefined): DataValueStatus {
  return DATA_VALUE_STATUSES.includes(value as DataValueStatus)
    ? (value as DataValueStatus)
    : "observed";
}

export function publicDataValueStatus(input: {
  storedStatus?: string | null;
  disputed?: boolean;
  withheld?: boolean;
}): DataValueStatus {
  if (input.withheld) return "withheld";
  if (input.disputed) return "disputed";
  return parseDataValueStatus(input.storedStatus);
}

export function validateDataValueState(input: {
  status: DataValueStatus;
  hasValue: boolean;
  reason?: string | null;
}): string[] {
  const errors: string[] = [];
  const meta = DATA_VALUE_STATUS_META[input.status];
  if (meta.exposesValue !== input.hasValue) {
    errors.push(
      meta.exposesValue
        ? `${input.status} requires a stored value`
        : `${input.status} must not expose a stored value`,
    );
  }
  if (input.status !== "observed" && !input.reason?.trim()) {
    errors.push(`${input.status} requires a reason`);
  }
  if (input.status === "observed" && input.reason?.trim()) {
    errors.push("observed must not carry an absence/dispute reason");
  }
  return errors;
}

export function dataValueStatusLabel(status: DataValueStatus) {
  return DATA_VALUE_STATUS_META[status].label;
}
