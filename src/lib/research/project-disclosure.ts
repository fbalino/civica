import { createHash } from "node:crypto";

export const PROJECT_DISCLOSURE_VERSION =
  "civica-project-disclosure/v1" as const;
export const PROJECT_DISCLOSURE_ARTIFACT_PATH =
  "data/research/project-disclosure-v1.json" as const;

export const PROJECT_DISCLOSURE = Object.freeze({
  schemaVersion: PROJECT_DISCLOSURE_VERSION,
  effectiveOn: "2026-07-25",
  nextScheduledReviewOn: "2027-01-25",
  approvedBy: "Fernando Baliño",
  correctionUrl: "/contact",
  updateCadence: Object.freeze({
    scheduled: "Every six months.",
    eventDriven:
      "Review and update after any material change to funding, support, affiliations, source or vendor relationships, control rights, or conflict posture.",
  }),
  funding: Object.freeze({
    personallyFundedBy: "Fernando Baliño",
    outsideFundersOrSponsors: Object.freeze([] as string[]),
    publicText:
      "Civica Atlas is personally funded by Fernando Baliño. As of 2026-07-25, it has received no grants, sponsorships, donations, employer support, or outcome-contingent funding. No outside funder or sponsor exists.",
  }),
  servicesAndInKindSupport: Object.freeze({
    donatedOrDiscountedMaterialSupport: false,
    publicText:
      "The project uses commercial and free-tier software, hosting, database, model, research, and developer services. Fernando pays the project's costs. It has received no donated or discounted services, credits, waived fees, free professional work, equipment, datasets beyond ordinary published access, or other material in-kind support. Routine public free tiers and generally available open-source packages are disclosed by category rather than assigned a monetary value.",
  }),
  politicalIndependenceAndAffiliations: Object.freeze({
    outsideAffiliationsOrRelevantInterests: Object.freeze([] as string[]),
    publicText:
      "Civica Atlas is not affiliated with or directed by any political party, campaign, government, lobbying organization, advocacy organization, university, research institute, NGO, or commercial governance-data provider. Fernando has confirmed no relevant outside affiliations or interests. The project takes no institutional position on parties, governments, or regime outcomes.",
  }),
  editorialControl: Object.freeze({
    finalAuthority: "Fernando Baliño",
    exceptionalThirdPartyControlRights: Object.freeze([] as string[]),
    publicText:
      "Fernando Baliño has final authority over data inclusion, methodology, copy, corrections, releases, security, source rights, reviewer process, conflicts, and emergency action under civica-research-publication-governance/v1. No third party has exceptional approval, veto, advance-access, publication-timing, messaging, hiring, reviewer-selection, or data-removal rights. Contractors, agents, model providers, source publishers, prospective reviewers, and advisory-board applicants have no publication veto or automatic approval role. Any future delegation, funder condition, sponsor right, or exceptional third-party control right will be named and dated.",
  }),
  sourceAndVendorRelationships: Object.freeze({
    formalOrPrivilegedBeyondOrdinaryTerms: Object.freeze([] as string[]),
    publicText:
      "Civica has no formal or privileged source or vendor relationships beyond ordinary paid-customer or public-access terms. It obtains data under the source-by-source access and rights conditions in its manifests. Citation, payment, public access, or technical integration does not imply endorsement by either party.",
  }),
  conflictHandling: Object.freeze({
    publicText:
      "Relevant project, author, contributor, reviewer, source-provider, funder, vendor, political, personal, and competitive interests are disclosed before the affected decision. They are managed, recused, or excluded under the governance charter. An unmanageable conflict held by the sole owner blocks the affected claim until a qualified independent decision-maker is appointed.",
  }),
  publicationAuthorization: Object.freeze({
    about: true,
    unchangedReviewerPacketReuse: true,
    reviewerPackets: Object.freeze([
      Object.freeze({
        product: "Atlas",
        checklistTask: "GOV-013",
        status: "active",
        artifactPath: PROJECT_DISCLOSURE_ARTIFACT_PATH,
      }),
      Object.freeze({
        product: "Index",
        checklistTask: "GOV-014",
        status: "active",
        artifactPath: PROJECT_DISCLOSURE_ARTIFACT_PATH,
      }),
      Object.freeze({
        product: "Pulse",
        checklistTask: "GOV-015",
        status: "required_when_packet_is_assembled",
        artifactPath: PROJECT_DISCLOSURE_ARTIFACT_PATH,
      }),
    ]),
  }),
  changeHistory: Object.freeze([
    Object.freeze({
      effectiveOn: "2026-07-25",
      approvedBy: "Fernando Baliño",
      change:
        "Initial publication after owner confirmation of funding, support, affiliations, source and vendor relationships, editorial control, publication authorization, and review cadence.",
    }),
  ]),
});

export const PROJECT_DISCLOSURE_PUBLIC_SECTIONS = Object.freeze([
  Object.freeze({
    id: "funding-and-sponsorship",
    heading: "Funding and sponsorship",
    text: PROJECT_DISCLOSURE.funding.publicText,
  }),
  Object.freeze({
    id: "services-and-in-kind-support",
    heading: "Services and in-kind support",
    text: PROJECT_DISCLOSURE.servicesAndInKindSupport.publicText,
  }),
  Object.freeze({
    id: "political-independence-and-affiliations",
    heading: "Political independence and affiliations",
    text: PROJECT_DISCLOSURE.politicalIndependenceAndAffiliations.publicText,
  }),
  Object.freeze({
    id: "editorial-control",
    heading: "Editorial control",
    text: PROJECT_DISCLOSURE.editorialControl.publicText,
  }),
  Object.freeze({
    id: "source-and-vendor-relationships",
    heading: "Source and vendor relationships",
    text: PROJECT_DISCLOSURE.sourceAndVendorRelationships.publicText,
  }),
  Object.freeze({
    id: "conflict-handling",
    heading: "Conflict handling",
    text: PROJECT_DISCLOSURE.conflictHandling.publicText,
  }),
]);

export function projectDisclosureHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function projectDisclosureErrors(
  record: typeof PROJECT_DISCLOSURE = PROJECT_DISCLOSURE,
): string[] {
  const errors: string[] = [];
  if (record.schemaVersion !== PROJECT_DISCLOSURE_VERSION)
    errors.push("wrong schema version");
  if (record.approvedBy !== "Fernando Baliño")
    errors.push("named owner approval is missing");
  if (record.funding.outsideFundersOrSponsors.length !== 0)
    errors.push("outside funding contradicts the confirmed no-funding state");
  if (record.servicesAndInKindSupport.donatedOrDiscountedMaterialSupport)
    errors.push("in-kind support contradicts the confirmed no-support state");
  if (
    record.politicalIndependenceAndAffiliations
      .outsideAffiliationsOrRelevantInterests.length !== 0
  )
    errors.push("outside affiliation contradicts the confirmed independence state");
  if (
    record.sourceAndVendorRelationships.formalOrPrivilegedBeyondOrdinaryTerms
      .length !== 0
  )
    errors.push("source or vendor relationship exceeds the confirmed ordinary terms");
  if (record.editorialControl.exceptionalThirdPartyControlRights.length !== 0)
    errors.push("exceptional third-party control contradicts owner confirmation");
  if (
    !record.publicationAuthorization.about ||
    !record.publicationAuthorization.unchangedReviewerPacketReuse
  )
    errors.push("publication authorization is incomplete");
  const packetProducts = new Set(
    record.publicationAuthorization.reviewerPackets.map(({ product }) => product),
  );
  for (const product of ["Atlas", "Index", "Pulse"] as const)
    if (!packetProducts.has(product))
      errors.push(`${product} reviewer-packet binding is missing`);
  if (
    record.publicationAuthorization.reviewerPackets.some(
      ({ artifactPath }) => artifactPath !== PROJECT_DISCLOSURE_ARTIFACT_PATH,
    )
  )
    errors.push("a reviewer packet rewrites or forks the canonical disclosure");
  if (
    record.nextScheduledReviewOn !== "2027-01-25" ||
    !record.updateCadence.eventDriven.includes("material change")
  )
    errors.push("six-month and material-change review cadence is incomplete");
  if (record.changeHistory.length === 0)
    errors.push("change history is missing");
  return errors;
}
