"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { StatusDot } from "@/components/editorial/StatusDot";
import {
  ADVISORY_APPLICATION_LIMITS,
  ADVISORY_APPLICATION_POLICY,
  validateAdvisoryApplication,
  type AdvisoryApplicationErrors,
  type AdvisoryApplicationField,
  type AdvisoryApplicationInput,
} from "@/lib/research/advisory-application";

type FormState = "idle" | "submitting" | "success" | "error";

const EMPTY: AdvisoryApplicationInput = {
  name: "",
  email: "",
  institution: "",
  role: "",
  expertiseArea: "",
  experience: "",
  links: "",
  cvUrl: "",
  consent: false,
};

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="contact-label">
      {children}
      {required ? <span className="contact-label__required">*</span> : null}
    </label>
  );
}

function SuccessPanel() {
  return (
    <div className="contact-card" role="status" aria-live="polite">
      <div className="contact-success-head">
        <StatusDot state="active" label="Application received" />
        <span className="contact-success-eyebrow">Application received</span>
      </div>
      <h2 className="contact-success-title">
        Thanks &mdash; your application is in.
      </h2>
      <p className="contact-success-body">
        This page is your receipt; no confirmation email is sent. Fernando
        Balino reviews applications and may write when follow-up is useful.
        Submission does not guarantee a reply, appointment, or review assignment.
      </p>
      <Button variant="secondary" size="sm" href="/about/advisory-board">
        Back to the advisory board
      </Button>
    </div>
  );
}

export default function ApplyClient() {
  const [values, setValues] = useState<AdvisoryApplicationInput>(EMPTY);
  const [errors, setErrors] = useState<AdvisoryApplicationErrors>({});
  const [state, setState] = useState<FormState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  // Honeypot: a real, visually-hidden field a human never sees or fills, but a
  // dumb bot autocompletes. Its value is sent to the API, which silently drops
  // any submission where it's non-empty. Bound to state so it actually carries
  // a value (previously a hardcoded "", which made the trap a no-op).
  const [trap, setTrap] = useState("");

  const nameId = useId();
  const emailId = useId();
  const institutionId = useId();
  const roleId = useId();
  const expertiseId = useId();
  const experienceId = useId();
  const linksId = useId();
  const cvUrlId = useId();
  const consentId = useId();

  const handleChange =
    (field: Exclude<AdvisoryApplicationField, "consent">) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateAdvisoryApplication(values);
    if (Object.keys(next).length) {
      setErrors(next);
      setState("idle");
      return;
    }
    setState("submitting");
    setServerError(null);
    try {
      const res = await fetch("/api/advisory-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          privacyNoticeVersion: ADVISORY_APPLICATION_POLICY.schemaVersion,
          _trap: trap,
        }),
      });
      if (res.status === 201) {
        setState("success");
      } else if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        setErrors(data.errors ?? {});
        setState("idle");
      } else if (res.status === 429) {
        throw new Error("Too many applications. Please wait a few minutes.");
      } else {
        throw new Error("Something went wrong. Please try again later.");
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Network error.");
      setState("error");
    }
  };

  return (
    <EditorialPage
      breadcrumbs={
        <>
          <Link href="/about">About</Link>
          <span>/</span>
          <Link href="/about/advisory-board">Advisory board</Link>
          <span>/</span>
          Apply
        </>
      }
      title="Apply to the advisory board"
    >
      <section className="editorial-section">
        <p className="editorial-page-subtitle">
          Civica Atlas accepts private expressions of interest across the five
          charter areas: governance measurement, political event data,
          research-data curation, data-heavy accessibility, and source rights.
          Fernando Balino reads each application. Applying is not an appointment,
          a review, or an endorsement.
        </p>
        <p>
          Read the <Link href="/about/advisory-board">board charter</Link> before
          applying. It explains the advisory-only remit, expected workload,
          conflicts, compensation, confidentiality, and publication terms.
        </p>
      </section>

      <section className="editorial-section">
        {state === "success" ? (
          <SuccessPanel />
        ) : (
          <form className="contact-card" onSubmit={submit} noValidate>
            {/* Honeypot — visually hidden, off the tab order, hidden from AT.
                Humans never fill it; bots do, and the API drops those. */}
            <div aria-hidden="true" className="sr-only">
              <label htmlFor="advisory-website">
                Leave this field empty
                <input
                  id="advisory-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={trap}
                  onChange={(e) => setTrap(e.target.value)}
                />
              </label>
            </div>
            {Object.keys(errors).length > 0 ? (
              <div role="alert" className="contact-validation-summary">
                <Banner variant="danger">Review the highlighted fields before submitting.</Banner>
              </div>
            ) : null}
            <div className="contact-field contact-row">
              <div>
                <FieldLabel htmlFor={nameId} required>
                  Full name
                </FieldLabel>
                <input
                  id={nameId}
                  type="text"
                  required
                  autoComplete="name"
                  maxLength={ADVISORY_APPLICATION_LIMITS.name}
                  value={values.name}
                  onChange={handleChange("name")}
                  className="contact-input"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? `${nameId}-error` : undefined}
                />
                {errors.name && <div className="contact-error" id={`${nameId}-error`}>{errors.name}</div>}
              </div>
              <div>
                <FieldLabel htmlFor={emailId} required>
                  Email
                </FieldLabel>
                <input
                  id={emailId}
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={ADVISORY_APPLICATION_LIMITS.email}
                  value={values.email}
                  onChange={handleChange("email")}
                  className="contact-input"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? `${emailId}-error` : undefined}
                />
                {errors.email && (
                  <div className="contact-error" id={`${emailId}-error`}>{errors.email}</div>
                )}
              </div>
            </div>

            <div className="contact-field contact-row">
              <div>
                <FieldLabel htmlFor={institutionId} required>
                  Institution or affiliation
                </FieldLabel>
                <input
                  id={institutionId}
                  type="text"
                  required
                  autoComplete="organization"
                  maxLength={ADVISORY_APPLICATION_LIMITS.institution}
                  placeholder="Institution or Independent"
                  value={values.institution}
                  onChange={handleChange("institution")}
                  className="contact-input"
                  aria-invalid={!!errors.institution}
                  aria-describedby={errors.institution ? `${institutionId}-error` : undefined}
                />
                {errors.institution && (
                  <div className="contact-error" id={`${institutionId}-error`}>{errors.institution}</div>
                )}
              </div>
              <div>
                <FieldLabel htmlFor={roleId} required>
                  Role or title
                </FieldLabel>
                <input
                  id={roleId}
                  type="text"
                  required
                  autoComplete="organization-title"
                  maxLength={ADVISORY_APPLICATION_LIMITS.role}
                  placeholder="e.g. Associate Professor of Political Science"
                  value={values.role}
                  onChange={handleChange("role")}
                  className="contact-input"
                  aria-invalid={!!errors.role}
                  aria-describedby={errors.role ? `${roleId}-error` : undefined}
                />
                {errors.role && <div className="contact-error" id={`${roleId}-error`}>{errors.role}</div>}
              </div>
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={expertiseId} required>
                Primary area of expertise
              </FieldLabel>
              <input
                id={expertiseId}
                type="text"
                required
                placeholder="e.g. Political event data · Accessibility · Source rights"
                maxLength={ADVISORY_APPLICATION_LIMITS.expertiseArea}
                value={values.expertiseArea}
                onChange={handleChange("expertiseArea")}
                className="contact-input"
                aria-invalid={!!errors.expertiseArea}
                aria-describedby={errors.expertiseArea ? `${expertiseId}-error` : undefined}
              />
              {errors.expertiseArea && (
                <div className="contact-error" id={`${expertiseId}-error`}>{errors.expertiseArea}</div>
              )}
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={experienceId} required>
                Relevant experience
              </FieldLabel>
              <textarea
                id={experienceId}
                required
                placeholder="Describe the experience you would bring to the charter area you named and why Civica's work interests you."
                minLength={ADVISORY_APPLICATION_LIMITS.experienceMin}
                maxLength={ADVISORY_APPLICATION_LIMITS.experienceMax}
                value={values.experience}
                onChange={handleChange("experience")}
                className="contact-textarea"
                aria-invalid={!!errors.experience}
                aria-describedby={errors.experience ? `${experienceId}-error` : undefined}
              />
              {errors.experience && (
                <div className="contact-error" id={`${experienceId}-error`}>{errors.experience}</div>
              )}
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={linksId}>
                Relevant links
              </FieldLabel>
              <textarea
                id={linksId}
                placeholder="Publications, Google Scholar, ORCID, LinkedIn — one per line."
                maxLength={ADVISORY_APPLICATION_LIMITS.links}
                value={values.links}
                onChange={handleChange("links")}
                className="contact-textarea contact-textarea--compact"
                aria-invalid={!!errors.links}
                aria-describedby={errors.links ? `${linksId}-error` : undefined}
              />
              {errors.links && <div className="contact-error" id={`${linksId}-error`}>{errors.links}</div>}
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={cvUrlId}>CV link</FieldLabel>
              <input
                id={cvUrlId}
                type="url"
                inputMode="url"
                placeholder="https:// — a link to your CV, scholar page, or personal site"
                maxLength={ADVISORY_APPLICATION_LIMITS.cvUrl}
                value={values.cvUrl}
                onChange={handleChange("cvUrl")}
                className="contact-input"
                aria-invalid={!!errors.cvUrl}
                aria-describedby={errors.cvUrl ? `${cvUrlId}-error` : undefined}
              />
              {errors.cvUrl && <div className="contact-error" id={`${cvUrlId}-error`}>{errors.cvUrl}</div>}
              <p className="contact-field-hint">
                We accept a link rather than a file upload. Paste a CV link, a
                Google Scholar profile, or your institutional page.
              </p>
            </div>

            {state === "error" && serverError && (
              <div role="alert" className="contact-alert">
                <Banner variant="danger">{serverError}</Banner>
              </div>
            )}

            <div className="contact-privacy-box">
              <h2 className="contact-privacy-title">Application privacy</h2>
              <p>{ADVISORY_APPLICATION_POLICY.purpose}</p>
              <ul>
                <li><strong>Fields:</strong> {ADVISORY_APPLICATION_POLICY.collectedFields.join(", ")}.</li>
                <li><strong>Access:</strong> {ADVISORY_APPLICATION_POLICY.access}</li>
                <li><strong>Retention:</strong> {ADVISORY_APPLICATION_POLICY.retention}</li>
                <li><strong>Deletion:</strong> {ADVISORY_APPLICATION_POLICY.deletion}</li>
                <li><strong>Security:</strong> {ADVISORY_APPLICATION_POLICY.security}</li>
                <li><strong>Response:</strong> {ADVISORY_APPLICATION_POLICY.response}</li>
              </ul>
              <p>
                Full details are in the <Link href="/privacy#applications">privacy notice</Link>. Policy version {ADVISORY_APPLICATION_POLICY.schemaVersion}, effective {ADVISORY_APPLICATION_POLICY.effectiveOn}.
              </p>
              <label className="contact-consent" htmlFor={consentId}>
                <input
                  id={consentId}
                  type="checkbox"
                  required
                  checked={values.consent}
                  onChange={(event) => {
                    setValues((previous) => ({ ...previous, consent: event.target.checked }));
                    if (errors.consent) setErrors((previous) => ({ ...previous, consent: undefined }));
                  }}
                  aria-invalid={!!errors.consent}
                  aria-describedby={errors.consent ? `${consentId}-error` : undefined}
                />
                <span>I have read these terms and consent to this processing for my application.</span>
              </label>
              {errors.consent ? <div className="contact-error" id={`${consentId}-error`}>{errors.consent}</div> : null}
            </div>

            <div className="contact-form-foot">
              <span className="contact-required-hint">* required</span>
              <Button
                type="submit"
                variant="primary"
                loading={state === "submitting"}
                disabled={state === "submitting"}
              >
                {state === "submitting" ? "Sending…" : "Submit application"}
              </Button>
            </div>
          </form>
        )}
      </section>
    </EditorialPage>
  );
}
