"use client";

import { IdeologyCompass, type CompassParty } from "@/components/parties/IdeologyCompass";

import "../parties.css";

/**
 * Design-system demo of <IdeologyCompass> with representative V-Party-shaped
 * positions for a handful of well-known parties (real economic-left-right and
 * anti-pluralism estimates from the live data, abridged). Client component
 * because the compass is interactive (hover tooltips).
 *
 * Note the honest label: the vertical axis is "Pluralist ↔ Anti-pluralist"
 * (V-Party's Anti-Pluralism Index), not the political-compass meme's
 * authoritarian–libertarian axis.
 */

const DEMO_PARTIES: CompassParty[] = [
  {
    id: "cdu",
    partyName: "Christian Democratic Union",
    countryName: "Germany",
    seatCount: 164,
    seatShare: 0.26,
    color: "#0057a8",
    economicLR: 0.79,
    antiPlural: 0.05,
  },
  {
    id: "spd",
    partyName: "Social Democratic Party",
    countryName: "Germany",
    seatCount: 120,
    seatShare: 0.19,
    color: "#dd3366",
    economicLR: -0.81,
    antiPlural: 0.04,
  },
  {
    id: "linke",
    partyName: "Left Party (Die Linke)",
    countryName: "Germany",
    seatCount: 64,
    seatShare: 0.1,
    color: "#8e2d5a",
    economicLR: -3.43,
    antiPlural: 0.06,
  },
  {
    id: "afd",
    partyName: "Alternative for Germany",
    countryName: "Germany",
    seatCount: 152,
    seatShare: 0.24,
    color: "#009ee0",
    economicLR: 0.47,
    antiPlural: 0.66,
  },
  {
    id: "greens",
    partyName: "Green Party",
    countryName: "Germany",
    seatCount: 85,
    seatShare: 0.13,
    color: "#46962b",
    economicLR: -1.31,
    antiPlural: 0.03,
  },
  {
    id: "fidesz",
    partyName: "Fidesz",
    countryName: "Hungary",
    seatCount: 135,
    seatShare: 0.68,
    color: "#f36f21",
    economicLR: 0.9,
    antiPlural: 0.78,
  },
  {
    id: "pt",
    partyName: "Workers' Party",
    countryName: "Brazil",
    seatCount: 68,
    seatShare: 0.13,
    color: "#c4122e",
    economicLR: -1.6,
    antiPlural: 0.14,
  },
  {
    id: "anc",
    partyName: "African National Congress",
    countryName: "South Africa",
    seatCount: 159,
    seatShare: 0.4,
    color: "#000000",
    economicLR: -0.7,
    antiPlural: 0.22,
  },
];

export function IdeologyCompassDemo() {
  return <IdeologyCompass parties={DEMO_PARTIES} scaleBySeatShare />;
}
