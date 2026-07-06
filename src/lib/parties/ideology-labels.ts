/**
 * Ideology-label helper for the party browser.
 *
 * Maps a V-Party `v2pariglef` economic left–right point estimate (roughly
 * −4 far-left … +4 far-right, centred on 0) onto a readable bucket label + a
 * canonical Chip tone. The buckets mirror the resolution's Far-left … Far-right
 * framing but are derived from the CONTINUOUS interval estimate that is actually
 * plotted, so the chip and the compass agree.
 *
 * Tones are canonical Chip tonal variants only (no colour literals): the left
 * half reads `blue`, centre `neutral`, the right half `sand`, keeping the chips
 * on-system rather than inventing a red/blue partisan palette.
 */

import type { ComponentProps } from "react";
import type { Chip } from "@/components/editorial/Pill";

type ChipTone = NonNullable<ComponentProps<typeof Chip>["variant"]>;

export interface IdeologyLabel {
  label: string;
  tone: ChipTone;
}

// Thresholds on the continuous economic left–right estimate. Symmetric around
// 0 so "centre" is a genuine midpoint band.
const FAR = 2.5;
const MODERATE = 0.75;

export function ideologyLabelForEconLR(econLR: number): IdeologyLabel {
  if (econLR <= -FAR) return { label: "Far-left", tone: "blue" };
  if (econLR <= -MODERATE) return { label: "Left", tone: "blue" };
  if (econLR < MODERATE) return { label: "Centre", tone: "neutral" };
  if (econLR < FAR) return { label: "Right", tone: "sand" };
  return { label: "Far-right", tone: "sand" };
}
