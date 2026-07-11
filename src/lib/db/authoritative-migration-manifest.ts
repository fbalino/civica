import type { AuthoritativeMigration } from "./authoritative-migrations";

export const AUTHORITATIVE_MIGRATIONS: readonly AuthoritativeMigration[] = [
  {
    id: "0000_authoritative_baseline",
    path: "drizzle/authoritative/0000_authoritative_baseline.sql",
    sha256: "3ba983b97fc6eeaad67c38c069ec72edf0371e62c2f7037380d86343dc13a418",
    baseline: true,
  },
] as const;
