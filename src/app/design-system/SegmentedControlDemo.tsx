"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/editorial/SegmentedControl";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "countries", label: "Countries" },
  { value: "regions", label: "Regions" },
  { value: "indicators", label: "Indicators" },
] as const;

/** Live, interactive demo of the canonical SegmentedControl for /design-system. */
export function SegmentedControlDemo() {
  const [value, setValue] = useState<(typeof OPTIONS)[number]["value"]>("all");
  return (
    <SegmentedControl
      value={value}
      options={OPTIONS}
      onChange={setValue}
      ariaLabel="Filter scope"
    />
  );
}
