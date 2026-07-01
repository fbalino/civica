"use client";

import { useState } from "react";
import { wikimediaUrl } from "@/lib/data/country-photos";
import { SourceCreditTooltip } from "@/components/factbook/SourceCreditTooltip";

/*
 * LeaderPortrait — the portrait for a principal-leadership card.
 *
 * Renders the Wikidata P18 portrait (P2 enrichment) as an <img> built from the
 * stored Commons FILE NAME via wikimediaUrl(file, size) — the same
 * hotlink-the-CDN approach the country photo galleries use. Falls back to the
 * existing monogram avatar when:
 *   - photoFile is null (no free portrait for this leader), OR
 *   - the Commons file 404s / fails to load at render time.
 *
 * FRAME: a rectangular, portrait-oriented (4:5, taller than wide) card with a
 * hairline border and a small rounded-rectangle radius (--radius-md) — NOT a
 * circle and NOT a hard square. Official portraits sit high in frame, so the
 * photo is `object-fit: cover` anchored `top center` to keep the head/face from
 * clipping. The monogram fallback fills the SAME rectangular frame so present
 * and absent portraits read consistently.
 *
 * CREDIT: photo credits are often long ("Photo: {credit} · {license} ·
 * Wikimedia Commons"). Rather than an ellipsised inline caption, the full credit
 * is passed to `credit` and revealed on hover/focus of the portrait via the
 * reusable <SourceCreditTooltip> (also exposed as a native title/aria-label for
 * keyboard + AT + no-JS). The monogram fallback has no credit.
 *
 * Client component ONLY because the image needs an onError fallback; the
 * monogram path is otherwise identical to the prior server-rendered avatar,
 * so a leader without a portrait still renders the monogram with no JS.
 */

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function LeaderPortrait({
  photoFile,
  personName,
  credit,
}: {
  photoFile: string | null;
  personName: string;
  /** Full photo credit line; when present + a photo shows, revealed on hover. */
  credit?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photoFile) && !failed;

  if (!showPhoto) {
    return (
      <span className="lead-avatar">
        <span className="lead-avatar-monogram" aria-hidden>
          {initialsOf(personName)}
        </span>
      </span>
    );
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="lead-avatar-photo"
      src={wikimediaUrl(photoFile!, 240)}
      alt={`Portrait of ${personName}`}
      width={96}
      height={120}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );

  // When we have a credit, wrap the framed image in the reusable tooltip so the
  // long attribution reveals on hover/focus instead of truncating in a caption.
  if (credit) {
    return (
      <SourceCreditTooltip credit={credit} className="lead-avatar">
        {img}
      </SourceCreditTooltip>
    );
  }

  return <span className="lead-avatar">{img}</span>;
}
