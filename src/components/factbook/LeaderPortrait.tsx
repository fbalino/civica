"use client";

import { useState } from "react";
import { wikimediaUrl } from "@/lib/data/country-photos";
import { Tooltip } from "@/components/editorial/Tooltip";

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
 * HOVER: the portrait carries the canonical <Tooltip> primitive — an INSTANT,
 * design-system tooltip (no slow native `title`). It shows the person's name and
 * office, and, when a portrait is present, the photo credit line beneath (the
 * legally/ethically required attribution) — so credit is surfaced without an
 * ellipsised caption or a native-title delay. Keyboard-focusable and touch-
 * operable via the <Tooltip> trigger.
 *
 * Client component ONLY because the image needs an onError fallback; the
 * monogram path is otherwise identical to the prior server-rendered avatar,
 * so a leader without a portrait still renders the monogram (and its tooltip).
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
  office,
  credit,
}: {
  photoFile: string | null;
  personName: string;
  /** The office this person holds — shown under their name in the tooltip. */
  office?: string | null;
  /** Full photo credit line; folded into the tooltip when a photo shows. */
  credit?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photoFile) && !failed;

  const frame = showPhoto ? (
    <span className="lead-avatar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lead-avatar-photo"
        src={wikimediaUrl(photoFile!, 240)}
        alt=""
        aria-hidden="true"
        width={96}
        height={120}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  ) : (
    <span className="lead-avatar">
      <span className="lead-avatar-monogram" aria-hidden>
        {initialsOf(personName)}
      </span>
    </span>
  );

  const tip = (
    <span className="lead-portrait-tip">
      <span className="lead-portrait-tip-name">{personName}</span>
      {office && <span className="lead-portrait-tip-office">{office}</span>}
      {showPhoto && credit && (
        <span className="lead-portrait-tip-credit">{credit}</span>
      )}
    </span>
  );

  return <Tooltip content={tip}>{frame}</Tooltip>;
}
