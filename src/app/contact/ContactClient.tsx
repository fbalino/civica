"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { StatusDot } from "@/components/editorial/StatusDot";

const SUBJECTS = [
  { value: "Data correction", label: "Data correction" },
  { value: "Story tip", label: "Story tip" },
  { value: "Partnership", label: "Partnership" },
  { value: "Press", label: "Press" },
  { value: "Other", label: "Other" },
] as const;

type FormState = "idle" | "submitting" | "success" | "error";

interface FormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Required";
  if (!values.email.trim()) {
    errors.email = "Required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email";
  }
  if (!values.subject) errors.subject = "Pick a category";
  if (!values.message.trim()) {
    errors.message = "Required";
  } else if (values.message.trim().length < 10) {
    errors.message = "At least 10 characters";
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

function SuccessPanel({ onReset }: { onReset: () => void }) {
  return (
    <div className="contact-card" role="status" aria-live="polite">
      <div className="contact-success-head">
        <StatusDot state="active" label="Editors are responding" />
        <span className="contact-success-eyebrow">Message received</span>
      </div>
      <h2 className="contact-success-title">Thanks &mdash; we&rsquo;ve got it.</h2>
      <p className="contact-success-body">
        The editors usually reply within <strong>3 business days</strong>. For
        urgent data corrections, open an issue on GitHub.
      </p>
      <Button variant="secondary" size="sm" onClick={onReset}>
        Send another
      </Button>
    </div>
  );
}

function InfoTile({ label, body }: { label: string; body: React.ReactNode }) {
  return (
    <div className="cv-card">
      <div className="contact-tile-label">{label}</div>
      <p className="contact-tile-body">{body}</p>
    </div>
  );
}

export default function ContactClient() {
  const [values, setValues] = useState<FormValues>({ name: "", email: "", subject: "", message: "" });
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
  const messageId = useId();

  const handleChange =
    (field: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const setSubject = (value: string) => {
    setValues((prev) => ({ ...prev, subject: value }));
    if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }));
  };

  const reset = () => {
    setValues({ name: "", email: "", subject: "", message: "" });
    setErrors({});
    setServerError(null);
    setState("idle");
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
      const res = await fetch("/api/contact", {
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
        throw new Error("Too many submissions. Please wait a few minutes.");
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
          Contact
        </>
      }
      title="Dispatch desk"
    >
      <section className="editorial-section">
        <p className="editorial-page-subtitle">
          Story tips, data corrections, partnerships, press. Pick a category and
          send a note &mdash; a human on the editorial team will read it.
        </p>
      </section>

      <section className="editorial-section">
        {state === "success" ? (
          <SuccessPanel onReset={reset} />
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
              <label htmlFor="contact-website">
                Leave this field empty
                <input
                  id="contact-website"
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

            <div className="contact-field">
              <span className="contact-label" id="contact-category-label">
                Category
              </span>
              <div
                className="contact-chip-group"
                role="group"
                aria-labelledby="contact-category-label"
                aria-describedby={errors.subject ? "contact-subject-error" : undefined}
              >
                {SUBJECTS.map((s) => {
                  const active = values.subject === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSubject(s.value)}
                      aria-pressed={active}
                      className={`editorial-chip contact-chip${active ? " editorial-chip--accent" : ""}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {errors.subject && (
                <div className="contact-error" id="contact-subject-error">{errors.subject}</div>
              )}
            </div>

            <div className="contact-field contact-row">
              <div>
                <FieldLabel htmlFor={nameId} required>
                  Name
                </FieldLabel>
                <input
                  id={nameId}
                  type="text"
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
                  value={values.email}
                  onChange={handleChange("email")}
                  className="contact-input"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? `${emailId}-error` : undefined}
                />
                {errors.email && <div className="contact-error" id={`${emailId}-error`}>{errors.email}</div>}
              </div>
            </div>

            <div className="contact-field">
              <FieldLabel htmlFor={messageId} required>
                Message
              </FieldLabel>
              <textarea
                id={messageId}
                value={values.message}
                onChange={handleChange("message")}
                className="contact-textarea"
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? `${messageId}-error` : undefined}
              />
              {errors.message && (
                <div className="contact-error" id={`${messageId}-error`}>{errors.message}</div>
              )}
            </div>

            {state === "error" && serverError && (
              <div role="alert" className="contact-alert">
                <Banner variant="danger">{serverError}</Banner>
              </div>
            )}

            <div className="contact-form-foot">
              <span className="contact-required-hint">* required</span>
              <Button
                type="submit"
                variant="primary"
                loading={state === "submitting"}
                disabled={state === "submitting"}
              >
                {state === "submitting" ? "Sending…" : "Send message"}
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="editorial-section">
        <div className="contact-tiles">
          <InfoTile
            label="SLA · Response"
            body={
              <>
                We usually reply within <strong>3 business days</strong>.
              </>
            }
          />
          <InfoTile
            label="Developers · API"
            body={
              <>
                Use the open <Link href="/api-docs">public API</Link> &mdash; no auth
                required.
              </>
            }
          />
          <InfoTile
            label="Bugs · GitHub"
            body={
              <>
                <a
                  href="https://github.com/fbalino/civica/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open a ticket on GitHub
                </a>{" "}
                with the URL and a screenshot.
              </>
            }
          />
        </div>
      </section>
    </EditorialPage>
  );
}
