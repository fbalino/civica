const WELL_KNOWN_PARTIES: Record<string, string> = {
  "democratic party": "#3333FF",
  "republican party": "#E81B23",
  "labour party": "#E4003B",
  "conservative party": "#0087DC",
  "liberal democrats": "#FAA61A",
  "scottish national party": "#FDF38E",
  "sinn féin": "#326760",
  "plaid cymru": "#005B54",
  "partido dos trabalhadores": "#CC0000",
  "partido liberal": "#002776",
  "movimento democrático brasileiro": "#00A859",
  "união brasil": "#003DA5",
  "progressistas": "#0080FF",
  "partido social democrático": "#2E8B57",
  "partido socialista obrero español": "#EE1C25",
  "partido popular": "#1D84CE",
  "vox": "#63BE21",
  "la république en marche": "#FFD600",
  "rassemblement national": "#0D378A",
  "les républicains": "#0066CC",
  "cdu": "#000000",
  "spd": "#EB001F",
  "grüne": "#64A12D",
  "fdp": "#FFED00",
  "afd": "#009EE0",
  "bharatiya janata party": "#FF9933",
  "indian national congress": "#19AAED",
  "liberal democratic party": "#D7003A",
  "constitutional democratic party": "#1B4D89",
  "communist party of china": "#DE2910",
  "united russia": "#0C2D83",
  "african national congress": "#009639",
  "democratic alliance": "#005BA6",
  "all progressives congress": "#02B352",
  "peoples democratic party": "#E30613",
  "fidesz": "#FD8204",
  "prawo i sprawiedliwość": "#263778",
  "platforma obywatelska": "#F57F17",
  "likud": "#1B4D89",
  "yesh atid": "#26C6DA",
  "australian labor party": "#DE3533",
  "liberal party of australia": "#0047AB",
  "liberal party of canada": "#D71920",
  "conservative party of canada": "#1A4782",
  "new democratic party": "#F58220",
  "morena": "#6F2236",
};

const NAMED_COLORS: Record<string, string> = {
  red: "#C44040",
  blue: "#4070C4",
  green: "#40A060",
  yellow: "#C4A030",
  purple: "#8060B0",
  teal: "#409090",
  gray: "#808080",
  orange: "#C07030",
  black: "#333333",
  pink: "#D06090",
  brown: "#8B6040",
  gold: "#B8960C",
};

const FALLBACK_PALETTE = [
  "#4070C4", "#C44040", "#40A060", "#C4A030", "#8060B0",
  "#409090", "#C07030", "#D06090", "#8B6040", "#B8960C",
];

export function resolvePartyColor(
  dbColor: string | null | undefined,
  partyName: string | null | undefined,
  index: number,
): string {
  if (dbColor) {
    if (dbColor.startsWith("#") || dbColor.startsWith("oklch") || dbColor.startsWith("rgb")) return dbColor;
    const named = NAMED_COLORS[dbColor.toLowerCase()];
    if (named) return named;
  }

  if (partyName) {
    const key = partyName.toLowerCase().trim();
    const known = WELL_KNOWN_PARTIES[key];
    if (known) return known;
    for (const [pattern, color] of Object.entries(WELL_KNOWN_PARTIES)) {
      if (key.includes(pattern) || pattern.includes(key)) return color;
    }
  }

  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}
