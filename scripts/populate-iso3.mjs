import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL
  || "postgresql://neondb_owner:npg_nReFt17NXjau@ep-bitter-night-amod9dl6-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
const sql = neon(DATABASE_URL);

const ISO2_TO_ISO3 = {
  AF:"AFG",AL:"ALB",DZ:"DZA",AS:"ASM",AD:"AND",AO:"AGO",AG:"ATG",AR:"ARG",
  AM:"ARM",AU:"AUS",AT:"AUT",AZ:"AZE",BS:"BHS",BH:"BHR",BD:"BGD",BB:"BRB",
  BY:"BLR",BE:"BEL",BZ:"BLZ",BJ:"BEN",BT:"BTN",BO:"BOL",BA:"BIH",BW:"BWA",
  BR:"BRA",BN:"BRN",BG:"BGR",BF:"BFA",BI:"BDI",KH:"KHM",CM:"CMR",CA:"CAN",
  CV:"CPV",CF:"CAF",TD:"TCD",CL:"CHL",CN:"CHN",CO:"COL",KM:"COM",CG:"COG",
  CD:"COD",CR:"CRI",CI:"CIV",HR:"HRV",CU:"CUB",CY:"CYP",CZ:"CZE",DK:"DNK",
  DJ:"DJI",DM:"DMA",DO:"DOM",EC:"ECU",EG:"EGY",SV:"SLV",GQ:"GNQ",ER:"ERI",
  EE:"EST",SZ:"SWZ",ET:"ETH",FJ:"FJI",FI:"FIN",FR:"FRA",GA:"GAB",GM:"GMB",
  GE:"GEO",DE:"DEU",GH:"GHA",GR:"GRC",GD:"GRD",GT:"GTM",GN:"GIN",GW:"GNB",
  GY:"GUY",HT:"HTI",HN:"HND",HU:"HUN",IS:"ISL",IN:"IND",ID:"IDN",IR:"IRN",
  IQ:"IRQ",IE:"IRL",IL:"ISR",IT:"ITA",JM:"JAM",JP:"JPN",JO:"JOR",KZ:"KAZ",
  KE:"KEN",KI:"KIR",KP:"PRK",KR:"KOR",KW:"KWT",KG:"KGZ",LA:"LAO",LV:"LVA",
  LB:"LBN",LS:"LSO",LR:"LBR",LY:"LBY",LI:"LIE",LT:"LTU",LU:"LUX",MG:"MDG",
  MW:"MWI",MY:"MYS",MV:"MDV",ML:"MLI",MT:"MLT",MH:"MHL",MR:"MRT",MU:"MUS",
  MX:"MEX",FM:"FSM",MD:"MDA",MC:"MCO",MN:"MNG",ME:"MNE",MA:"MAR",MZ:"MOZ",
  MM:"MMR",NA:"NAM",NR:"NRU",NP:"NPL",NL:"NLD",NZ:"NZL",NI:"NIC",NE:"NER",
  NG:"NGA",MK:"MKD",NO:"NOR",OM:"OMN",PK:"PAK",PW:"PLW",PA:"PAN",PG:"PNG",
  PY:"PRY",PE:"PER",PH:"PHL",PL:"POL",PT:"PRT",QA:"QAT",RO:"ROU",RU:"RUS",
  RW:"RWA",KN:"KNA",LC:"LCA",VC:"VCT",WS:"WSM",SM:"SMR",ST:"STP",SA:"SAU",
  SN:"SEN",RS:"SRB",SC:"SYC",SL:"SLE",SG:"SGP",SK:"SVK",SI:"SVN",SB:"SLB",
  SO:"SOM",ZA:"ZAF",SS:"SSD",ES:"ESP",LK:"LKA",SD:"SDN",SR:"SUR",SE:"SWE",
  CH:"CHE",SY:"SYR",TW:"TWN",TJ:"TJK",TZ:"TZA",TH:"THA",TL:"TLS",TG:"TGO",
  TO:"TON",TT:"TTO",TN:"TUN",TR:"TUR",TM:"TKM",TV:"TUV",UG:"UGA",UA:"UKR",
  AE:"ARE",GB:"GBR",US:"USA",UY:"URY",UZ:"UZB",VU:"VUT",VA:"VAT",VE:"VEN",
  VN:"VNM",YE:"YEM",ZM:"ZMB",ZW:"ZWE",PS:"PSE",XK:"XKX",CW:"CUW",SX:"SXM",
  BQ:"BES",SS:"SSD",
};

async function main() {
  console.log("=== Populating ISO3 codes ===\n");

  const rows = await sql`
    SELECT id, name, iso2 FROM jurisdictions
    WHERE type = 'sovereign_state' AND iso2 IS NOT NULL AND iso3 IS NULL
  `;

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const iso3 = ISO2_TO_ISO3[row.iso2];
    if (iso3) {
      await sql`UPDATE jurisdictions SET iso3 = ${iso3} WHERE id = ${row.id}`;
      updated++;
      console.log(`  ✓ ${row.name}: ${row.iso2} → ${iso3}`);
    } else {
      skipped++;
      console.log(`  ⚠ ${row.name}: no ISO3 mapping for ${row.iso2}`);
    }
  }

  console.log(`\n=== Done === Updated: ${updated}, Skipped: ${skipped}`);

  // Verify key countries
  const verify = await sql`
    SELECT name, iso2, iso3 FROM jurisdictions
    WHERE iso3 IN ('USA', 'GBR', 'FRA', 'DEU', 'BRA', 'CHN', 'IND', 'JPN', 'RUS', 'CAN')
    ORDER BY name
  `;
  console.log("\nVerification (key countries):");
  for (const r of verify) console.log(`  ${r.name}: iso2=${r.iso2}, iso3=${r.iso3}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
