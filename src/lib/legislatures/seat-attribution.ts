/**
 * Seat-by-seat attribution for a drawn chamber.
 *
 * A chamber is drawn with exactly `seatCount` seats (its statutory total).
 * Party rows fill seats in the order given. Two mismatches are common in the
 * source composition data and both are handled without inventing anything:
 *
 *  - Party rows add up to FEWER seats than the chamber total (vacancies,
 *    presiding officers, appointed or unelected members, partial releases, or
 *    a chamber with no party rows at all). The remaining seats are
 *    `unattributed`: they are never given a party's colour, name, or count.
 *  - Party rows add up to MORE seats than the chamber total (aggregation or
 *    rounding artefacts upstream). The drawing stops at the chamber total, so
 *    no extra seats appear; `excessPartySeats` records how many reported
 *    party seats could not be drawn so the caller can say so.
 */

export interface SeatAttributionParty {
  id: string;
  name: string;
  color: string;
  seats: number;
}

export type SeatAssignment =
  | { kind: "party"; id: string; name: string; color: string }
  | { kind: "unattributed" };

export interface SeatAttribution {
  /** One entry per drawn seat, in drawing order. */
  seats: SeatAssignment[];
  /** Seats drawn in a party's colour. */
  attributedSeats: number;
  /** Seats with no reported party. */
  unattributedSeats: number;
  /** Sum of the party rows' seat counts, as reported. */
  reportedPartySeats: number;
  /** Reported party seats beyond the chamber total (not drawn). */
  excessPartySeats: number;
}

/** Plain-language label for a seat with no reported party. */
export const UNATTRIBUTED_SEAT_LABEL = "No party reported";

function wholeSeats(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function attributeSeats(
  seatCount: number,
  parties: readonly SeatAttributionParty[],
): SeatAttribution {
  const drawn = wholeSeats(seatCount);
  const seats: SeatAssignment[] = [];
  let reportedPartySeats = 0;

  for (const party of parties) {
    const partySeats = wholeSeats(party.seats);
    reportedPartySeats += partySeats;
    for (let k = 0; k < partySeats && seats.length < drawn; k++) {
      seats.push({
        kind: "party",
        id: party.id,
        name: party.name,
        color: party.color,
      });
    }
  }

  const attributedSeats = seats.length;
  while (seats.length < drawn) seats.push({ kind: "unattributed" });

  return {
    seats,
    attributedSeats,
    unattributedSeats: drawn - attributedSeats,
    reportedPartySeats,
    excessPartySeats: Math.max(0, reportedPartySeats - drawn),
  };
}

/** "1 seat" / "12 seats". */
export function seatCountLabel(count: number): string {
  return `${count} ${count === 1 ? "seat" : "seats"}`;
}
