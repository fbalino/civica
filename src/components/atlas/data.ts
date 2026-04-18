export const PARTY_COLORS: Record<string, string> = {
  red: "oklch(55% 0.16 25)",
  blue: "oklch(52% 0.13 245)",
  green: "oklch(56% 0.13 145)",
  yellow: "oklch(72% 0.14 85)",
  purple: "oklch(50% 0.13 310)",
  teal: "oklch(58% 0.10 195)",
  gray: "oklch(55% 0.01 90)",
  orange: "oklch(64% 0.15 55)",
  black: "oklch(28% 0.02 90)",
};

export interface Party {
  id: string;
  name: string;
  seats: number;
  color: string;
}

export interface Chamber {
  name: string;
  total: number;
  sub: string;
  parties: Party[];
}

export interface ChamberData {
  lower: Chamber;
  upper: Chamber | null;
  branches?: { exec: string; legis: string; jud: string };
  coalition?: string;
  next?: string;
  bills: Bill[];
}

export interface Bill {
  title: string;
  status: string;
  stage: number;
  summary: string;
  tags: string[];
  votes: { yes: number; no: number; abs: number } | null;
  sponsor: string;
}

export interface Country {
  id: string;
  name: string;
  leader: string;
  gov: string;
  region: string;
  pop: string;
  gdp: string;
  capital: string;
  featured?: boolean;
}

export const COUNTRIES: Country[] = [
  { id: "usa", name: "United States", leader: "Head of State Donald Trump", gov: "Federal Republic", region: "Americas", pop: "334M", gdp: "$27.4T", capital: "Washington, D.C.", featured: true },
  { id: "can", name: "Canada", leader: "Head of Government Mark Carney", gov: "Parliamentary Dem.", region: "Americas", pop: "40M", gdp: "$2.1T", capital: "Ottawa" },
  { id: "mex", name: "Mexico", leader: "Head of State Claudia Sheinbaum", gov: "Federal Republic", region: "Americas", pop: "129M", gdp: "$1.8T", capital: "Mexico City" },
  { id: "bra", name: "Brazil", leader: "Head of State Luiz Inacio Lula da Silva", gov: "Federal Republic", region: "Americas", pop: "216M", gdp: "$2.2T", capital: "Brasilia", featured: true },
  { id: "arg", name: "Argentina", leader: "Head of State Javier Milei", gov: "Federal Republic", region: "Americas", pop: "46M", gdp: "$640B", capital: "Buenos Aires" },
  { id: "gbr", name: "United Kingdom", leader: "Head of Government Keir Starmer", gov: "Parliamentary Dem.", region: "Europe", pop: "68M", gdp: "$3.3T", capital: "London", featured: true },
  { id: "fra", name: "France", leader: "Head of State Emmanuel Macron", gov: "Semi-Presidential", region: "Europe", pop: "68M", gdp: "$3.0T", capital: "Paris", featured: true },
  { id: "deu", name: "Germany", leader: "Head of Government Friedrich Merz", gov: "Federal Republic", region: "Europe", pop: "84M", gdp: "$4.4T", capital: "Berlin", featured: true },
  { id: "esp", name: "Spain", leader: "Head of Government Pedro Sanchez", gov: "Parliamentary Dem.", region: "Europe", pop: "48M", gdp: "$1.6T", capital: "Madrid" },
  { id: "ita", name: "Italy", leader: "Head of Government Giorgia Meloni", gov: "Parliamentary Dem.", region: "Europe", pop: "59M", gdp: "$2.2T", capital: "Rome" },
  { id: "rus", name: "Russia", leader: "Head of State Vladimir Putin", gov: "Federal Republic", region: "Europe", pop: "144M", gdp: "$2.0T", capital: "Moscow" },
  { id: "egy", name: "Egypt", leader: "Head of State Abdel Fattah el-Sisi", gov: "Presidential Rep.", region: "Africa", pop: "110M", gdp: "$400B", capital: "Cairo" },
  { id: "nga", name: "Nigeria", leader: "Head of State Bola Ahmed Tinubu", gov: "Federal Republic", region: "Africa", pop: "224M", gdp: "$510B", capital: "Abuja" },
  { id: "zaf", name: "South Africa", leader: "Head of State Cyril Ramaphosa", gov: "Parliamentary Dem.", region: "Africa", pop: "60M", gdp: "$410B", capital: "Pretoria" },
  { id: "ken", name: "Kenya", leader: "Head of State William Ruto", gov: "Presidential Rep.", region: "Africa", pop: "55M", gdp: "$115B", capital: "Nairobi" },
  { id: "chn", name: "China", leader: "Head of State Xi Jinping", gov: "One-Party State", region: "Asia", pop: "1.41B", gdp: "$17.9T", capital: "Beijing" },
  { id: "ind", name: "India", leader: "Head of Government Narendra Modi", gov: "Federal Republic", region: "Asia", pop: "1.43B", gdp: "$3.7T", capital: "New Delhi" },
  { id: "jpn", name: "Japan", leader: "Head of Government Sanae Takaichi", gov: "Parliamentary Monarchy", region: "Asia", pop: "124M", gdp: "$4.2T", capital: "Tokyo", featured: true },
  { id: "kor", name: "South Korea", leader: "Head of State Lee Jae Myung", gov: "Presidential Rep.", region: "Asia", pop: "52M", gdp: "$1.7T", capital: "Seoul" },
  { id: "sau", name: "Saudi Arabia", leader: "Head of State Salman bin Abdulaziz Al Saud", gov: "Absolute Monarchy", region: "Asia", pop: "36M", gdp: "$1.1T", capital: "Riyadh", featured: true },
  { id: "idn", name: "Indonesia", leader: "Head of State Prabowo Subianto", gov: "Presidential Rep.", region: "Asia", pop: "278M", gdp: "$1.4T", capital: "Jakarta" },
  { id: "aus", name: "Australia", leader: "Head of Government Anthony Albanese", gov: "Parliamentary Dem.", region: "Oceania", pop: "26M", gdp: "$1.7T", capital: "Canberra" },
  { id: "nzl", name: "New Zealand", leader: "Head of Government Christopher Luxon", gov: "Parliamentary Dem.", region: "Oceania", pop: "5M", gdp: "$250B", capital: "Wellington" },
];

export const CHAMBERS: Record<string, ChamberData> = {
  fra: {
    lower: {
      name: "Assemblee Nationale", total: 577,
      sub: "577 seats \u00b7 5-year terms \u00b7 constituency elections \u00b7 last: Jun 2024",
      parties: [
        { id: "nfp", name: "Nouveau Front Populaire", seats: 182, color: "red" },
        { id: "ens", name: "Ensemble", seats: 168, color: "yellow" },
        { id: "rn", name: "Rassemblement National", seats: 142, color: "blue" },
        { id: "lr", name: "Les Republicains", seats: 48, color: "teal" },
        { id: "ind", name: "Non-inscrits", seats: 37, color: "gray" },
      ],
    },
    upper: {
      name: "Senat", total: 348,
      sub: "348 seats \u00b7 6-year terms \u00b7 indirectly elected",
      parties: [
        { id: "lr", name: "Les Republicains", seats: 132, color: "teal" },
        { id: "ens", name: "Ensemble", seats: 78, color: "yellow" },
        { id: "soc", name: "Socialistes", seats: 64, color: "red" },
        { id: "cen", name: "Union Centriste", seats: 52, color: "blue" },
        { id: "ind", name: "Divers", seats: 22, color: "gray" },
      ],
    },
    branches: { exec: "President & Cabinet (PM)", legis: "Assemblee + Senat", jud: "Conseil Constitutionnel" },
    coalition: "Ensemble \u00b7 LR", next: "2029",
    bills: [
      { title: "Loi sur la souverainete energetique", status: "In committee", stage: 1, summary: "Accelerates nuclear and offshore-wind build-out; caps regulated tariffs through 2030; creates a state-guaranteed green bond.", tags: ["Energy", "Climate"], votes: null, sponsor: "Minister of Energy" },
      { title: "Reforme de la fonction publique", status: "Passed lower", stage: 3, summary: "Introduces performance reviews for senior civil servants and merges four oversight bodies into a single agency.", tags: ["Government"], votes: { yes: 308, no: 242, abs: 27 }, sponsor: "PM's office" },
      { title: "Protection du numerique mineur", status: "Introduced", stage: 0, summary: "Raises the minimum age for social-media consent to 16; requires platform age verification.", tags: ["Digital", "Youth"], votes: null, sponsor: "Dep. Marin" },
    ],
  },
  usa: {
    lower: {
      name: "House of Representatives", total: 435,
      sub: "435 seats \u00b7 2-year terms \u00b7 one per congressional district",
      parties: [
        { id: "rep", name: "Republicans", seats: 222, color: "red" },
        { id: "dem", name: "Democrats", seats: 213, color: "blue" },
      ],
    },
    upper: {
      name: "Senate", total: 100,
      sub: "100 seats \u00b7 6-year staggered terms \u00b7 two per state",
      parties: [
        { id: "dem", name: "Democrats", seats: 51, color: "blue" },
        { id: "rep", name: "Republicans", seats: 49, color: "red" },
      ],
    },
    branches: { exec: "President & Cabinet", legis: "House + Senate", jud: "Supreme Court" },
    coalition: "Split government", next: "2026",
    bills: [
      { title: "Digital Privacy & AI Accountability Act", status: "In committee", stage: 1, summary: "Creates a federal baseline for data rights; requires impact assessments for high-risk AI systems.", tags: ["Digital", "AI"], votes: null, sponsor: "Sen. T. Reyes" },
      { title: "Infrastructure Renewal Extension", status: "Passed Senate", stage: 3, summary: "Extends the 2021 infrastructure program for 5 years; adds climate-resilience set-asides.", tags: ["Infrastructure"], votes: { yes: 63, no: 35, abs: 2 }, sponsor: "Sen. M. Holloway" },
      { title: "Coastal Resilience Act", status: "Introduced", stage: 0, summary: "Authorizes $14B in coastal flood defense grants to coastal states and tribal nations.", tags: ["Climate"], votes: null, sponsor: "Rep. J. Park" },
    ],
  },
  gbr: {
    lower: {
      name: "House of Commons", total: 650,
      sub: "650 seats \u00b7 up to 5-year terms \u00b7 constituency elections",
      parties: [
        { id: "lab", name: "Labour", seats: 411, color: "red" },
        { id: "con", name: "Conservatives", seats: 121, color: "blue" },
        { id: "ld", name: "Lib Dems", seats: 72, color: "orange" },
        { id: "snp", name: "SNP", seats: 9, color: "yellow" },
        { id: "oth", name: "Others", seats: 37, color: "gray" },
      ],
    },
    upper: {
      name: "House of Lords", total: 784,
      sub: "Appointed & hereditary peers",
      parties: [
        { id: "con", name: "Conservative", seats: 273, color: "blue" },
        { id: "lab", name: "Labour", seats: 184, color: "red" },
        { id: "cb", name: "Crossbench", seats: 182, color: "gray" },
        { id: "ld", name: "Lib Dem", seats: 78, color: "orange" },
        { id: "oth", name: "Others", seats: 67, color: "teal" },
      ],
    },
    branches: { exec: "PM & Cabinet \u00b7 Monarch ceremonial", legis: "Commons + Lords", jud: "Supreme Court of the UK" },
    coalition: "Labour majority", next: "2029",
    bills: [
      { title: "Housing & Planning Reform Bill", status: "In committee", stage: 1, summary: "Streamlines planning permission in designated growth zones; sets a 1.5M home target by 2029.", tags: ["Housing"], votes: null, sponsor: "Sec. of State for Housing" },
      { title: "NHS Workforce Plan 2026", status: "Passed Commons", stage: 3, summary: "Funds 25,000 additional training places over 4 years; expands GP contracts.", tags: ["Health"], votes: { yes: 411, no: 121, abs: 118 }, sponsor: "Health Secretary" },
    ],
  },
  deu: {
    lower: {
      name: "Bundestag", total: 630,
      sub: "630 seats \u00b7 4-year terms \u00b7 mixed-member proportional",
      parties: [
        { id: "spd", name: "SPD", seats: 164, color: "red" },
        { id: "cdu", name: "CDU/CSU", seats: 197, color: "black" },
        { id: "grn", name: "Grune", seats: 118, color: "green" },
        { id: "fdp", name: "FDP", seats: 91, color: "yellow" },
        { id: "afd", name: "AfD", seats: 60, color: "blue" },
      ],
    },
    upper: {
      name: "Bundesrat", total: 69,
      sub: "69 seats \u00b7 appointed by state governments",
      parties: [
        { id: "cdu", name: "CDU/CSU states", seats: 32, color: "black" },
        { id: "spd", name: "SPD states", seats: 18, color: "red" },
        { id: "grn", name: "Green states", seats: 13, color: "green" },
        { id: "oth", name: "Others", seats: 6, color: "yellow" },
      ],
    },
    branches: { exec: "Chancellor & Cabinet \u00b7 President ceremonial", legis: "Bundestag + Bundesrat", jud: "Federal Constitutional Court" },
    coalition: "SPD \u00b7 Grune \u00b7 FDP", next: "2029",
    bills: [
      { title: "Wohnraumbeschleunigungsgesetz", status: "Bundestag debate", stage: 2, summary: "Speeds up housing construction by simplifying building codes and digital permits.", tags: ["Housing"], votes: null, sponsor: "Minister for Housing" },
      { title: "Klimaneutralitatsrahmen 2040", status: "In committee", stage: 1, summary: "Sets binding sectoral CO2 budgets through 2040 and creates an independent climate council.", tags: ["Climate"], votes: null, sponsor: "Ministry of Environment" },
    ],
  },
  jpn: {
    lower: {
      name: "Shugiin (House of Representatives)", total: 465,
      sub: "465 seats \u00b7 4-year terms",
      parties: [
        { id: "ldp", name: "Liberal Democratic", seats: 191, color: "green" },
        { id: "cdp", name: "Constitutional Dem.", seats: 148, color: "blue" },
        { id: "ish", name: "Ishin", seats: 38, color: "yellow" },
        { id: "kom", name: "Komeito", seats: 24, color: "orange" },
        { id: "oth", name: "Others", seats: 64, color: "gray" },
      ],
    },
    upper: {
      name: "Sangiin (House of Councillors)", total: 248,
      sub: "248 seats \u00b7 6-year terms",
      parties: [
        { id: "ldp", name: "Liberal Democratic", seats: 115, color: "green" },
        { id: "cdp", name: "Constitutional Dem.", seats: 38, color: "blue" },
        { id: "kom", name: "Komeito", seats: 27, color: "orange" },
        { id: "oth", name: "Others", seats: 68, color: "gray" },
      ],
    },
    branches: { exec: "Prime Minister & Cabinet \u00b7 Emperor ceremonial", legis: "Shugiin + Sangiin", jud: "Supreme Court of Japan" },
    coalition: "LDP \u00b7 Komeito", next: "2028",
    bills: [
      { title: "Digital ID Expansion Act", status: "Diet review", stage: 1, summary: "Makes the My Number card the default identifier for health insurance and driver's licenses.", tags: ["Digital"], votes: null, sponsor: "Digital Agency" },
      { title: "Child Care Support Enhancement", status: "Passed lower", stage: 3, summary: "Expands paid parental leave to 18 months; funds 100,000 additional childcare slots.", tags: ["Family"], votes: { yes: 302, no: 140, abs: 23 }, sponsor: "Cabinet Office" },
    ],
  },
  bra: {
    lower: {
      name: "Camara dos Deputados", total: 513,
      sub: "513 seats \u00b7 4-year terms \u00b7 proportional by state",
      parties: [
        { id: "pt", name: "Partido dos Trabalhadores", seats: 68, color: "red" },
        { id: "pl", name: "Partido Liberal", seats: 99, color: "blue" },
        { id: "uni", name: "Uniao Brasil", seats: 59, color: "orange" },
        { id: "pp", name: "Progressistas", seats: 50, color: "yellow" },
        { id: "mdb", name: "MDB", seats: 42, color: "green" },
        { id: "oth", name: "Outros", seats: 195, color: "gray" },
      ],
    },
    upper: {
      name: "Senado Federal", total: 81,
      sub: "81 seats \u00b7 8-year terms \u00b7 3 per state",
      parties: [
        { id: "pl", name: "Partido Liberal", seats: 15, color: "blue" },
        { id: "pt", name: "Partido Trabalhadores", seats: 9, color: "red" },
        { id: "uni", name: "Uniao Brasil", seats: 10, color: "orange" },
        { id: "oth", name: "Others", seats: 47, color: "gray" },
      ],
    },
    branches: { exec: "President & Cabinet", legis: "Camara + Senado", jud: "Supreme Federal Court" },
    coalition: "Broad center coalition", next: "2026",
    bills: [
      { title: "Reforma Tributaria II", status: "Senado review", stage: 3, summary: "Second phase of tax reform: rules for the new consumption VAT and transition period.", tags: ["Economy"], votes: null, sponsor: "Treasury Minister" },
      { title: "Lei da Amazonia Digital", status: "Camara debate", stage: 2, summary: "Provides rural broadband and satellite internet subsidies across the Legal Amazon.", tags: ["Digital", "Environment"], votes: null, sponsor: "Minister of Communications" },
    ],
  },
  sau: {
    lower: {
      name: "Majlis al-Shura (Consultative Assembly)", total: 150,
      sub: "150 members \u00b7 appointed by the King \u00b7 4-year terms \u00b7 no political parties",
      parties: [{ id: "app", name: "Appointed members", seats: 150, color: "teal" }],
    },
    upper: null,
    branches: { exec: "Monarch & Council of Ministers", legis: "Majlis al-Shura (advisory)", jud: "Sharia Courts" },
    coalition: "Absolute monarchy", next: "\u2014",
    bills: [
      { title: "Vision 2030 Update Package", status: "Royal decree", stage: 4, summary: "Updates tourism, manufacturing, and foreign-investment targets for the next phase of Vision 2030.", tags: ["Economy"], votes: null, sponsor: "Royal Court" },
    ],
  },
};

export const WORLD_PATHS: Record<string, { label: [number, number]; d: string }> = {
  can: { label: [430, 250], d: "M180,230 L260,210 L360,200 L470,210 L560,190 L620,210 L640,270 L600,300 L540,310 L500,330 L420,340 L360,320 L280,330 L220,310 L180,280 Z" },
  usa: { label: [440, 370], d: "M250,340 L360,330 L480,335 L560,355 L560,410 L510,430 L440,445 L360,430 L280,420 L240,390 Z" },
  mex: { label: [380, 490], d: "M300,440 L400,445 L440,475 L460,510 L420,520 L380,500 L340,490 L320,470 Z" },
  bra: { label: [620, 610], d: "M550,550 L620,540 L700,555 L720,600 L700,660 L660,700 L600,710 L560,680 L540,620 Z" },
  arg: { label: [570, 780], d: "M540,700 L590,700 L600,750 L580,820 L560,850 L545,810 L540,750 Z" },
  gbr: { label: [905, 340], d: "M890,320 L915,315 L925,340 L920,365 L895,365 L885,345 Z" },
  fra: { label: [950, 390], d: "M930,370 L970,370 L990,395 L975,420 L940,420 L920,400 Z" },
  esp: { label: [920, 440], d: "M890,420 L960,420 L965,455 L925,465 L885,450 Z" },
  deu: { label: [990, 370], d: "M975,350 L1010,350 L1020,380 L1005,410 L975,400 Z" },
  ita: { label: [1000, 420], d: "M985,405 L1015,410 L1020,435 L1015,465 L995,455 Z" },
  rus: { label: [1200, 290], d: "M1020,260 L1200,250 L1400,260 L1520,280 L1500,330 L1380,335 L1200,325 L1040,320 Z" },
  egy: { label: [1020, 490], d: "M1010,470 L1060,470 L1070,505 L1030,515 L1000,500 Z" },
  nga: { label: [970, 570], d: "M950,555 L1000,555 L1010,585 L970,595 L945,580 Z" },
  zaf: { label: [1020, 760], d: "M990,745 L1060,745 L1060,780 L1010,790 L985,775 Z" },
  ken: { label: [1070, 620], d: "M1055,605 L1090,610 L1095,635 L1060,640 L1045,625 Z" },
  chn: { label: [1400, 420], d: "M1290,370 L1430,360 L1520,390 L1510,440 L1430,455 L1330,455 L1290,420 Z" },
  ind: { label: [1340, 500], d: "M1280,465 L1370,460 L1400,490 L1380,540 L1340,560 L1300,540 L1280,500 Z" },
  jpn: { label: [1620, 400], d: "M1580,365 L1620,385 L1640,420 L1620,445 L1590,440 L1575,400 Z" },
  kor: { label: [1550, 405], d: "M1530,390 L1560,390 L1565,420 L1540,425 L1528,410 Z" },
  sau: { label: [1100, 500], d: "M1080,475 L1140,475 L1150,510 L1115,540 L1075,520 Z" },
  idn: { label: [1460, 600], d: "M1400,600 L1480,590 L1540,605 L1520,625 L1460,625 L1410,620 Z" },
  aus: { label: [1510, 730], d: "M1430,690 L1560,685 L1600,715 L1580,760 L1520,780 L1460,770 L1430,740 Z" },
  nzl: { label: [1680, 790], d: "M1650,770 L1690,775 L1695,805 L1665,815 L1645,795 Z" },
};

export const NE_ID_TO_OURS: Record<string, string> = {
  "840": "usa", "124": "can", "484": "mex", "076": "bra", "032": "arg",
  "826": "gbr", "250": "fra", "724": "esp", "276": "deu", "380": "ita", "643": "rus",
  "818": "egy", "566": "nga", "710": "zaf", "404": "ken",
  "156": "chn", "356": "ind", "392": "jpn", "410": "kor", "682": "sau", "360": "idn",
  "036": "aus", "554": "nzl",
};

const MEMBER_POOL: Record<string, string[]> = {
  nfp: ["Mathilde Laurent", "Julien Moreau", "Claire Bernard", "Antoine Garnier", "Sophie Petit"],
  ens: ["Lea Dubois", "Marc Fontaine", "Celine Renard", "Hugo Lefevre", "Ines Martin"],
  rn: ["Pierre Lambert", "Nathalie Vidal", "Olivier Roche", "Camille Durand", "Thomas Girard"],
  lr: ["Jean Moreau", "Anne Fabre", "Yves Caron", "Brigitte Noel"],
  ind: ["Franck Barbier", "Laurent Riviere", "Valerie Henry"],
  rep: ["J. Whitaker", "K. Morales", "D. Holloway", "L. Park", "P. Castellano", "R. Nakamura"],
  dem: ["M. Thornton", "S. Banerjee", "T. Reyes", "A. O'Connor", "J. Kim", "B. Adeyemi"],
  lab: ["Sam Patel", "Rachel Oyelaran", "David Armstrong", "Priya Bose", "Louise McKenna"],
  con: ["Henry Wainwright", "Emma Fletcher", "Charles Bennett", "Olivia Redgrave"],
  ld: ["Martin Clarke", "Esther Yip", "Nigel Trevelyan"],
  snp: ["Fiona MacLeod", "Iain Stewart"],
  oth: ["Independent member A", "Independent member B", "Independent member C"],
  spd: ["Jonas Becker", "Maren Hoffmann", "Friedrich Keller", "Ines Voss"],
  cdu: ["Klaus Brandt", "Annika Fischer", "Stefan Richter", "Hanna Weiss"],
  grn: ["Lea Grun", "Tobias Vogel", "Marion Pfeiffer"],
  fdp: ["Sebastian Lang", "Johanna Hummel"],
  afd: ["Dirk Konig", "Ulrike Berger"],
  ldp: ["Hiroshi Tanaka", "Yuki Sato", "Akira Nakamura", "Kenji Ito"],
  cdp: ["Mika Kobayashi", "Ryo Watanabe", "Aiko Mori"],
  ish: ["Takashi Fujita", "Emi Kimura"],
  kom: ["Daisuke Honda"],
  app: ["Abdullah Al-Farsi", "Fahad Al-Rashid", "Noura Al-Saud", "Yusuf Al-Qahtani", "Khalid Al-Harbi"],
  soc: ["Bernard Levy", "Helene Roux"],
  cen: ["Philippe Martel", "Dominique Aubry"],
  cb: ["Lord Ashworth", "Baroness Whitby", "Lord Kensington"],
  pt: ["Joao Silva", "Maria Oliveira", "Ricardo Alves"],
  pl: ["Pedro Costa", "Lucas Ramos"],
  uni: ["Fernanda Souza", "Paulo Cardoso"],
  pp: ["Ana Lima"],
  mdb: ["Carlos Ribeiro"],
};

const DISTRICTS = ["District 12", "District 3", "Region 7", "County Ward", "Mountain Prov.", "Coastal Dist.", "Capital Zone", "North Circuit", "West Borough", "Central"];

export function getMember(partyId: string, seatIndex: number) {
  const pool = MEMBER_POOL[partyId] || MEMBER_POOL.oth;
  return {
    name: pool[seatIndex % pool.length],
    district: DISTRICTS[seatIndex % DISTRICTS.length],
  };
}

export function getDefaultChamberData(countryId: string): ChamberData {
  return CHAMBERS[countryId] || {
    lower: {
      name: "Primary Chamber (placeholder)", total: 300,
      sub: "Data not ingested \u2014 stylized example",
      parties: [
        { id: "a", name: "Majority", seats: 170, color: "blue" },
        { id: "b", name: "Opposition", seats: 110, color: "red" },
        { id: "c", name: "Independents", seats: 20, color: "gray" },
      ],
    },
    upper: null,
    bills: [],
  };
}

export function govDescription(country: Country): string {
  const g = country.gov.toLowerCase();
  if (g.includes("monarchy") && g.includes("absolute")) return "an absolute monarchy";
  if (g.includes("semi-presidential")) return "a semi-presidential republic";
  if (g.includes("parliamentary monarchy")) return "a parliamentary monarchy";
  if (g.includes("parliamentary")) return "a parliamentary democracy";
  if (g.includes("federal")) return "a federal republic";
  if (g.includes("presidential")) return "a presidential republic";
  if (g.includes("one-party")) return "a one-party state";
  return `a ${country.gov.toLowerCase()}`;
}
