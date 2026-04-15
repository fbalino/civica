export interface GovernmentTypeInfo {
  slug: string;
  name: string;
  description: string[];
  characteristics: string[];
  dbPatterns: string[];
  color: string;
}

export const GOVERNMENT_TYPES: GovernmentTypeInfo[] = [
  {
    slug: "presidential-republic",
    name: "Presidential Republic",
    description: [
      "A presidential republic is a system of government where the president serves as both head of state and head of government, deriving a mandate directly from the people through elections. The executive branch exists separately from the legislature, to which it is not responsible and which it cannot dismiss.",
      "In this system, the president is typically elected independently of the legislature and has significant powers including vetoing legislation, commanding the armed forces, and appointing cabinet members. The separation of powers between branches is a defining feature.",
      "Presidential republics are among the most common forms of government worldwide. The United States is often cited as the archetypal presidential republic, though the system has been adopted widely across the Americas, Africa, and parts of Asia with significant local variations.",
    ],
    characteristics: [
      "President is both head of state and head of government",
      "Executive is elected independently of the legislature",
      "Fixed terms of office for the president",
      "Clear separation of powers between branches",
      "President cannot dissolve the legislature",
      "Legislature cannot remove president through vote of no confidence",
      "Cabinet appointed by and answerable to the president",
    ],
    dbPatterns: ["Presidential republic"],
    color: "var(--color-gov-presidential)",
  },
  {
    slug: "constitutional-monarchy",
    name: "Constitutional Monarchy",
    description: [
      "A constitutional monarchy is a form of government in which a monarch acts as the head of state within the parameters of a written or unwritten constitution. The monarch's powers are largely ceremonial, with real political power exercised by elected officials and institutions.",
      "Constitutional monarchies typically feature a prime minister or equivalent who serves as head of government. The monarch may retain formal powers such as dissolving parliament or giving royal assent to legislation, but these powers are exercised by convention on the advice of elected officials.",
      "This system of government is found across Europe, Asia, and other regions. Notable examples include the United Kingdom, Japan, Spain, and the Netherlands. Constitutional monarchies often rank highly on indices of democracy, stability, and rule of law.",
    ],
    characteristics: [
      "Hereditary monarch serves as head of state",
      "Monarch's powers are defined and limited by constitution or convention",
      "Elected parliament holds legislative power",
      "Prime minister serves as head of government",
      "Monarch acts on advice of elected ministers",
      "Separation of ceremonial and executive authority",
      "Strong tradition of rule of law and institutional continuity",
    ],
    dbPatterns: ["Constitutional monarchy"],
    color: "var(--color-gov-parliamentary)",
  },
  {
    slug: "parliamentary-republic",
    name: "Parliamentary Republic",
    description: [
      "A parliamentary republic is a form of government where the head of state is typically a president with largely ceremonial duties, while the head of government is a prime minister who derives legitimacy from and is accountable to the parliament. Executive power is exercised by the cabinet, which is collectively responsible to the legislature.",
      "In parliamentary republics, the government is formed by the party or coalition that commands a majority in the legislature. The prime minister can be removed through a vote of no confidence, creating a strong link of accountability between the executive and legislative branches.",
      "Parliamentary republics are common across Europe, South Asia, and parts of Africa. Examples include Germany, India, Italy, and Ireland. This system is valued for its flexibility in responding to political crises and its mechanisms for holding the executive accountable.",
    ],
    characteristics: [
      "President serves as ceremonial head of state",
      "Prime minister is head of government",
      "Government is accountable to parliament",
      "Executive can be removed by vote of no confidence",
      "Government typically formed by majority party or coalition",
      "Parliament can usually be dissolved for early elections",
      "Strong fusion of executive and legislative branches",
    ],
    dbPatterns: [
      "Parliamentary republic",
      "Parliamentary democracy",
    ],
    color: "var(--color-gov-parliamentary)",
  },
  {
    slug: "federal-republic",
    name: "Federal Republic",
    description: [
      "A federal republic is a form of government combining republican principles with a federal structure in which sovereignty is constitutionally divided between a central governing authority and constituent political units such as states or provinces. Each level of government has defined areas of authority.",
      "Federal republics distribute power across multiple levels of government, with both the national government and sub-national units having their own legislative, executive, and often judicial branches. This division of power is protected by a constitution that neither level can unilaterally alter.",
      "Federal republics are found across diverse regions and include some of the world's largest and most diverse nations. Notable examples include the United States, Germany, Brazil, and Nigeria. Federalism is often adopted in countries with significant regional diversity in language, culture, or ethnicity.",
    ],
    characteristics: [
      "Power constitutionally divided between national and sub-national governments",
      "Both levels of government have autonomous authority in defined areas",
      "Written constitution allocating powers between federal and state levels",
      "Typically bicameral legislature with representation of sub-national units",
      "Constitutional court resolves jurisdictional disputes",
      "Sub-national units have their own constitutions or basic laws",
      "Citizens subject to both federal and state/provincial laws",
    ],
    dbPatterns: ["Federal republic", "Federal parliamentary republic"],
    color: "var(--color-gov-parliamentary)",
  },
  {
    slug: "theocracy",
    name: "Theocracy",
    description: [
      "A theocracy is a form of government in which religious leaders or institutions hold supreme authority, and public policy is primarily guided by religious law and doctrine. The government claims to rule on behalf of a divine authority or in accordance with sacred texts.",
      "In theocratic systems, the legal code is derived partly or wholly from religious scriptures, and religious leaders often hold the highest political offices or exercise veto power over secular institutions. The boundary between religious authority and state power is either blurred or nonexistent.",
      "True theocracies are rare in the modern world. Iran, where the Supreme Leader holds ultimate authority as a religious jurist, is the most prominent contemporary example. Vatican City is a theocratic absolute elective monarchy. Historical examples include medieval Papal States and Calvinist Geneva.",
    ],
    characteristics: [
      "Religious authority is the basis of political legitimacy",
      "Religious law forms the foundation of the legal system",
      "Religious leaders hold supreme or significant political power",
      "State institutions are subordinate to religious institutions",
      "Public policy guided by religious doctrine",
      "Limited or no separation between religious and political spheres",
      "Dissent may be treated as both political and religious offense",
    ],
    dbPatterns: ["Theocratic republic", "Theocracy", "Theocratic"],
    color: "var(--color-gov-theocratic)",
  },
  {
    slug: "absolute-monarchy",
    name: "Absolute Monarchy",
    description: [
      "An absolute monarchy is a form of government in which a single ruler — the monarch — holds supreme autocratic authority, not limited by written law, legislature, constitution, or custom. The monarch exercises unlimited political power over the state and its people.",
      "Unlike constitutional monarchies where the monarch's role is ceremonial, absolute monarchs make laws, administer justice, control foreign policy, and levy taxes without consent from any other governing body. Power is typically inherited and held for life.",
      "Absolute monarchies have become increasingly rare since the 18th century. Today, Saudi Arabia, Brunei, Oman, and Eswatini are among the few remaining states where the monarch exercises near-absolute power, though each has unique characteristics and varying degrees of informal constraints on royal authority.",
    ],
    characteristics: [
      "Monarch holds supreme and unlimited governing authority",
      "No constitutional or legislative checks on royal power",
      "Power is hereditary, typically passed through a royal family",
      "Monarch serves as both head of state and head of government",
      "Laws issued by royal decree",
      "No elected representative legislature with real power",
      "Succession determined by family lineage or royal designation",
    ],
    dbPatterns: ["Absolute monarchy"],
    color: "var(--color-gov-absolute)",
  },
  {
    slug: "one-party-state",
    name: "One-Party State",
    description: [
      "A one-party state, also known as a single-party system, is a form of government where a single political party has the legal or de facto right to form the government, and all other parties are either banned, severely restricted, or exist only as subordinate allies of the ruling party.",
      "In one-party states, the ruling party typically controls all branches of government and permeates civil society. While elections may be held, they are generally non-competitive. The party often justifies its monopoly on power through ideology, revolutionary legitimacy, or claims of national unity.",
      "Contemporary one-party states include China (Communist Party), Cuba, Vietnam, Laos, and Eritrea. Historically, the Soviet Union and its satellite states operated as one-party systems. Some one-party states label themselves as people's republics or socialist republics.",
    ],
    characteristics: [
      "Single party holds monopoly on political power",
      "Opposition parties are banned or exist only nominally",
      "Party controls state institutions and often the military",
      "Elections, if held, are non-competitive or highly controlled",
      "Party ideology permeates government and civil society",
      "Top party leadership holds top government positions",
      "Media and civil society are typically under party control",
    ],
    dbPatterns: [
      "One-party state",
      "Communist state",
      "Single-party",
      "Socialist republic",
    ],
    color: "#E44040",
  },
  {
    slug: "military-junta",
    name: "Military Junta",
    description: [
      "A military junta is a government led by a committee of military leaders who have typically seized power through a coup d'état. The junta rules by decree and maintains control through military force, often suspending or replacing civilian institutions of governance.",
      "Military juntas usually arise when the military intervenes in politics to overthrow a civilian government, citing reasons such as political instability, corruption, or national security threats. Juntas may promise transition to civilian rule but often maintain power for extended periods.",
      "Military juntas have been common throughout history, particularly in Latin America, Africa, and Southeast Asia. Contemporary examples include Myanmar (since the 2021 coup) and several countries in the Sahel region of Africa. Most juntas eventually transition back to civilian rule, though the timeline varies greatly.",
    ],
    characteristics: [
      "Military officers hold supreme political power",
      "Power typically seized through coup d'état",
      "Civilian institutions suspended or subordinated",
      "Rule by decree rather than through legislative processes",
      "Civil liberties often severely restricted",
      "Media censorship and control of information",
      "Transitional government often promised but not always delivered",
    ],
    dbPatterns: [
      "Military junta",
      "Provisional government",
      "Transitional",
    ],
    color: "var(--color-gov-other)",
  },
  {
    slug: "constitutional-republic",
    name: "Constitutional Republic",
    description: [
      "A constitutional republic is a form of government in which representatives are elected by the people to govern in accordance with a written constitution that protects fundamental rights and limits the powers of government. The head of state is typically a president rather than a monarch.",
      "In a constitutional republic, the constitution serves as the supreme law. Government officials, including the head of state, are bound by its provisions. Citizens have guaranteed rights that cannot be overridden by simple majority rule, and an independent judiciary typically interprets the constitution.",
      "Many modern democracies operate as constitutional republics, though the term often overlaps with presidential or parliamentary republic depending on the specific governmental structure. The concept emphasizes the rule of law and protection of individual rights above all forms of government action.",
    ],
    characteristics: [
      "Written constitution is the supreme law of the land",
      "Government power is limited and defined by the constitution",
      "Head of state is an elected president, not a hereditary monarch",
      "Fundamental rights are constitutionally protected",
      "Independent judiciary interprets constitutional provisions",
      "Rule of law prevails over arbitrary government action",
      "Regular free and fair elections determine leadership",
    ],
    dbPatterns: ["Constitutional republic", "Republic"],
    color: "var(--color-gov-parliamentary)",
  },
  {
    slug: "semi-presidential-republic",
    name: "Semi-Presidential Republic",
    description: [
      "A semi-presidential republic is a system of government in which both a president and a prime minister share executive authority. The president is typically elected directly by the people and holds significant powers, while the prime minister is appointed and accountable to the legislature.",
      "This hybrid system combines elements of both presidential and parliamentary government. The president usually handles foreign affairs and defense, while the prime minister manages domestic policy and the day-to-day running of government. When the president and prime minister are from different parties, a situation known as cohabitation may arise.",
      "France under the Fifth Republic is the most prominent example of a semi-presidential system. Other examples include Russia, Ukraine, Romania, and several post-colonial African states. The system's effectiveness depends heavily on how well the dual executive manages to coordinate and on the constitutional division of powers.",
    ],
    characteristics: [
      "Dual executive: both president and prime minister hold power",
      "President is directly elected by the people",
      "Prime minister is appointed and accountable to parliament",
      "President typically controls foreign and defense policy",
      "Prime minister manages domestic affairs and legislation",
      "Cohabitation possible when president and PM are from different parties",
      "Combines elements of presidential and parliamentary systems",
    ],
    dbPatterns: ["Semi-presidential republic", "Semi-presidential"],
    color: "var(--color-gov-semi-presidential)",
  },
];

export function getGovernmentTypeBySlug(
  slug: string
): GovernmentTypeInfo | undefined {
  return GOVERNMENT_TYPES.find((gt) => gt.slug === slug);
}

export function matchGovernmentType(
  dbValue: string | null
): GovernmentTypeInfo | undefined {
  if (!dbValue) return undefined;
  const lower = dbValue.toLowerCase();
  return GOVERNMENT_TYPES.find((gt) =>
    gt.dbPatterns.some((p) => lower.includes(p.toLowerCase()))
  );
}
