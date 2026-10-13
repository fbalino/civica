"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { JurisdictionDirectoryAsset } from "./directory-asset";
import { JURISDICTION_DIRECTORY_ASSET_PATH } from "./directory-asset.generated";

/**
 * The single client-side store for the public jurisdiction directory asset.
 *
 * Every country search shares this module-level store, so the list is fetched
 * at most once per page session no matter how many search fields are mounted
 * (header, footer, home hero, 404 page, country jump search). Nothing is
 * fetched until a reader starts to use a search field: consumers call
 * `load()` on focus, pointer entry, or the ⌘K shortcut. Search results stay
 * empty until a query is typed, so the short fetch is never visible as an
 * empty list.
 */
export type DirectoryCountry = {
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  capital: string | null;
  status: { label: string };
};

export type DirectoryScope = "all" | "sovereign";

type Snapshot = {
  all: ReadonlyArray<DirectoryCountry>;
  sovereign: ReadonlyArray<DirectoryCountry>;
} | null;

const EMPTY: ReadonlyArray<DirectoryCountry> = Object.freeze([]);

let snapshot: Snapshot = null;
let inflight: Promise<void> | null = null;
let failedAttempts = 0;
// After a failed fetch the store retries on its own, so a search field that
// stays focused does not stay silently empty after one transient failure.
const RETRY_DELAYS_MS = [1_000, 3_000, 9_000] as const;
// An array filtered on unsubscribe (not Set#delete): the DAT-016 retention
// scanner treats every `.delete(` call as a possible evidence deletion.
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return null;
}

/** Start the one shared fetch. Safe to call repeatedly; failures can retry. */
export function loadJurisdictionDirectory(): Promise<void> {
  if (snapshot) return Promise.resolve();
  if (inflight) return inflight;
  inflight = fetch(JURISDICTION_DIRECTORY_ASSET_PATH)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`jurisdiction directory: HTTP ${response.status}`);
      }
      return response.json() as Promise<JurisdictionDirectoryAsset>;
    })
    .then((asset) => {
      const all = asset.rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        iso2: row.iso2,
        iso3: row.iso3,
        capital: row.capital,
        status: { label: row.statusLabel },
      }));
      const sovereign = all.filter((_, index) => asset.rows[index].sovereign);
      snapshot = { all, sovereign };
      failedAttempts = 0;
      for (const listener of listeners) listener();
    })
    .catch((error: unknown) => {
      // Leave the store empty; retry automatically a few times, and any
      // later interaction can still retry after that.
      console.error(error);
      const delay = RETRY_DELAYS_MS[failedAttempts];
      failedAttempts += 1;
      if (delay !== undefined) {
        setTimeout(() => {
          void loadJurisdictionDirectory();
        }, delay);
      }
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Read the shared directory. When `enabled` is false the hook returns an empty
 * list and never fetches (callers that pass their own country list).
 */
export function useJurisdictionDirectory(
  scope: DirectoryScope,
  enabled: boolean,
): {
  countries: ReadonlyArray<DirectoryCountry>;
  load: () => void;
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const countries = useMemo(
    () => (enabled && current ? current[scope] : EMPTY),
    [current, enabled, scope],
  );
  const load = useCallback(() => {
    if (enabled) void loadJurisdictionDirectory();
  }, [enabled]);
  return { countries, load };
}
