import assert from "node:assert/strict";
import { test } from "node:test";

import {
  auditPublicNumericClaims,
  findStatsMarkersWithoutFallback,
  type PublicNumericClaimRegistration,
  type PublicNumericDocument,
} from "./public-numeric-claims";

function markdown(
  source: string,
  file = "content/fixture.md",
  surface = "/fixture",
): PublicNumericDocument {
  return { file, surface, source, kind: "markdown" };
}

function typescript(source: string): PublicNumericDocument {
  return {
    file: "src/components/Fixture.tsx",
    surface: "component:Fixture",
    source,
    kind: "typescript",
  };
}

test("an unregistered 250+ countries coverage claim fails", () => {
  const result = auditPublicNumericClaims(
    [markdown("Civica currently covers 250+ countries.")],
    [],
  );

  assert.equal(result.candidates.length, 1);
  assert.ok(
    result.errors.some((error) => error.code === "unregistered-claim"),
  );
});

test("a registered stats marker with a soft fallback passes", () => {
  const document = markdown(
    'Civica currently covers {{stats.countryCount | "available"}} countries.',
  );
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.runtime-country-coverage",
      file: document.file,
      surface: document.surface,
      fragment: '{{stats.countryCount | "available"}} countries',
      disposition: "runtime",
      source: "getSiteStats().countryCount",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.deepEqual(result.errors, []);
});

test("JSX expressions retain word boundaries around count nouns", () => {
  const document = typescript(
    "export function Fixture({ sources }: { sources: unknown[] }) { return <p>Civica catalogues {sources.length} source records.</p>; }",
  );
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.jsx-spacing",
      file: document.file,
      surface: document.surface,
      fragment: "{sources.length} source records",
      disposition: "runtime",
      source: "runtime source rows",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.equal(result.candidates.length, 1);
  assert.match(result.candidates[0].fragment, /\{sources\.length\} source records/);
  assert.deepEqual(result.errors, []);
});

test("a visibly dated registered frozen snapshot passes", () => {
  const document = markdown(
    "As of 2026-07-09, the Civica Atlas release covered 195 countries.",
  );
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.frozen-country-coverage",
      file: document.file,
      surface: document.surface,
      fragment:
        "As of 2026-07-09, the Civica Atlas release covered 195 countries.",
      disposition: "frozen",
      source: "Civica Atlas release manifest",
      asOf: "2026-07-09",
      release: "fixture-release-v1",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.deepEqual(result.errors, []);
});

test("stats fallbacks are required independently of runtime resolution", () => {
  assert.deepEqual(
    findStatsMarkersWithoutFallback(
      'Live: {{stats.countryCount}}; safe: {{stats.sourceCount | "multiple"}}.',
    ).map((failure) => failure.path),
    ["stats.countryCount"],
  );
});

test("registration cannot disguise a stale live literal as frozen", () => {
  const document = markdown("Civica currently covers 250+ countries.");
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.invalid-freeze",
      file: document.file,
      surface: document.surface,
      fragment: "250+ countries",
      disposition: "frozen",
      source: "fixture release",
      asOf: "2026-07-09",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.ok(
    result.errors.some((error) => error.code === "disposition-mismatch"),
  );
});

test("a runtime count cannot disguise a stale literal in the same fragment", () => {
  const document = markdown(
    "Civica covers 250 countries across {{state.dimensionCount}} dimensions.",
  );
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.mixed-runtime-literal",
      file: document.file,
      surface: document.surface,
      fragment: "250 countries across {{state.dimensionCount}} dimensions",
      disposition: "runtime",
      source: "site-state dimension count",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.ok(
    result.errors.some((error) => error.code === "disposition-mismatch"),
  );
});

test("a date in a neighboring paragraph cannot freeze an unrelated literal", () => {
  const document = markdown(
    "As of 2026-01-01, an unrelated dataset was released.\n\nCivica covers 250 countries.",
  );
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.neighboring-freeze",
      file: document.file,
      surface: document.surface,
      fragment: "Civica covers 250 countries",
      disposition: "frozen",
      source: "unrelated release",
      asOf: "2026-01-01",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.ok(
    result.errors.some((error) => error.code === "disposition-mismatch"),
  );
});

test("an endpoint limit cannot exempt a current coverage literal", () => {
  const document = markdown(
    "Civica currently covers 250 countries; the API has a maximum 10-request limit.",
  );
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.mixed-exemption",
      file: document.file,
      surface: document.surface,
      fragment: "Civica currently covers 250 countries",
      disposition: "exempt",
      source: "endpoint limit",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.ok(
    result.errors.some((error) => error.code === "disposition-mismatch"),
  );
});

test("a present-tense coverage verb is current even without the word currently", () => {
  const document = markdown(
    "Civica covers 250 countries; the API has a maximum 10-request limit.",
  );
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.present-coverage-exemption",
      file: document.file,
      surface: document.surface,
      fragment: "Civica covers 250 countries",
      disposition: "exempt",
      source: "endpoint limit",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.ok(
    result.errors.some((error) => error.code === "disposition-mismatch"),
  );
});

test("an unrelated limit never exempts a product-coverage literal", () => {
  for (const verb of [
    "includes",
    "contains",
    "has profiles for",
    "offers profiles for",
  ]) {
    const document = markdown(
      `Civica ${verb} 250 countries; the API has a maximum 10-request limit.`,
    );
    const registry: PublicNumericClaimRegistration[] = [
      {
        id: `fixture.unbound-exemption-${verb.replaceAll(" ", "-")}`,
        file: document.file,
        surface: document.surface,
        fragment: `Civica ${verb} 250 countries`,
        disposition: "exempt",
        source: "endpoint limit",
      },
    ];

    const result = auditPublicNumericClaims([document], registry);
    assert.ok(
      result.errors.some((error) => error.code === "disposition-mismatch"),
      verb,
    );
  }
});

test("removed claims leave orphan registry rows", () => {
  const document = markdown("Civica publishes source-linked country profiles.");
  const registry: PublicNumericClaimRegistration[] = [
    {
      id: "fixture.orphan",
      file: document.file,
      surface: document.surface,
      fragment: "250+ countries",
      disposition: "runtime",
      source: "getSiteStats().countryCount",
    },
  ];

  const result = auditPublicNumericClaims([document], registry);
  assert.ok(
    result.errors.some((error) => error.code === "orphan-registry-entry"),
  );
});
