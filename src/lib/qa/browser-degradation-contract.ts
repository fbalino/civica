/** QA-016 — declared reader-browser support and failure posture. */
export const READER_BROWSER_SUPPORT_VERSION =
  "civica-reader-browser-support/v1" as const;

export type ReaderBrowserProject = "chromium" | "firefox" | "webkit";

export interface ReaderBrowserSupportProfile {
  project: ReaderBrowserProject;
  device: string;
  scope: "desktop-reader-critical-journeys";
}

/**
 * These are Playwright-managed profiles, not a claim that every historical or
 * branded browser build is supported. CI installs the exact pinned binaries
 * and runs the critical reader suite on all three.
 */
export const READER_BROWSER_SUPPORT: readonly ReaderBrowserSupportProfile[] = [
  {
    project: "chromium",
    device: "Desktop Chrome",
    scope: "desktop-reader-critical-journeys",
  },
  {
    project: "firefox",
    device: "Desktop Firefox",
    scope: "desktop-reader-critical-journeys",
  },
  {
    project: "webkit",
    device: "Desktop Safari",
    scope: "desktop-reader-critical-journeys",
  },
] as const;

export const READER_DEGRADATION_MODES = [
  {
    id: "no-javascript",
    posture:
      "Reader prose and primary landmarks remain available from server-rendered HTML; client-only controls are progressive enhancements.",
  },
  {
    id: "atlas-geometry-cdn",
    posture:
      "The Atlas uses checked local geometry when the external TopoJSON CDN cannot load, and retains its table alternative.",
  },
  {
    id: "country-map-provider",
    posture:
      "Country maps try the keyless OpenFreeMap style after a self-hosted failure, then expose a visible status instead of a blank canvas.",
  },
  {
    id: "external-portrait",
    posture:
      "A failed Wikimedia portrait becomes the named leader's monogram without removing the person or office context.",
  },
  {
    id: "ask-civica-provider",
    posture:
      "Ask Civica reports a generic temporary-unavailability message and leaves reader evidence available.",
  },
  {
    id: "pulse-source-outage",
    posture:
      "A failed source basket stays a source_outage and not_assessable state; it never becomes a no-event or country-quality conclusion.",
  },
] as const;

const REQUIRED_PROJECTS: readonly ReaderBrowserProject[] = [
  "chromium",
  "firefox",
  "webkit",
];

const REQUIRED_DEGRADATIONS = new Set([
  "no-javascript",
  "atlas-geometry-cdn",
  "country-map-provider",
  "external-portrait",
  "ask-civica-provider",
  "pulse-source-outage",
]);

export function readerBrowserSupportContractErrors(
  profiles: readonly ReaderBrowserSupportProfile[] = READER_BROWSER_SUPPORT,
  degradations: readonly { id: string; posture: string }[] =
    READER_DEGRADATION_MODES,
): string[] {
  const errors: string[] = [];
  const projects = new Set<string>();
  for (const profile of profiles) {
    if (projects.has(profile.project))
      errors.push(`${profile.project}: duplicate browser project`);
    projects.add(profile.project);
    if (!profile.device.trim()) errors.push(`${profile.project}: device is required`);
    if (profile.scope !== "desktop-reader-critical-journeys")
      errors.push(`${profile.project}: support scope drifted`);
  }
  for (const project of REQUIRED_PROJECTS) {
    if (!projects.has(project)) errors.push(`missing ${project} support profile`);
  }

  const degradationIds = new Set<string>();
  for (const degradation of degradations) {
    if (degradationIds.has(degradation.id))
      errors.push(`${degradation.id}: duplicate degradation mode`);
    degradationIds.add(degradation.id);
    if (!degradation.posture.trim())
      errors.push(`${degradation.id}: posture is required`);
  }
  for (const id of REQUIRED_DEGRADATIONS) {
    if (!degradationIds.has(id)) errors.push(`missing ${id} degradation mode`);
  }
  return errors;
}
