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
    <div className="mb-6">
      <input
        type="search"
        placeholder="Search countries by name, capital, or region..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit(value);
        }}
        className="w-full max-w-md px-4 py-2.5 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow"
      />
    </div>
  );
}
