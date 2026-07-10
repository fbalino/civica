"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { StatusDot } from "@/components/editorial/StatusDot";

type FormState = "idle" | "submitting" | "success" | "error";

interface FormValues {
  name: string;
  email: string;
  institution: string;
  role: string;
  expertiseArea: string;
  experience: string;
  links: string;
  cvUrl: string;
}

type FieldKey = keyof FormValues;
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY: FormValues = {
  name: "",
  email: "",
  institution: "",
  role: "",
  expertiseArea: "",
  experience: "",
  links: "",
  cvUrl: "",
};

const MIN_EXPERIENCE_LEN = 40;

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Required";
  if (!values.email.trim()) {
    errors.email = "Required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email";
  }
  if (!values.institution.trim()) errors.institution = "Required";
  if (!values.role.trim()) errors.role = "Required";
  if (!values.expertiseArea.trim()) errors.expertiseArea = "Required";
  if (!values.experience.trim()) {
    errors.experience = "Required";
  } else if (values.experience.trim().length < MIN_EXPERIENCE_LEN) {
    errors.experience = `At least ${MIN_EXPERIENCE_LEN} characters`;
  }
  if (values.cvUrl.trim() && !isValidHttpUrl(values.cvUrl.trim())) {
    errors.cvUrl = "Enter a link starting with http:// or https://";
  }
  return errors;
}

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
        We review advisory-board applications as recruitment proceeds and reach
        out by email when there&rsquo;s a fit. There&rsquo;s no need to apply
        again.
      </p>
      <Button variant="secondary" size="sm" href="/about/advisory-board">
        Back to the advisory board
      </Button>
    </div>
  );
}

export default function ApplyClient() {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
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

  const handleChange =
    (field: FieldKey) =>
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
    const next = validate(values);
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
        body: JSON.stringify({ ...values, _trap: trap }),
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
          Civica is collecting expressions of interest for a planned independent
          advisory board in governance measurement, political methodology, and
          comparative politics. No board review or endorsement has occurred yet.
          If that&rsquo;s your field, tell us about yourself &mdash; a human on
          the team reads every application.
        </p>
      </section>

      <section className="editorial-section">
        {state === "success" ? (
          <SuccessPanel />
        ) : (
          <form className="contact-card" onSubmit={submit} noValidate>
            {/* Honeypot — visually hidden, off the tab order, hidden from AT.
                Humans never fill it; bots do, and the API drops those. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
                whiteSpace: "nowrap",
              }}
            >
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
            <div className="contact-field contact-row">
              <div>
                <FieldLabel htmlFor={nameId} required>
                  Full name
                </FieldLabel>
                <input
                  id={nameId}
                  type="text"
                  autoComplete="name"
                  value={values.name}
                  onChange={handleChange("name")}
                  className="contact-input"
                  aria-invalid={!!errors.name}
                />
                {errors.name && <div className="contact-error">{errors.name}</div>}
              </div>
              <div>
                <FieldLabel htmlFor={emailId} required>
                  Email
                </FieldLabel>
                <input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={handleChange("email")}
                  className="contact-input"
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <div className="contact-error">{errors.email}</div>
                )}
              </div>
            </div>

            <div className="contact-field contact-row">
              <div>
                <FieldLabel htmlFor={institutionId} required>
                  Institution
                </FieldLabel>
                <input
                  id={institutionId}
                  type="text"
                  autoComplete="organization"
                  value={values.institution}
                  onChange={handleChange("institution")}
                  className="contact-input"
                  aria-invalid={!!errors.institution}
                />
                {errors.institution && (
                  <div className="contact-error">{errors.institution}</div>
                )}
              </div>
              <div>
                <FieldLabel htmlFor={roleId} required>
                  Role or title
                </FieldLabel>
                <input
                  id={roleId}
                  type="text"
                  autoComplete="organization-title"
                  placeholder="e.g. Associate Professor of Political Science"
                  value={values.role}
                  onChange={handleChange("role")}
                  className="contact-input"
                  aria-invalid={!!errors.role}
                />
                {errors.role && <div className="contact-error">{errors.role}</div>}
              </div>
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={expertiseId} required>
                Primary area of expertise
              </FieldLabel>
              <input
                id={expertiseId}
                type="text"
                placeholder="e.g. Governance measurement · Comparative politics · Political methodology"
                value={values.expertiseArea}
                onChange={handleChange("expertiseArea")}
                className="contact-input"
                aria-invalid={!!errors.expertiseArea}
              />
              {errors.expertiseArea && (
                <div className="contact-error">{errors.expertiseArea}</div>
              )}
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={experienceId} required>
                Relevant experience
              </FieldLabel>
              <textarea
                id={experienceId}
                placeholder="Your background in governance indices or comparative measurement, and why you'd like to review the Civica Index methodology."
                value={values.experience}
                onChange={handleChange("experience")}
                className="contact-textarea"
                aria-invalid={!!errors.experience}
              />
              {errors.experience && (
                <div className="contact-error">{errors.experience}</div>
              )}
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={linksId}>
                Relevant links
              </FieldLabel>
              <textarea
                id={linksId}
                placeholder="Publications, Google Scholar, ORCID, LinkedIn — one per line."
                value={values.links}
                onChange={handleChange("links")}
                className="contact-textarea"
                style={{ minHeight: "100px" }}
                aria-invalid={!!errors.links}
              />
              {errors.links && <div className="contact-error">{errors.links}</div>}
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={cvUrlId}>CV link</FieldLabel>
              <input
                id={cvUrlId}
                type="url"
                inputMode="url"
                placeholder="https:// — a link to your CV, scholar page, or personal site"
                value={values.cvUrl}
                onChange={handleChange("cvUrl")}
                className="contact-input"
                aria-invalid={!!errors.cvUrl}
              />
              {errors.cvUrl && <div className="contact-error">{errors.cvUrl}</div>}
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

            <p className="contact-field-hint contact-privacy-line">
              Applications are stored privately and read only by the Civica team
              for advisory-board review. See our{" "}
              <Link href="/privacy">privacy notice</Link> for how we handle your
              information.
            </p>

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
