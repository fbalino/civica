"use client";

import { useState, useTransition } from "react";

import {
  DATA_ERROR_REPORT_NOTICE_VERSION,
  REPORTABLE_ATLAS_ENTITY_TYPES,
  type ReportableAtlasEntityType,
} from "@/lib/corrections/data-error-report";

interface CountryOption {
  slug: string;
  name: string;
}

interface ReportPrefill {
  countrySlug: string;
  entityType: ReportableAtlasEntityType | "";
  entityId: string;
  fieldPath: string;
  releaseId: string;
  sourceId: string;
  sourceUrl: string;
  publishedValue: string;
}

interface Receipt {
  receipt: string;
  acknowledgedAt: string;
}

const ENTITY_LABELS: Record<ReportableAtlasEntityType, string> = {
  fact: "Country fact",
  institution: "Institution or chamber",
  office: "Office",
  person: "Person",
  election: "Election",
  "constitution-passage": "Constitution passage",
  organization: "Organization",
  indicator: "Indicator observation",
};

export function ReportDataIssueForm({
  countries,
  prefill,
}: {
  countries: CountryOption[];
  prefill: ReportPrefill;
}) {
  const [countrySlug, setCountrySlug] = useState(prefill.countrySlug);
  const [entityType, setEntityType] = useState(prefill.entityType);
  const [entityId, setEntityId] = useState(prefill.entityId);
  const [fieldPath, setFieldPath] = useState(prefill.fieldPath);
  const [releaseId, setReleaseId] = useState(prefill.releaseId);
  const [sourceId, setSourceId] = useState(prefill.sourceId);
  const [sourceUrl, setSourceUrl] = useState(prefill.sourceUrl);
  const [publishedValue, setPublishedValue] = useState(
    prefill.publishedValue,
  );
  const [proposedValue, setProposedValue] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterAffiliation, setSubmitterAffiliation] = useState("");
  const [requestPrivacy, setRequestPrivacy] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [trap, setTrap] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/civica-index/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "atlas_data_error",
          countrySlug: countrySlug || null,
          dimension: null,
          entityType,
          entityId,
          fieldPath,
          releaseId,
          sourceId,
          sourceUrl,
          publishedValue,
          proposedValue: proposedValue || null,
          evidenceUrl: evidenceUrl || null,
          description,
          submitterName: submitterName || null,
          submitterEmail: submitterEmail || null,
          submitterAffiliation: submitterAffiliation || null,
          requestPrivacy,
          noticeVersion: DATA_ERROR_REPORT_NOTICE_VERSION,
          noticeAccepted,
          _trap: trap,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        receipt?: string;
        acknowledgedAt?: string;
      };
      if (
        response.ok &&
        typeof body.receipt === "string" &&
        typeof body.acknowledgedAt === "string"
      ) {
        setReceipt({
          receipt: body.receipt,
          acknowledgedAt: body.acknowledgedAt,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setError(
        body.error ??
          "The report could not be submitted. No correction record was created.",
      );
    });
  }

  if (receipt) {
    return (
      <div className="corr-success-banner" role="status">
        <strong>Report acknowledged: {receipt.receipt}.</strong> Keep this
        receipt for follow-up. It confirms intake at{" "}
        {new Date(receipt.acknowledgedAt).toLocaleString("en", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        ; it is not a finding that the reported value is wrong and does not
        promise an email response.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="corr-form" noValidate>
      {error ? (
        <div className="corr-field-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="report-website">Leave this field empty</label>
        <input
          id="report-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(event) => setTrap(event.target.value)}
        />
      </div>

      <fieldset className="corr-fieldset">
        <legend className="corr-legend">Exact published record</legend>

        <div className="corr-field">
          <label className="corr-label" htmlFor="report-country">
            Country or area <span className="corr-hint">(when applicable)</span>
          </label>
          <select
            id="report-country"
            className="corr-select"
            value={countrySlug}
            onChange={(event) => setCountrySlug(event.target.value)}
          >
            <option value="">Not country-specific</option>
            {countries.map((country) => (
              <option key={country.slug} value={country.slug}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div className="corr-field">
          <label className="corr-label" htmlFor="report-entity-type">
            Entity type <span className="corr-required">*</span>
          </label>
          <select
            id="report-entity-type"
            className="corr-select"
            value={entityType}
            onChange={(event) =>
              setEntityType(event.target.value as ReportableAtlasEntityType)
            }
            required
          >
            <option value="">Select one</option>
            {REPORTABLE_ATLAS_ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENTITY_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {[
          {
            id: "report-entity-id",
            label: "Stable entity ID",
            value: entityId,
            set: setEntityId,
            placeholder: "The ID from a citation or API response",
          },
          {
            id: "report-field-path",
            label: "Field or property",
            value: fieldPath,
            set: setFieldPath,
            placeholder: "For example: population.value",
          },
          {
            id: "report-release",
            label: "Affected release or version",
            value: releaseId,
            set: setReleaseId,
            placeholder: "For example: atlas-2026-07-11",
          },
          {
            id: "report-source-id",
            label: "Displayed source",
            value: sourceId,
            set: setSourceId,
            placeholder: "Source name or Civica source ID",
          },
          {
            id: "report-published-value",
            label: "Published value or text",
            value: publishedValue,
            set: setPublishedValue,
            placeholder: "Copy the value exactly as displayed",
          },
        ].map((field) => (
          <div className="corr-field" key={field.id}>
            <label className="corr-label" htmlFor={field.id}>
              {field.label} <span className="corr-required">*</span>
            </label>
            <input
              id={field.id}
              className="corr-input"
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
              placeholder={field.placeholder}
              maxLength={2_000}
              required
            />
          </div>
        ))}

        <div className="corr-field">
          <label className="corr-label" htmlFor="report-source-url">
            Displayed source URL <span className="corr-required">*</span>
          </label>
          <input
            id="report-source-url"
            className="corr-input"
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://publisher.example/record"
            maxLength={2_048}
            required
          />
        </div>
      </fieldset>

      <fieldset className="corr-fieldset">
        <legend className="corr-legend">Why it may be wrong</legend>
        <div className="corr-field">
          <label className="corr-label" htmlFor="report-proposed-value">
            Proposed value or wording{" "}
            <span className="corr-hint">(optional)</span>
          </label>
          <input
            id="report-proposed-value"
            className="corr-input"
            value={proposedValue}
            onChange={(event) => setProposedValue(event.target.value)}
            maxLength={2_000}
          />
        </div>
        <div className="corr-field">
          <label className="corr-label" htmlFor="report-evidence-url">
            Supporting evidence URL{" "}
            <span className="corr-hint">(optional)</span>
          </label>
          <input
            id="report-evidence-url"
            className="corr-input"
            type="url"
            inputMode="url"
            value={evidenceUrl}
            onChange={(event) => setEvidenceUrl(event.target.value)}
            maxLength={2_048}
          />
        </div>
        <div className="corr-field">
          <label className="corr-label" htmlFor="report-description">
            Explanation <span className="corr-required">*</span>
          </label>
          <textarea
            id="report-description"
            className="corr-textarea"
            rows={7}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={10_000}
            required
          />
          <div className="corr-char-count">
            {description.length} / 10,000
          </div>
        </div>
      </fieldset>

      <fieldset className="corr-fieldset">
        <legend className="corr-legend">
          Contact details <span className="corr-hint">(all optional)</span>
        </legend>
        <div className="corr-field">
          <label className="corr-label" htmlFor="report-name">
            Name
          </label>
          <input
            id="report-name"
            className="corr-input"
            value={submitterName}
            onChange={(event) => setSubmitterName(event.target.value)}
            maxLength={200}
          />
        </div>
        <div className="corr-field">
          <label className="corr-label" htmlFor="report-email">
            Email
          </label>
          <input
            id="report-email"
            className="corr-input"
            type="email"
            value={submitterEmail}
            onChange={(event) => setSubmitterEmail(event.target.value)}
            maxLength={320}
          />
        </div>
        <div className="corr-field">
          <label className="corr-label" htmlFor="report-affiliation">
            Affiliation
          </label>
          <input
            id="report-affiliation"
            className="corr-input"
            value={submitterAffiliation}
            onChange={(event) => setSubmitterAffiliation(event.target.value)}
            maxLength={300}
          />
        </div>
      </fieldset>

      <div className="corr-field corr-privacy-field">
        <label className="corr-privacy-label">
          <input
            type="checkbox"
            className="corr-checkbox"
            checked={requestPrivacy}
            onChange={(event) => setRequestPrivacy(event.target.checked)}
          />
          <span>
            <strong>Keep the report private.</strong> Contact details are never
            public. When selected, the report description and record
            coordinates are also omitted from the public corrections log.
          </span>
        </label>
      </div>

      <div className="corr-field corr-privacy-field">
        <label className="corr-privacy-label">
          <input
            type="checkbox"
            className="corr-checkbox"
            checked={noticeAccepted}
            onChange={(event) => setNoticeAccepted(event.target.checked)}
            required
          />
          <span>
            <strong>I accept the data-report notice.</strong> Civica stores the
            report, optional contact details, receipt, triage, and any linked
            correction history to investigate and preserve an accountable
            evidence trail. I will not submit secrets or unnecessary personal
            data.
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="btn btn--primary"
        disabled={isPending || !noticeAccepted}
      >
        {isPending ? "Submitting…" : "Submit data report"}
      </button>
    </form>
  );
}
