export const ADVISORY_APPLICATION_POLICY_VERSION = "civica-advisory-application-privacy/v1" as const;

export const ADVISORY_APPLICATION_POLICY = Object.freeze({
  schemaVersion: ADVISORY_APPLICATION_POLICY_VERSION,
  effectiveOn: "2026-07-11",
  retentionMonths: 18,
  deletionRequestDays: 30,
  collectedFields: Object.freeze([
    "full name",
    "email address",
    "institution or independent status",
    "role or title",
    "primary expertise",
    "relevant experience",
    "optional professional links",
    "optional CV or profile URL",
  ]),
  purpose:
    "Assess an expression of interest for the Civica Atlas advisory board, manage recruitment, and contact the applicant only about that application or a separately accepted review opportunity.",
  access:
    "Fernando Balino reviews applications through the protected Civica admin area. Vercel and Neon process request and database data as infrastructure providers; applications are not public and are not shared for marketing.",
  retention:
    "Delete the application within 18 months of receipt. If an applicant is appointed or accepts separate work, the appointment or review receives its own record and consent rather than extending the application indefinitely.",
  deletion:
    "An applicant may request access, correction, or earlier deletion through the Civica contact form. Civica may verify the request and responds within 30 days; a narrow legal, security, or active-dispute hold is disclosed if it prevents deletion.",
  security:
    "Applications travel over HTTPS, reside in the project database, and are readable through a session-protected admin route. No internet service can promise absolute security.",
  response:
    "A successful page is the only automatic receipt; Civica does not send a confirmation email. Submission does not guarantee a reply, interview, appointment, review assignment, or response date. Fernando contacts an applicant only when follow-up is useful.",
  ipUse:
    "The applicant IP address is used transiently in hashed rate-limit buckets and ordinary infrastructure logs. It is not stored on the application row.",
});

export interface AdvisoryApplicationInput {
  name: string;
  email: string;
  institution: string;
  role: string;
  expertiseArea: string;
  experience: string;
  links: string;
  cvUrl: string;
  consent: boolean;
}

export type AdvisoryApplicationField = keyof AdvisoryApplicationInput;
export type AdvisoryApplicationErrors = Partial<Record<AdvisoryApplicationField, string>>;

export const ADVISORY_APPLICATION_LIMITS = Object.freeze({
  name: 120,
  email: 254,
  institution: 200,
  role: 160,
  expertiseArea: 160,
  experienceMin: 40,
  experienceMax: 5000,
  links: 2000,
  cvUrl: 500,
  requestBody: 16_384,
});

export function isAdvisoryHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateAdvisoryApplication(values: AdvisoryApplicationInput): AdvisoryApplicationErrors {
  const errors: AdvisoryApplicationErrors = {};
  const limits = ADVISORY_APPLICATION_LIMITS;

  if (!values.name.trim()) errors.name = "Required";
  else if (values.name.trim().length > limits.name) errors.name = `Use ${limits.name} characters or fewer`;

  if (!values.email.trim()) errors.email = "Required";
  else if (values.email.trim().length > limits.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email";

  if (!values.institution.trim()) errors.institution = "Required; enter Independent if unaffiliated";
  else if (values.institution.trim().length > limits.institution) errors.institution = `Use ${limits.institution} characters or fewer`;

  if (!values.role.trim()) errors.role = "Required";
  else if (values.role.trim().length > limits.role) errors.role = `Use ${limits.role} characters or fewer`;

  if (!values.expertiseArea.trim()) errors.expertiseArea = "Required";
  else if (values.expertiseArea.trim().length > limits.expertiseArea) errors.expertiseArea = `Use ${limits.expertiseArea} characters or fewer`;

  if (!values.experience.trim()) errors.experience = "Required";
  else if (values.experience.trim().length < limits.experienceMin) errors.experience = `Use at least ${limits.experienceMin} characters`;
  else if (values.experience.trim().length > limits.experienceMax) errors.experience = `Use ${limits.experienceMax} characters or fewer`;

  if (values.links.trim().length > limits.links) errors.links = `Use ${limits.links} characters or fewer`;
  if (values.cvUrl.trim().length > limits.cvUrl) errors.cvUrl = `Use ${limits.cvUrl} characters or fewer`;
  else if (values.cvUrl.trim() && !isAdvisoryHttpUrl(values.cvUrl.trim())) errors.cvUrl = "Enter a link starting with http:// or https://";

  if (values.consent !== true) errors.consent = "Confirm that you have read the application privacy terms";
  return errors;
}

export function advisoryApplicationRetentionDeadline(receivedAt: Date): Date {
  const deadline = new Date(receivedAt);
  deadline.setUTCMonth(deadline.getUTCMonth() + ADVISORY_APPLICATION_POLICY.retentionMonths);
  return deadline;
}
