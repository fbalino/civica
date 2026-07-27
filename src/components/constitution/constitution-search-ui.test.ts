import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConstitutionPassageCard } from "./ConstitutionPassageCard";
import { ConstitutionSearchForm } from "./ConstitutionSearchForm";
import { ConstitutionSearchResults } from "./ConstitutionSearchResults";
import {
  CONSTITUTION_SEARCH_RANKING_METHOD,
  CONSTITUTION_SEARCH_SCHEMA_VERSION,
  type ConstitutionSearchResponse,
  type ConstitutionSearchResult,
} from "@/lib/constitution/search-contract";
import { CONSTITUTION_SEARCH_INDEX_VERSION } from "@/lib/constitution/passage-index";

const result: ConstitutionSearchResult = {
  passageId: "constitution/japan:section/96",
  readerUrl: "/constitution/passage/constitution-japan-section-96",
  citationUrl: "/constitution/passage/constitution-japan-section-96#cite",
  rank: 0.75,
  jurisdiction: {
    id: "jp",
    slug: "japan",
    name: "Japan",
    iso2: "JP",
    iso3: "JPN",
    status: "sovereign_state",
    statusLabel: "Sovereign state",
    disputed: false,
  },
  constitution: {
    id: "jp-constitution",
    sourceDocumentId: "Japan_2016",
    year: 1946,
    yearUpdated: 2016,
    documentNature: "single-document",
    dateLabel: "Enacted 1946 · last amended 2016",
  },
  passage: {
    sourceSectionId: "section/96",
    anchorId: "sec-section-96",
    headingLabel: "Article 96",
    topicKeys: ["amend"],
    language: {
      code: "en",
      basis: "constitute-service-lang-parameter",
      translationStatus:
        "publisher-supplied-language-version-translation-status-unknown",
      originalLanguageCode: null,
      translator: null,
    },
    highlightSegments: [
      { text: "Amendments ", highlighted: true },
      { text: "shall be initiated by the Diet.", highlighted: false },
    ],
  },
  provenance: {
    sourceId: "constitute_project",
    sourceName: "Constitute Project",
    sourceUrl: "https://www.constituteproject.org/constitution/Japan_2016",
    retrievalUrl: "https://www.constituteproject.org/service/html",
    licenseId: "CC-BY-NC-3.0",
    termsUrl: "https://creativecommons.org/licenses/by-nc/3.0/",
    retrievedAt: "2026-07-11T00:00:00.000Z",
    contentSha256: "a".repeat(64),
  },
};

const response: ConstitutionSearchResponse = {
  schemaVersion: CONSTITUTION_SEARCH_SCHEMA_VERSION,
  state: "ok",
  query: {
    raw: "emergency powers",
    normalized: "emergency powers",
    language: "en",
    rankingMethod: CONSTITUTION_SEARCH_RANKING_METHOD,
  },
  filters: {
    jurisdictions: ["japan"],
    topics: ["amend"],
    topicMode: "any",
  },
  data: [result],
  pagination: { limit: 20, hasMore: true, nextCursor: "cursor/+==" },
  corpus: {
    indexVersion: CONSTITUTION_SEARCH_INDEX_VERSION,
    sourceId: "constitute_project",
    sourceLastSyncedAt: "2026-07-11T00:00:00.000Z",
  },
  rights: {
    access: "interactive-noncommercial-display-only",
    bulkExport: "blocked",
    licenseId: "CC-BY-NC-3.0",
    termsUrl: "https://creativecommons.org/licenses/by-nc/3.0/",
  },
};

test("passage card uses a safe heading id and exposes provenance", () => {
  const html = renderToStaticMarkup(
    createElement(ConstitutionPassageCard, { result }),
  );
  assert.match(
    html,
    /id="constitution-passage-constitution-japan-section-96"/,
  );
  assert.match(html, /<h3/);
  assert.doesNotMatch(html, /<h2/);
  assert.match(html, /<mark>Amendments <\/mark>/);
  assert.match(html, /CC-BY-NC-3.0/);
  assert.match(html, /translation status are not verified/);
});

test("search form submits URL-driven query and filter names", () => {
  const html = renderToStaticMarkup(
    createElement(ConstitutionSearchForm, {
      defaultQuery: "courts",
      defaultJurisdiction: "japan",
      defaultTopic: "amend",
      jurisdictionOptions: [{ value: "japan", label: "Japan" }],
      topicOptions: [{ value: "amend", label: "Constitutional amendment" }],
    }),
  );
  assert.match(html, /action="\/constitution\/search"/);
  assert.match(html, /name="q"/);
  assert.match(html, /name="jurisdiction"/);
  assert.match(html, /name="topic"/);
});

test("result pagination preserves query and filters in the next URL", () => {
  const html = renderToStaticMarkup(
    createElement(ConstitutionSearchResults, { response }),
  );
  assert.match(html, /Next results/);
  assert.match(html, /q=emergency\+powers/);
  assert.match(html, /jurisdiction=japan/);
  assert.match(html, /topic=amend/);
  assert.match(html, /cursor=cursor%2F%2B%3D%3D/);
});

test("rate-limited search is announced as an alert", () => {
  const html = renderToStaticMarkup(
    createElement(ConstitutionSearchResults, {
      error: {
        schemaVersion: CONSTITUTION_SEARCH_SCHEMA_VERSION,
        error: "rate_limited",
        message: "Rate limit exceeded. Try again shortly.",
      },
    }),
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /Rate limit exceeded/);
  assert.doesNotMatch(html, /No passages found/);
});

test("UK composite collection never implies one 798-year amended constitution", () => {
  const ukResult: ConstitutionSearchResult = {
    ...result,
    passageId: "constitution/united-kingdom:section/1",
    jurisdiction: {
      ...result.jurisdiction,
      slug: "united-kingdom",
      name: "United Kingdom",
      iso2: "GB",
      iso3: "GBR",
    },
    constitution: {
      ...result.constitution,
      sourceDocumentId: "United_Kingdom_2013",
      year: 1215,
      yearUpdated: 2013,
      documentNature: "publisher-composite-collection",
      dateLabel: "Source collection spans 1215–2013",
    },
  };
  const html = renderToStaticMarkup(
    createElement(ConstitutionPassageCard, { result: ukResult }),
  );
  assert.match(html, /Constitute composite collection/);
  assert.match(html, /texts dated 1215–2013/);
  assert.doesNotMatch(html, /Amended 2013/);
  assert.doesNotMatch(html, /Enacted 1215/);
});

test("filter catalog failure is visible without claiming search failure", () => {
  const html = renderToStaticMarkup(
    createElement(ConstitutionSearchForm, {
      defaultQuery: "courts",
      filterCatalogAvailable: false,
    }),
  );
  assert.match(html, /role="status"/);
  assert.match(html, /Filter catalog unavailable; text search still works/);
  assert.doesNotMatch(html, /Constitution search is unavailable/);
});
