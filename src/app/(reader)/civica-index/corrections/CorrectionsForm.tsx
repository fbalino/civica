"use client";

import { useState, useTransition } from "react";
import { civicaIndex, disputeSla } from "@/lib/content/site-state";

interface Country {
  slug: string;
  name: string;
}

interface Props {
  countries: Country[];
  submitted: boolean;
}

const CATEGORIES = [
  { value: "ci_data_error", label: "CI data error — wrong value in a score" },
  { value: "ci_methodology", label: "CI methodology — disagree with the approach" },
  { value: "pulse_misclassification", label: "Pulse — event misclassified" },
  { value: "pulse_severity", label: "Pulse — severity score is wrong" },
  { value: "pulse_false_positive", label: "Pulse — event should not have been included" },
  { value: "pulse_missing_event", label: "Pulse — significant event is missing" },
  { value: "pulse_duplicate", label: "Pulse — duplicate event" },
  { value: "other", label: "Other" },
];

// Derived from src/lib/content/site-state.ts so the form's CI dimension
// options always match the running scored composite. v2 Beta is 4-dim;
// human_development and stability_security are now part of Civica
// Conditions, not CI — they're intentionally absent here.
const CI_DIMENSIONS = civicaIndex.dimensions.map((d) => ({
  value: d.id,
  label: d.label,
}));

const CI_RELATED_CATEGORIES = ["ci_data_error", "ci_methodology"];

export function CorrectionsForm({ countries, submitted }: Props) {
  const [category, setCategory] = useState("");
  const [countrySlug, setCountrySlug] = useState("");
  const [dimension, setDimension] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterAffiliation, setSubmitterAffiliation] = useState("");
  const [description, setDescription] = useState("");
  const [requestPrivacy, setRequestPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(submitted);
  const [isPending, startTransition] = useTransition();

  const showDimension = CI_RELATED_CATEGORIES.includes(category);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category) { setError("Please select a category."); return; }
    if (description.trim().length < 10) { setError("Please provide a description (at least 10 characters)."); return; }

    startTransition(async () => {
      const res = await fetch("/api/civica-index/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          countrySlug: countrySlug || null,
          dimension: showDimension && dimension ? dimension : null,
          submitterName: submitterName || null,
          submitterEmail: submitterEmail || null,
          submitterAffiliation: submitterAffiliation || null,
          description,
          requestPrivacy,
        }),
      });
      if (res.ok) {
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
      }
    });
  }

  if (done) {
    return (
      <div className="corr-success-banner">
        <strong>Submission received.</strong> We&rsquo;ll send an initial response within {disputeSla.initialResponseDays} days.
        Thank you for helping improve the Civica Index.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="corr-form" noValidate>
      {error && <div className="corr-field-error" role="alert">{error}</div>}

      <div className="corr-field">
        <label className="corr-label" htmlFor="category">
          Category <span className="corr-required">*</span>
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="corr-select"
          required
        >
          <option value="">— select one —</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="corr-field">
        <label className="corr-label" htmlFor="countrySlug">
          Country <span className="corr-hint">(optional — leave blank for methodology-wide issues)</span>
        </label>
        <select
          id="countrySlug"
          value={countrySlug}
          onChange={(e) => setCountrySlug(e.target.value)}
          className="corr-select"
        >
          <option value="">— all countries / not country-specific —</option>
          {countries.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>

      {showDimension && (
        <div className="corr-field">
          <label className="corr-label" htmlFor="dimension">
            Dimension <span className="corr-hint">(optional)</span>
          </label>
          <select
            id="dimension"
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="corr-select"
          >
            <option value="">— not dimension-specific —</option>
            {CI_DIMENSIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="corr-field">
        <label className="corr-label" htmlFor="description">
          Description <span className="corr-required">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="corr-textarea"
          rows={6}
          placeholder="Describe the issue clearly — include the data point in question, the value you believe is wrong, and your suggested correction or source."
          required
        />
        <div className="corr-char-count">{description.length} / 10,000</div>
      </div>

      <fieldset className="corr-fieldset">
        <legend className="corr-legend">Your details <span className="corr-hint">(all optional)</span></legend>
        <div className="corr-field">
          <label className="corr-label" htmlFor="submitterName">Name</label>
          <input
            id="submitterName"
            type="text"
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            className="corr-input"
            placeholder="Jane Smith"
            maxLength={200}
          />
        </div>
        <div className="corr-field">
          <label className="corr-label" htmlFor="submitterEmail">Email</label>
          <input
            id="submitterEmail"
            type="email"
            value={submitterEmail}
            onChange={(e) => setSubmitterEmail(e.target.value)}
            className="corr-input"
            placeholder="jane@university.edu"
            maxLength={320}
          />
        </div>
        <div className="corr-field">
          <label className="corr-label" htmlFor="submitterAffiliation">Affiliation</label>
          <input
            id="submitterAffiliation"
            type="text"
            value={submitterAffiliation}
            onChange={(e) => setSubmitterAffiliation(e.target.value)}
            className="corr-input"
            placeholder="e.g. Researcher at X University, Ministry of Y"
            maxLength={300}
          />
        </div>
      </fieldset>

      <div className="corr-field corr-privacy-field">
        <label className="corr-privacy-label">
          <input
            type="checkbox"
            checked={requestPrivacy}
            onChange={(e) => setRequestPrivacy(e.target.checked)}
            className="corr-checkbox"
          />
          <span>
            <strong>Request privacy.</strong> By default, submissions (except your email)
            appear in the public corrections log below. Check this box to keep your
            submission private. Your contact details are never publicly displayed either way.
          </span>
        </label>
      </div>

      <button type="submit" disabled={isPending} className="corr-submit">
        {isPending ? "Submitting…" : "Submit correction"}
      </button>
    </form>
  );
}
