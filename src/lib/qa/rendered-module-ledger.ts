import path from "node:path";

export const RENDERED_MODULE_LEDGER_SCHEMA_VERSION =
  "civica-rendered-module-ledger/v1" as const;

export const VISUAL_VARIANTS = [
  "desktop_light",
  "desktop_dark",
  "small_mobile_light",
  "small_mobile_dark",
] as const;

export type VisualVariant = (typeof VISUAL_VARIANTS)[number];
export type RenderedModuleRole =
  | "page"
  | "layout"
  | "error_boundary"
  | "document"
  | "component";
export type RenderedModuleDisposition = "clean" | "finding" | "not_observed";

export interface RenderedModuleEvidence {
  disposition: RenderedModuleDisposition;
  screenshot: string | null;
  findingId: string | null;
}

export interface RenderedModuleLedgerEntry {
  id: string;
  route: string;
  routeSource: string;
  moduleSource: string;
  role: RenderedModuleRole;
  visual: Record<VisualVariant, RenderedModuleEvidence>;
}

export interface RenderedModuleLedger {
  schemaVersion: typeof RENDERED_MODULE_LEDGER_SCHEMA_VERSION;
  entries: readonly RenderedModuleLedgerEntry[];
}

export interface RenderedModuleEvidenceRecord {
  route: string;
  moduleSource: string | "*";
  variant: VisualVariant;
  evidence: RenderedModuleEvidence;
}

export interface RenderedModuleEvidenceRegistry {
  schemaVersion: "civica-rendered-module-evidence/v1";
  records: readonly RenderedModuleEvidenceRecord[];
}

export interface RouteRenderSource {
  route: string;
  sourcePath: string;
  kind: "page" | "error_boundary" | "document";
}

// The ledger is about source-rendered modules. Keep helper/data `.ts` imports
// out of the visual graph; their behavior is covered by their owning route or
// component rather than being mislabeled as a separately rendered module.
const extensions = [".tsx", "/index.tsx"];

function normalize(sourcePath: string) {
  return sourcePath.split(path.sep).join("/");
}

function moduleRole(sourcePath: string, initial: RouteRenderSource, layouts: ReadonlySet<string>): RenderedModuleRole {
  if (sourcePath === initial.sourcePath) return initial.kind;
  if (layouts.has(sourcePath)) return "layout";
  return "component";
}

function importSpecifiers(source: string) {
  const specifiers = new Set<string>();
  const staticImport = /\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s*["']([^"']+)["']/g;
  const dynamicImport = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const matcher of [staticImport, dynamicImport]) {
    for (const match of source.matchAll(matcher)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function resolveLocalModule(
  importer: string,
  specifier: string,
  sourcePaths: ReadonlySet<string>,
) {
  const base = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? normalize(path.posix.join(path.posix.dirname(importer), specifier))
      : null;
  if (!base) return null;
  for (const extension of extensions) {
    const candidate = `${base}${extension}`;
    if (sourcePaths.has(candidate)) return candidate;
  }
  return null;
}

function unobservedVisual(): Record<VisualVariant, RenderedModuleEvidence> {
  return Object.fromEntries(
    VISUAL_VARIANTS.map((variant) => [
      variant,
      {
        disposition: "not_observed",
        screenshot: null,
        findingId: "EXP-001-NO-BROWSER-EVIDENCE",
      },
    ]),
  ) as Record<VisualVariant, RenderedModuleEvidence>;
}

function reachableModules(
  initialSources: readonly string[],
  sourceByPath: ReadonlyMap<string, string>,
) {
  const sourcePaths = new Set(sourceByPath.keys());
  const discovered = new Set<string>();
  const queue = [...initialSources];
  while (queue.length) {
    const current = queue.pop()!;
    if (discovered.has(current)) continue;
    discovered.add(current);
    const source = sourceByPath.get(current);
    if (!source) continue;
    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveLocalModule(current, specifier, sourcePaths);
      if (resolved && !discovered.has(resolved)) queue.push(resolved);
    }
  }
  return [...discovered].sort((left, right) => left.localeCompare(right));
}

/**
 * Builds a conservative source-reachable ledger. Every item begins as an open
 * `not_observed` finding; only a separately recorded browser review may mark a
 * variant clean or attach a concrete visual finding.
 */
export function buildRenderedModuleLedger(
  routes: readonly RouteRenderSource[],
  sourceByPath: ReadonlyMap<string, string>,
): RenderedModuleLedger {
  const sourcePaths = new Set(sourceByPath.keys());
  const layoutPaths = new Set(
    [...sourcePaths].filter((sourcePath) => sourcePath.endsWith("/layout.tsx")),
  );
  const entries = routes.flatMap((route) => {
    const routeDirectory = path.posix.dirname(route.sourcePath);
    const applicableLayouts =
      route.kind === "document"
        ? []
        : [...layoutPaths].filter((layout) =>
            routeDirectory.startsWith(path.posix.dirname(layout)),
          );
    return reachableModules(
      [route.sourcePath, ...applicableLayouts],
      sourceByPath,
    ).map((moduleSource) => ({
      id: `${route.sourcePath}:${moduleSource}`,
      route: route.route,
      routeSource: route.sourcePath,
      moduleSource,
      role: moduleRole(moduleSource, route, new Set(applicableLayouts)),
      visual: unobservedVisual(),
    }));
  });
  return {
    schemaVersion: RENDERED_MODULE_LEDGER_SCHEMA_VERSION,
    entries: entries.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

/**
 * Applies durable browser-review evidence after source discovery. Route-level
 * records may attach candidate context to every reachable module, but may not
 * mark those modules clean: clean evidence must name the exact module source
 * that the reviewer actually located in the screenshot.
 */
export function applyRenderedModuleEvidence(
  ledger: RenderedModuleLedger,
  registry: RenderedModuleEvidenceRegistry,
): RenderedModuleLedger {
  if (registry.schemaVersion !== "civica-rendered-module-evidence/v1") {
    throw new Error("Expected civica-rendered-module-evidence/v1.");
  }

  const entries = ledger.entries.map((entry) => ({
    ...entry,
    visual: Object.fromEntries(
      VISUAL_VARIANTS.map((variant) => [variant, { ...entry.visual[variant] }]),
    ) as Record<VisualVariant, RenderedModuleEvidence>,
  }));
  const seen = new Set<string>();

  for (const record of registry.records) {
    const recordKey = `${record.route}:${record.moduleSource}:${record.variant}`;
    if (seen.has(recordKey)) {
      throw new Error(`Duplicate rendered-module evidence record ${recordKey}.`);
    }
    seen.add(recordKey);

    if (
      record.moduleSource === "*" &&
      record.evidence.disposition === "clean"
    ) {
      throw new Error(
        `${recordKey} cannot mark a whole route clean; name an exact module source.`,
      );
    }

    const matches = entries.filter(
      (entry) =>
        entry.route === record.route &&
        (record.moduleSource === "*" ||
          entry.moduleSource === record.moduleSource),
    );
    if (matches.length === 0) {
      throw new Error(`Rendered-module evidence target ${recordKey} is stale.`);
    }
    for (const entry of matches) {
      entry.visual[record.variant] = { ...record.evidence };
    }
  }

  return {
    ...ledger,
    entries,
  };
}

export function validateRenderedModuleLedger(ledger: RenderedModuleLedger) {
  const errors: string[] = [];
  if (ledger.schemaVersion !== RENDERED_MODULE_LEDGER_SCHEMA_VERSION) {
    errors.push(`Expected schema ${RENDERED_MODULE_LEDGER_SCHEMA_VERSION}.`);
  }
  const ids = new Set<string>();
  for (const entry of ledger.entries) {
    if (ids.has(entry.id)) errors.push(`Duplicate entry ${entry.id}.`);
    ids.add(entry.id);
    for (const variant of VISUAL_VARIANTS) {
      const evidence = entry.visual[variant];
      if (!evidence) {
        errors.push(`${entry.id}:${variant} is missing.`);
        continue;
      }
      if (evidence.disposition === "clean" && !evidence.screenshot) {
        errors.push(`${entry.id}:${variant} clean requires a screenshot.`);
      }
      if (evidence.disposition !== "clean" && !evidence.findingId) {
        errors.push(`${entry.id}:${variant} requires an open finding id.`);
      }
    }
  }
  return errors;
}
