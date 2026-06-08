import { Fragment, type ReactNode } from "react";
import { SourceDot } from "./SourceDot";
import type { FactbookField } from "@/lib/data/factbook-fields";
import { humanizeLabel, humanizeSectionLabel } from "@/lib/data/humanize-label";
import { slugify } from "@/lib/text/slugify";
import { FactValueDot } from "@/components/factbook/FactValueDot";
import { formatFactRowValue } from "@/components/factbook/FactValuePanel";
import type { ResolverOutput } from "@/lib/factbook/reconcile/types";

/**
 * Phase F.4 — for the small set of structured-section leaves whose
 * label maps cleanly to a Phase F fact-key, we can swap the generic
 * `<SourceDot>` (which only attributes "CIA Factbook") for a clickable
 * `<FactValueDot>` that opens the alternates panel. Most factbook leaf
 * labels (Coastline, Climate, Industries, etc.) are CIA-prose-only and
 * stay on the generic SourceDot.
 *
 * Keys are the human label as rendered by `humanizeLabel(field.label)`
 * — match what the user sees on screen, not the raw underlying key.
 *
 * For multi-year CIA prose groups (Inflation rate, Public debt, etc.)
 * see `MULTI_YEAR_GROUP_TO_FACT_KEY` below — those render a leading
 * "Civica canonical (reconciled)" row above the per-year CIA leaves
 * per the Augment design at
 * `~/civica/plan/factbook-multi-year-rendering-v1.md`.
 */
const LABEL_TO_FACT_KEY: Record<string, string> = {
  Capital: "capital",
  Population: "population_total",
  Languages: "official_languages",
  Currency: "currency_code",
  // Single-shot economy + demographics leaves — CIA emits one row
  // without a year suffix on the label (the year is in the value
  // string instead, e.g. "10.47 births/1,000 population (2025 est.)").
  "Birth rate": "birth_rate",
  "Death rate": "death_rate",
  "Population growth rate": "population_growth_rate",
  "Total fertility rate": "fertility_rate",
  "GDP (official exchange rate)": "gdp_nominal_usd_billions",
};

/**
 * Phase F.4 — multi-year CIA prose groups. The CIA prose stores one
 * leaf per year ("Inflation rate (consumer prices) 2022", "...2023",
 * "...2024") under a top-level group whose humanized label is
 * `"Inflation rate (consumer prices)"`. The resolver returns a single
 * canonical pick from across all sources (WB / IMF / Eurostat / etc.).
 *
 * The Augment design (resolution v1.0, ADOPTED 2026-05-04) prepends
 * one "Civica canonical (reconciled)" row at the top of the group's
 * children, rendering the resolver's pick with `<FactValueDot>`
 * (alternates panel reveals every source). The per-year CIA leaves
 * stay below, unchanged.
 *
 * Doc: `~/civica/plan/factbook-multi-year-rendering-v1.md`
 */
const MULTI_YEAR_GROUP_TO_FACT_KEY: Record<string, string> = {
  // People & Society — the CIA nests population as a "Population" GROUP
  // with a single "Total" child leaf, so neither LABEL_TO_FACT_KEY (keyed
  // on the leaf label "Total") nor the rest of this map matched it, and
  // the section rendered the verbatim CIA figure with no link to the
  // reconciled canonical. For countries where a national-statistics
  // source overrides the CIA (Brazil/IBGE, France/INSEE, UK/ONS,
  // Canada/StatCan, US/Census) that left two different populations on one
  // page — the masthead's reconciled value vs. the section's CIA value —
  // with no explanation. Prepending the "Civica canonical (reconciled)"
  // row here surfaces the same figure the masthead shows, with a
  // FactValueDot alternates panel disclosing the CIA figure beneath it.
  // (Single-value group, not multi-year, but it reuses the same
  // canonical-row mechanism.)
  Population: "population_total",
  // Economy — multi-year CIA prose sets reconciled against Tier-1
  // measurements (WB / IMF / Eurostat / OECD / WTO).
  "Real GDP (purchasing power parity)": "gdp_ppp_usd_billions",
  "Real GDP per capita": "gdp_per_capita_usd",
  "Real GDP growth rate": "gdp_real_growth_rate",
  "Inflation rate (consumer prices)": "inflation_rate",
  "Public debt": "public_debt_pct_gdp",
  "Unemployment rate": "unemployment_rate_pct",
  "Current account balance": "current_account_balance_usd",
  // R.12 trade-aggregate split — CIA reports goods+services per its
  // glossary, so map both Exports and Imports to the goods+services
  // fact-key (WB canonical) per
  // `~/civica/plan/trade-aggregate-fact-keys-v1.md`.
  Exports: "exports_goods_services_usd",
  Imports: "imports_goods_services_usd",
  // Military section.
  "Military expenditures": "military_expenditure_pct_gdp",
};

/**
 * Phase R.14 — auxiliary canonical rows.
 *
 * Some multi-year CIA prose groups have MORE THAN ONE methodologically
 * distinct canonical fact-key. The R.12 trade-aggregate precedent
 * surfaced two distinct measurements for trade (`exports_merchandise_usd`
 * vs `exports_goods_services_usd`); R.14 ONS-UK introduces the
 * Maastricht-vs-PSND public-debt distinction.
 *
 * `MULTI_YEAR_GROUP_TO_FACT_KEY` ships ONE primary canonical per group
 * (renders a single "Civica canonical (reconciled)" row). This map
 * adds zero-or-more AUXILIARY canonical fact-keys per group; each
 * auxiliary that has resolver data renders an additional row labeled
 * with its methodology hint (e.g. "PSND, excl. PSB (UK)" rather than
 * the generic "Civica canonical").
 *
 * Auxiliary rows render BELOW the primary canonical row and ABOVE the
 * CIA per-year leaves. They render only when the auxiliary fact-key
 * has a canonical resolver row for the current jurisdiction — non-UK
 * jurisdictions don't render the PSND row because no `ons_uk` row
 * exists for them.
 *
 * Per `~/civica/plan/ons-uk-resolution-v1.md` §6 Q3 sign-off (pulled
 * from v1.1 to v1) + the user's R.12 surfacing instruction.
 */
interface AuxFactKeyConfig {
  /** Civica fact-key. */
  factKey: string;
  /** Eyebrow label shown on the auxiliary row, replacing the default
   *  "Civica canonical (reconciled)". Should hint at the methodology
   *  distinction (e.g. "PSND, excl. PSB (UK)" for HF6X). */
  eyebrowLabel: string;
}

const MULTI_YEAR_GROUP_TO_AUX_FACT_KEYS: Record<string, AuxFactKeyConfig[]> = {
  // R.14 — Public Sector Net Debt (excl. public sector banks) is
  // ONS's UK-specific narrower scope (HF6X, ~95% GDP) compared to the
  // primary `public_debt_pct_gdp` fact-key (Maastricht-style General
  // Government Gross Debt, ~103-131% GDP depending on publisher).
  // Renders ONLY for UK (the only jurisdiction with an ons_uk row);
  // non-UK pages see only the primary canonical row.
  "Public debt": [
    {
      factKey: "public_debt_psnd_pct_gdp",
      eyebrowLabel: "Public Sector Net Debt, excl. public sector banks (UK only)",
    },
  ],
};

// Match opening or closing tags for a small allowlist of inline elements.
// Note: there is no negative lookahead — earlier `(?!<)` caused the first
// of consecutive tags (e.g. the leading <br> in `<br><br>`) to be skipped
// and rendered as literal text.
const INLINE_TAG_RE = /<(\/?)(strong|b|em|i|br|p)\s*\/?>/gi;

function renderInlineHtml(raw: string): ReactNode {
  if (!raw || !/<[a-z]/i.test(raw)) return raw;

  const nodes: ReactNode[] = [];
  const stack: Array<{ tag: string; children: ReactNode[] }> = [
    { tag: "root", children: nodes },
  ];
  let cursor = 0;
  let key = 0;

  const pushText = (text: string) => {
    if (!text) return;
    stack[stack.length - 1].children.push(text);
  };

  for (const match of raw.matchAll(INLINE_TAG_RE)) {
    const [full, slash, tagRaw] = match;
    const idx = match.index ?? 0;
    pushText(raw.slice(cursor, idx));
    cursor = idx + full.length;

    const tag = tagRaw.toLowerCase();

    if (tag === "br") {
      stack[stack.length - 1].children.push(<br key={`br-${key++}`} />);
      continue;
    }
    if (tag === "p") {
      if (slash) {
        stack[stack.length - 1].children.push(<br key={`p-${key++}`} />);
      }
      continue;
    }

    if (!slash) {
      stack.push({ tag, children: [] });
      continue;
    }

    const top = stack[stack.length - 1];
    if (stack.length > 1 && top.tag === tag) {
      stack.pop();
      const parent = stack[stack.length - 1];
      const k = `${tag}-${key++}`;
      if (tag === "strong" || tag === "b") {
        parent.children.push(
          <strong key={k} style={{ color: "var(--color-text-primary)" }}>
            {top.children}
          </strong>
        );
      } else if (tag === "em" || tag === "i") {
        parent.children.push(<em key={k}>{top.children}</em>);
      } else {
        parent.children.push(<Fragment key={k}>{top.children}</Fragment>);
      }
    }
  }
  pushText(raw.slice(cursor));

  while (stack.length > 1) {
    const top = stack.pop()!;
    stack[stack.length - 1].children.push(
      <Fragment key={`unclosed-${key++}`}>{top.children}</Fragment>
    );
  }

  return <>{nodes}</>;
}

function renderValueWithSource(raw: string, sourceNode: ReactNode): ReactNode {
  if (/<[a-z]/i.test(raw)) {
    return (
      <>
        {renderInlineHtml(raw.replace(/\s*<\/p>\s*$/i, ""))}
        <span className="factbook-source-hang">{sourceNode}</span>
      </>
    );
  }

  const match = raw.match(/(\S+)\s*$/);
  if (!match || match.index == null) {
    return (
      <>
        {raw}
        <span className="factbook-value-source-lock">{sourceNode}</span>
      </>
    );
  }

  return (
    <>
      {raw.slice(0, match.index)}
      <span className="factbook-value-source-lock">
        {match[1]}
        {sourceNode}
      </span>
    </>
  );
}

interface FactbookSectionProps {
  sectionName: string;
  fields: FactbookField[];
  source?: string;
  retrievedAt?: string;
  /** Optional prefix for subsection DOM ids — typically the parent
   *  section's id. Yields ids like `government--legal-system` so a
   *  scroll-spy / right-rail can target individual subsections. */
  idPrefix?: string;
  /** Phase F.4 — resolver outputs keyed by Phase F fact-key. When a
   *  leaf's humanized label matches a key in `LABEL_TO_FACT_KEY` AND
   *  the resolver returned a canonical row, the row renders
   *  `<FactValueDot>` (clickable alternates panel) instead of the
   *  plain CIA-Factbook `<SourceDot>`. Optional — pages that don't
   *  pass this still get the legacy single-source attribution. */
  resolverFacts?: Record<string, ResolverOutput>;
}

type LeafField = Extract<FactbookField, { kind: "leaf" }>;
type GroupField = Extract<FactbookField, { kind: "group" }>;

function LeafRow({
  field,
  source,
  retrievedAt,
  resolverFacts,
}: {
  field: LeafField;
  source?: string;
  retrievedAt?: string;
  resolverFacts?: Record<string, ResolverOutput>;
}) {
  const humanLabel = humanizeLabel(field.label);
  // Phase F.4 — does this leaf map to a Phase F fact-key, AND did the
  // resolver return a canonical row? If yes, swap the SourceDot for a
  // FactValueDot so the alternates panel is one click away.
  const factKey = LABEL_TO_FACT_KEY[humanLabel];
  const resolverFact = factKey ? resolverFacts?.[factKey] : undefined;
  const hasCanonical = resolverFact?.canonical != null;
  const hasInteractiveSource = hasCanonical && resolverFact && factKey;
  const sourceNode =
    hasInteractiveSource ? (
      <FactValueDot
        factKey={factKey}
        factLabel={humanLabel}
        resolverOutput={resolverFact}
        canonicalSourceId={resolverFact.canonical?.sourceId ?? null}
        ariaLabel={`${humanLabel}, see sources`}
      />
    ) : source && retrievedAt ? (
      <SourceDot source={source} retrievedAt={retrievedAt} />
    ) : null;

  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--color-stat-border)",
      }}
    >
      <dt
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-40)",
          marginBottom: 4,
        }}
      >
        {humanLabel}
      </dt>
      <dd
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-14)",
          lineHeight: "var(--leading-relaxed)",
          color: "var(--color-text-85)",
          margin: 0,
        }}
      >
        {sourceNode
          ? renderValueWithSource(field.value, sourceNode)
          : renderInlineHtml(field.value)}
      </dd>
    </div>
  );
}

/**
 * Phase F.4 — Augment row.
 *
 * The "Civica canonical (reconciled)" leaf rendered at the top of
 * each multi-year CIA prose group whose humanized label appears in
 * `MULTI_YEAR_GROUP_TO_FACT_KEY`. Visual contract is identical to
 * `<LeafRow>` — same `<dt>/<dd>` shape, same tokens — so the row
 * sits alongside the group's existing per-year CIA leaves without
 * any visual treatment that would compete for attention.
 *
 * The displayed value is formatted by `formatFactRowValue()`
 * (re-export from `<FactValuePanel>`) so the headline number and
 * the panel's first row are guaranteed to match.
 *
 * Resolution doc: `~/civica/plan/factbook-multi-year-rendering-v1.md`
 * (ADOPTED 2026-05-04).
 */
function CanonicalLeafRow({
  factKey,
  factLabel,
  resolverOutput,
  eyebrowLabel,
}: {
  factKey: string;
  factLabel: string;
  resolverOutput: ResolverOutput;
  /** R.14 — optional override for the eyebrow label. When omitted,
   *  defaults to "Civica canonical (reconciled)". Auxiliary rows
   *  (R.14 PSND) pass a methodology-hint eyebrow like
   *  "Public Sector Net Debt, excl. public sector banks (UK only)". */
  eyebrowLabel?: string;
}) {
  const canonical = resolverOutput.canonical;
  if (!canonical) return null;
  const value = formatFactRowValue(canonical, factKey);

  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--color-stat-border)",
      }}
    >
      <dt
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-40)",
          marginBottom: 4,
        }}
      >
        {eyebrowLabel ?? "Civica canonical (reconciled)"}
      </dt>
      <dd
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-14)",
          lineHeight: "var(--leading-relaxed)",
          color: "var(--color-text-85)",
          margin: 0,
        }}
      >
        {renderValueWithSource(
          value,
          <FactValueDot
            factKey={factKey}
            factLabel={factLabel}
            resolverOutput={resolverOutput}
            canonicalSourceId={canonical.sourceId ?? null}
            ariaLabel={`${factLabel}, see all sources`}
          />
        )}
      </dd>
    </div>
  );
}

function GroupBlock({
  field,
  source,
  retrievedAt,
  depth = 0,
  idPrefix,
  resolverFacts,
}: {
  field: GroupField;
  source?: string;
  retrievedAt?: string;
  depth?: number;
  idPrefix?: string;
  resolverFacts?: Record<string, ResolverOutput>;
}) {
  const HeadingTag = depth === 0 ? "h3" : "h4";
  const headingFontSize = depth === 0 ? "var(--text-20)" : "var(--text-16)";
  const blockMarginTop = depth === 0 ? "var(--space-7)" : "var(--space-5)";
  // Subsection headings use title case ("Capital", "Independence",
  // "Country Name") — matches the convention for headings + TOC items.
  // Slug ids stay derived from the same string so anchors are stable.
  const headingText = humanizeSectionLabel(field.label);
  const headingId = idPrefix && depth === 0
    ? `${idPrefix}--${slugify(headingText)}`
    : undefined;

  // Phase F.4 — multi-year group augmentation. If this group's
  // humanized label matches `MULTI_YEAR_GROUP_TO_FACT_KEY` AND the
  // resolver returned a canonical row, prepend a "Civica canonical
  // (reconciled)" leaf above the group's existing CIA per-year
  // leaves. See the Augment design at
  // `~/civica/plan/factbook-multi-year-rendering-v1.md`.
  //
  // Use the sentence-case humanized label for matching (matches the
  // map keys), but the title-case section label for the heading
  // (matches the existing typography contract). v1 only canonicalizes
  // top-level groups (depth === 0); composition tables and other
  // nested groups stay pure CIA prose per the resolution's §6 Q1.
  //
  // Phase R.14 — auxiliary canonical rows. Some groups carry MORE
  // THAN ONE methodologically distinct canonical (e.g. Public debt
  // has both Maastricht-style General Government Gross Debt — primary
  // — and ONS-UK PSND-excl-PSB — auxiliary, UK only). Auxiliary rows
  // render with a methodology-hint eyebrow label and only when their
  // fact-key has a canonical resolver row for the current jurisdiction.
  // See `~/civica/plan/ons-uk-resolution-v1.md` §6 Q3 sign-off.
  const groupHumanLabel = humanizeLabel(field.label);
  const canonicalFactKey =
    depth === 0 ? MULTI_YEAR_GROUP_TO_FACT_KEY[groupHumanLabel] : undefined;
  const canonicalResolverOutput = canonicalFactKey
    ? resolverFacts?.[canonicalFactKey]
    : undefined;
  const renderCanonicalRow =
    canonicalFactKey != null &&
    canonicalResolverOutput?.canonical != null;

  // R.14 — auxiliary fact-keys for this group, if any. Each aux row
  // renders only when its resolver entry exists AND has a canonical
  // pick. Non-applicable jurisdictions (e.g. non-UK pages for the
  // PSND aux row) silently skip.
  const auxConfigs =
    depth === 0 ? MULTI_YEAR_GROUP_TO_AUX_FACT_KEYS[groupHumanLabel] : undefined;
  const auxRows = (auxConfigs ?? [])
    .map((cfg) => {
      const out = resolverFacts?.[cfg.factKey];
      if (!out?.canonical) return null;
      return { cfg, resolverOutput: out };
    })
    .filter(
      (
        row,
      ): row is {
        cfg: AuxFactKeyConfig;
        resolverOutput: ResolverOutput;
      } => row != null,
    );

  return (
    <div style={{ marginTop: blockMarginTop, scrollMarginTop: "calc(56px + var(--space-5))" }}>
      <HeadingTag
        id={headingId}
        className="factbook-subsection-title"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: headingFontSize,
          fontWeight: 400,
          margin: "0 0 var(--space-3)",
          color: "var(--color-text-primary)",
          letterSpacing: "var(--tracking-tighter)",
        }}
      >
        {headingText}
      </HeadingTag>
      {(renderCanonicalRow || auxRows.length > 0) && (
        <dl style={{ margin: 0 }}>
          {renderCanonicalRow && canonicalFactKey && canonicalResolverOutput && (
            <CanonicalLeafRow
              factKey={canonicalFactKey}
              factLabel={headingText}
              resolverOutput={canonicalResolverOutput}
            />
          )}
          {auxRows.map(({ cfg, resolverOutput }) => (
            <CanonicalLeafRow
              key={cfg.factKey}
              factKey={cfg.factKey}
              factLabel={headingText}
              resolverOutput={resolverOutput}
              eyebrowLabel={cfg.eyebrowLabel}
            />
          ))}
        </dl>
      )}
      {renderFields(field.children, source, retrievedAt, depth + 1, idPrefix, resolverFacts)}
    </div>
  );
}

// Group consecutive leaves into a single <dl>; render group fields as
// their own subsection blocks. This avoids producing a leaf row with an
// empty value above its children.
function renderFields(
  fields: FactbookField[],
  source: string | undefined,
  retrievedAt: string | undefined,
  depth: number,
  idPrefix?: string,
  resolverFacts?: Record<string, ResolverOutput>
): ReactNode[] {
  const out: ReactNode[] = [];
  let leafBuffer: LeafField[] = [];
  let dlIndex = 0;

  const flushLeaves = () => {
    if (leafBuffer.length === 0) return;
    const buf = leafBuffer;
    leafBuffer = [];
    out.push(
      <dl key={`dl-${dlIndex++}`} style={{ margin: 0 }}>
        {buf.map((leaf) => (
          <LeafRow
            key={leaf.label}
            field={leaf}
            source={source}
            retrievedAt={retrievedAt}
            resolverFacts={resolverFacts}
          />
        ))}
      </dl>
    );
  };

  for (const field of fields) {
    if (field.kind === "leaf") {
      leafBuffer.push(field);
      continue;
    }
    flushLeaves();
    out.push(
      <GroupBlock
        key={`group-${field.label}`}
        field={field}
        source={source}
        retrievedAt={retrievedAt}
        depth={depth}
        idPrefix={idPrefix}
        resolverFacts={resolverFacts}
      />
    );
  }
  flushLeaves();
  return out;
}

export function FactbookSection({
  sectionName,
  fields,
  source,
  retrievedAt,
  idPrefix,
  resolverFacts,
}: FactbookSectionProps) {
  if (fields.length === 0) {
    return (
      <div
        style={{
          padding: "var(--spacing-content-top) 0",
          textAlign: "center",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-14)",
          color: "var(--color-text-40)",
        }}
      >
        No data available for this section.
      </div>
    );
  }

  return (
    <section aria-label={sectionName}>
      {renderFields(fields, source, retrievedAt, 0, idPrefix, resolverFacts)}
    </section>
  );
}
