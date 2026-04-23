"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  type AtlasHouse,
  type AtlasTab,
  buildAtlasUrl,
  isAtlasHouse,
  isAtlasTab,
  tabNeedsHouse,
} from "@/lib/atlas/ids";

export interface AtlasUrlState {
  slug: string | null;
  tab: AtlasTab;
  house: AtlasHouse;
  setTab: (tab: AtlasTab) => void;
  setHouse: (house: AtlasHouse) => void;
}

/**
 * Reads `slug`/`tab` from the path and `house` from the `?house=` query
 * param, with defaults (`chamber` / `lower`). Writes via `router.replace`
 * with `{ scroll: false }` so tab and house toggles don't jump to the top.
 *
 * Used by the shell route wrappers under `(shell)/atlas/*`. The legacy
 * `/` route does NOT use this hook — it keeps its own React state since
 * it never writes to the URL.
 */
export function useAtlasUrlState(): AtlasUrlState {
  const params = useParams<{ slug?: string; tab?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params?.slug ?? null;
  const rawTab = params?.tab;
  const tab: AtlasTab = rawTab && isAtlasTab(rawTab) ? rawTab : "chamber";
  const rawHouse = searchParams?.get("house");
  const house: AtlasHouse =
    rawHouse && isAtlasHouse(rawHouse) ? rawHouse : "lower";

  const setTab = useCallback(
    (next: AtlasTab) => {
      if (!slug) return;
      // ?house= only belongs on tabs that care about upper/lower. For
      // democracy/leaders/etc the param would just look broken in a
      // shared URL, and chat context already strips it server-side.
      // Preserving the user's house choice across tab switches is a
      // nice-to-have — re-introduce via localStorage if we want it back.
      const currentHouse = searchParams?.get("house");
      const base = buildAtlasUrl(slug, next);
      const url =
        currentHouse && tabNeedsHouse(next)
          ? `${base}?house=${currentHouse}`
          : base;
      router.replace(url, { scroll: false });
    },
    [router, slug, searchParams],
  );

  const setHouse = useCallback(
    (next: AtlasHouse) => {
      if (!slug) return;
      router.replace(buildAtlasUrl(slug, tab, next), { scroll: false });
    },
    [router, slug, tab],
  );

  return { slug, tab, house, setTab, setHouse };
}
