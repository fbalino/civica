"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

export function CountrySearch({
  defaultValue,
  continent,
}: {
  defaultValue: string;
  continent: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  const submit = useCallback(
    (q: string) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (continent) params.set("continent", continent);
      const qs = params.toString();
      router.push(`/countries${qs ? `?${qs}` : ""}`);
    },
    [router, continent]
  );

  return (
    <div style={{ marginBottom: 24 }}>
      <input
        type="search"
        placeholder="Search countries by name, capital, or region..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit(value);
        }}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "10px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-13)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-card-border)",
          background: "var(--color-select-bg)",
          color: "var(--color-text-primary)",
        }}
      />
    </div>
  );
}
