import type { ReactNode } from "react";
import { Chip } from "@/components/editorial/Pill";
import {
  DATA_VALUE_STATUS_META,
  dataValueStatusLabel,
  type DataValueStatus,
} from "@/lib/data/value-state";

const TONES: Record<
  Exclude<DataValueStatus, "observed">,
  "neutral" | "sage" | "sand" | "rose" | "blue" | "accent"
> = {
  missing: "rose",
  unknown: "neutral",
  not_applicable: "sand",
  not_observed: "blue",
  disputed: "accent",
  withheld: "sage",
};

export function DataValueState({
  status,
  reason,
  children,
}: {
  status: DataValueStatus;
  reason?: string | null;
  children?: ReactNode;
}) {
  if (status === "observed") return <>{children}</>;
  const meta = DATA_VALUE_STATUS_META[status];
  return (
    <span aria-label={`${meta.label}. ${reason || meta.description}`}>
      {meta.exposesValue && children ? <>{children} </> : null}
      <Chip variant={TONES[status]}>{dataValueStatusLabel(status)}</Chip>
    </span>
  );
}
