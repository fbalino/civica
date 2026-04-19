"use client";

import { Suspense, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";

type Variant = "BASELINE" | "A" | "B" | "C";

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

function usePrototypeForm(initialState: FormState, initialServerError: string | null) {
  const [values, setValues] = useState<FormValues>({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<FormState>(initialState);
  const [serverError, setServerError] = useState<string | null>(initialServerError);

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
        body: JSON.stringify({ ...values, _trap: "" }),
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

  const reset = () => {
    setValues({ name: "", email: "", subject: "", message: "" });
    setErrors({});
    setServerError(null);
    setState("idle");
  };

  return { values, errors, state, serverError, handleChange, setSubject, submit, reset };
}

const monoLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
  fontSize: "var(--text-10)",
  letterSpacing: "var(--tracking-caps)",
  textTransform: "uppercase",
  color: "var(--color-text-30)",
};

const monoBody: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
  fontSize: "var(--text-13)",
  color: "var(--color-text-50)",
  lineHeight: "var(--leading-relaxed)",
};

const fieldBase: React.CSSProperties = {
  width: "100%",
  background: "var(--color-select-bg)",
  border: "1px solid var(--color-card-border)",
  borderRadius: "var(--radius-sm)",
  padding: "10px 12px",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-14)",
  lineHeight: "var(--leading-normal)",
  outline: "none",
};

const errorText: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
  fontSize: "var(--text-11)",
  color: "#E06C6C",
  marginTop: 6,
  letterSpacing: "var(--tracking-wide)",
};

const buttonPrimary: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  fontSize: "var(--text-12)",
  letterSpacing: "var(--tracking-caps)",
  textTransform: "uppercase",
  padding: "12px 20px",
  background: "var(--color-accent)",
  color: "#0C0C0B",
  border: "none",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
};

function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} style={{ ...monoLabel, display: "block", marginBottom: 8 }}>
      {children}
      {required ? <span style={{ color: "var(--color-accent)", marginLeft: 4 }}>*</span> : null}
    </label>
  );
}

function SuccessPanel({ onReset, tone = "card" }: { onReset: () => void; tone?: "card" | "inline" }) {
  const container: React.CSSProperties =
    tone === "card"
      ? {
          border: "1px solid var(--color-card-border)",
          background: "var(--color-card-bg)",
          borderRadius: "var(--radius-sm)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }
      : {
          borderLeft: "2px solid var(--color-accent)",
          paddingLeft: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        };
  return (
    <div style={container} role="status" aria-live="polite">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-source-live)" }} aria-hidden />
        <span style={monoLabel}>Message received</span>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-24)",
          fontWeight: 400,
          letterSpacing: "var(--tracking-tight)",
          margin: 0,
          color: "var(--color-text-primary)",
        }}
      >
        Thanks — we&rsquo;ve got it.
      </h3>
      <p style={{ ...monoBody, margin: 0 }}>
        The editors usually reply within <strong style={{ color: "var(--color-text-85)" }}>3 business days</strong>.
        For urgent data corrections, open an issue on GitHub.
      </p>
      <button
        type="button"
        onClick={onReset}
        style={{
          alignSelf: "flex-start",
          marginTop: 6,
          background: "transparent",
          border: "1px solid var(--color-card-border)",
          color: "var(--color-text-60)",
          padding: "8px 14px",
          borderRadius: "var(--radius-sm)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-11)",
          letterSpacing: "var(--tracking-caps)",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        Send another
      </button>
    </div>
  );
}

function InfoRailItems() {
  return (
    <>
      <div>
        <div style={monoLabel}>Response time</div>
        <p style={{ ...monoBody, margin: "8px 0 0" }}>
          We usually reply within <strong style={{ color: "var(--color-text-85)" }}>3 business days</strong>. Urgent data corrections get triaged first.
        </p>
      </div>
      <div>
        <div style={monoLabel}>Editorial mailing</div>
        <p style={{ ...monoBody, margin: "8px 0 0" }}>
          Civica Editors
          <br />
          1180 Brickell Ave · Suite 2100
          <br />
          Miami, FL 33131 · USA
        </p>
      </div>
      <div>
        <div style={monoLabel}>For developers</div>
        <p style={{ ...monoBody, margin: "8px 0 0" }}>
          Every country and ranking is available through the{" "}
          <Link href="/api-docs" style={{ color: "var(--color-accent)" }}>public API</Link>{" "}
          — no auth, CC0 data.
        </p>
      </div>
      <div>
        <div style={monoLabel}>Found a bug?</div>
        <p style={{ ...monoBody, margin: "8px 0 0" }}>
          File it on{" "}
          <a href="https://github.com/civicaatlas/civica/issues" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)" }}>
            GitHub issues
          </a>
          . Include the country, URL, and a screenshot if possible.
        </p>
      </div>
    </>
  );
}

/* ============================================================
   Baseline — existing production layout (form + sidebar cards)
   ============================================================ */

function BaselineVariant() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <div style={monoLabel}>Contact · Baseline</div>
      <h1 className="page-heading" style={{ marginTop: 10, marginBottom: 10 }}>
        Contact the editors
      </h1>
      <p style={{ ...monoBody, marginBottom: 8 }}>
        Story tips, data corrections, partnership or press inquiries — we read everything.
      </p>
      <div style={{ width: 40, height: 2, background: "var(--color-accent)", borderRadius: 1, marginBottom: 48 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 48 }} className="contact-layout">
        <div style={{ minWidth: 0 }}>
          <ContactForm />
        </div>
        <aside>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="cv-card">
              <p style={monoLabel}>Response time</p>
              <p style={{ ...monoBody, margin: "8px 0 0" }}>
                We usually reply within 3 business days. For urgent corrections to live data, include the country name and field in the subject line.
              </p>
            </div>
            <div className="cv-card">
              <p style={monoLabel}>What we reply to</p>
              <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  "Data corrections & source disputes",
                  "Story tips & editorial suggestions",
                  "Partnership & integration inquiries",
                  "Press & media requests",
                  "General feedback",
                ].map((item) => (
                  <li key={item} style={{ display: "flex", gap: 8, ...monoBody, fontSize: "var(--text-12)" }}>
                    <span style={{ color: "var(--color-accent)", flexShrink: 0 }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="cv-card">
              <p style={monoLabel}>Developer resources</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                <Link href="/api-docs" style={{ ...monoBody, fontSize: "var(--text-12)", color: "var(--color-accent)" }}>
                  Public API reference →
                </Link>
                <a
                  href="https://github.com/civicaatlas/civica/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...monoBody, fontSize: "var(--text-12)", color: "var(--color-accent)" }}
                >
                  GitHub Issues — bug reports →
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .contact-layout { grid-template-columns: 1fr 320px !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Variant A — Editorial split (form + side rail)
   ============================================================ */

function VariantA({ preview }: { preview: FormState }) {
  const form = usePrototypeForm(preview, preview === "error" ? "Preview: server error state." : null);
  const nameId = useId();
  const emailId = useId();
  const subjectId = useId();
  const messageId = useId();

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <div style={monoLabel}>Contact · Variant A — Editorial split</div>
      <h1 className="page-heading" style={{ marginTop: 12 }}>Contact the editors</h1>
      <div style={{ width: 40, height: 2, background: "var(--color-accent)", borderRadius: 1, margin: "16px 0 24px" }} />
      <p style={{ ...monoBody, maxWidth: 640 }}>
        Tips, corrections, partnerships, or press — this is where they come in. Every message lands in the editors&rsquo; inbox and is read by a human.
      </p>

      <div
        className="contact-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
          gap: 48,
          marginTop: 48,
          alignItems: "start",
        }}
      >
        <div>
          {form.state === "success" ? (
            <SuccessPanel onReset={form.reset} />
          ) : (
            <form onSubmit={form.submit} noValidate>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="contact-grid__row">
                <div>
                  <FieldLabel htmlFor={nameId} required>Name</FieldLabel>
                  <input id={nameId} type="text" value={form.values.name} onChange={form.handleChange("name")} style={fieldBase} aria-invalid={!!form.errors.name} />
                  {form.errors.name && <div style={errorText}>{form.errors.name}</div>}
                </div>
                <div>
                  <FieldLabel htmlFor={emailId} required>Email</FieldLabel>
                  <input id={emailId} type="email" value={form.values.email} onChange={form.handleChange("email")} style={fieldBase} aria-invalid={!!form.errors.email} />
                  {form.errors.email && <div style={errorText}>{form.errors.email}</div>}
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <FieldLabel htmlFor={subjectId} required>Subject</FieldLabel>
                <select id={subjectId} value={form.values.subject} onChange={form.handleChange("subject")} style={{ ...fieldBase, appearance: "none" }} aria-invalid={!!form.errors.subject}>
                  <option value="">Pick a category&hellip;</option>
                  {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {form.errors.subject && <div style={errorText}>{form.errors.subject}</div>}
              </div>
              <div style={{ marginTop: 20 }}>
                <FieldLabel htmlFor={messageId} required>Message</FieldLabel>
                <textarea id={messageId} value={form.values.message} onChange={form.handleChange("message")} style={{ ...fieldBase, minHeight: 180, resize: "vertical" }} aria-invalid={!!form.errors.message} />
                {form.errors.message && <div style={errorText}>{form.errors.message}</div>}
              </div>

              {form.state === "error" && form.serverError && (
                <div role="alert" style={{ marginTop: 20, padding: "10px 12px", borderLeft: "2px solid #E06C6C", background: "rgba(224, 108, 108, 0.08)", ...monoBody, color: "#E06C6C" }}>
                  {form.serverError}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28 }}>
                <button type="submit" disabled={form.state === "submitting"} style={buttonPrimary}>
                  {form.state === "submitting" ? "Sending…" : "Send message"}
                </button>
                <span style={{ ...monoLabel, color: "var(--color-text-25)" }}>* required</span>
              </div>
            </form>
          )}
        </div>

        <aside
          style={{ display: "flex", flexDirection: "column", gap: 28, paddingLeft: 28, borderLeft: "1px solid var(--color-divider)" }}
          className="contact-rail"
        >
          <InfoRailItems />
        </aside>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .contact-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .contact-rail { border-left: none !important; padding-left: 0 !important; border-top: 1px solid var(--color-divider); padding-top: 28px !important; }
          .contact-grid__row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Variant B — Dispatch desk (centered + subject chips + tiles)
   ============================================================ */

function InfoTile({ label, body }: { label: string; body: React.ReactNode }) {
  return (
    <div className="cv-card">
      <div style={monoLabel}>{label}</div>
      <p style={{ ...monoBody, margin: "10px 0 0" }}>{body}</p>
    </div>
  );
}

function VariantB({ preview }: { preview: FormState }) {
  const form = usePrototypeForm(preview, preview === "error" ? "Preview: server error state." : null);
  const nameId = useId();
  const emailId = useId();
  const messageId = useId();

  const subjectChip = (value: string, label: string) => {
    const active = form.values.subject === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => form.setSubject(value)}
        aria-pressed={active}
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
          fontSize: "var(--text-11)",
          letterSpacing: "var(--tracking-wide)",
          padding: "8px 14px",
          borderRadius: 999,
          border: `1px solid ${active ? "var(--color-accent)" : "var(--color-card-border)"}`,
          background: active ? "rgba(212, 160, 74, 0.14)" : "transparent",
          color: active ? "var(--color-accent)" : "var(--color-text-60)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--spacing-section-y) var(--spacing-page-x)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={monoLabel}>Contact · Variant B — Dispatch desk</div>
        <h1 className="page-heading" style={{ marginTop: 16, fontSize: "var(--text-52)" }}>Dispatch desk</h1>
        <p style={{ ...monoBody, margin: "16px auto 0", maxWidth: 560 }}>
          Story tips, data corrections, partnerships, press. Pick a category, send a note — a human on the editorial team will read it.
        </p>
      </div>

      <div style={{ marginTop: 48, border: "1px solid var(--color-card-border)", background: "var(--color-card-bg)", borderRadius: "var(--radius-sm)", padding: 32 }}>
        {form.state === "success" ? (
          <SuccessPanel onReset={form.reset} />
        ) : (
          <form onSubmit={form.submit} noValidate>
            <div>
              <div style={monoLabel}>Category</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {SUBJECTS.map((s) => subjectChip(s.value, s.label))}
              </div>
              {form.errors.subject && <div style={errorText}>{form.errors.subject}</div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }} className="contact-b__row">
              <div>
                <FieldLabel htmlFor={nameId} required>Name</FieldLabel>
                <input id={nameId} type="text" value={form.values.name} onChange={form.handleChange("name")} style={fieldBase} aria-invalid={!!form.errors.name} />
                {form.errors.name && <div style={errorText}>{form.errors.name}</div>}
              </div>
              <div>
                <FieldLabel htmlFor={emailId} required>Email</FieldLabel>
                <input id={emailId} type="email" value={form.values.email} onChange={form.handleChange("email")} style={fieldBase} aria-invalid={!!form.errors.email} />
                {form.errors.email && <div style={errorText}>{form.errors.email}</div>}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <FieldLabel htmlFor={messageId} required>Message</FieldLabel>
              <textarea id={messageId} value={form.values.message} onChange={form.handleChange("message")} style={{ ...fieldBase, minHeight: 160, resize: "vertical" }} aria-invalid={!!form.errors.message} />
              {form.errors.message && <div style={errorText}>{form.errors.message}</div>}
            </div>

            {form.state === "error" && form.serverError && (
              <div role="alert" style={{ marginTop: 20, padding: "10px 12px", borderLeft: "2px solid #E06C6C", background: "rgba(224, 108, 108, 0.08)", ...monoBody, color: "#E06C6C" }}>
                {form.serverError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, flexWrap: "wrap", gap: 12 }}>
              <span style={{ ...monoLabel, color: "var(--color-text-25)" }}>* required</span>
              <button type="submit" disabled={form.state === "submitting"} style={buttonPrimary}>
                {form.state === "submitting" ? "Sending…" : "Send message"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="contact-b__tiles">
        <InfoTile label="SLA · Response" body={<>We usually reply within <strong style={{ color: "var(--color-text-85)" }}>3 business days</strong>.</>} />
        <InfoTile label="Dispatch · Mailing" body={<>Civica Editors<br/>1180 Brickell Ave · Suite 2100<br/>Miami, FL 33131</>} />
        <InfoTile label="Developers · API" body={<>Use the open <Link href="/api-docs" style={{ color: "var(--color-accent)" }}>public API</Link> — no auth required.</>} />
        <InfoTile label="Bugs · GitHub" body={<><a href="https://github.com/civicaatlas/civica/issues" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)" }}>Open a ticket on GitHub</a> with the URL and a screenshot.</>} />
      </div>

      <style>{`
        @media (max-width: 640px) {
          .contact-b__row { grid-template-columns: 1fr !important; }
          .contact-b__tiles { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Variant C — Atlas index (numbered rows, editorial hero)
   ============================================================ */

function VariantC({ preview }: { preview: FormState }) {
  const form = usePrototypeForm(preview, preview === "error" ? "Preview: server error state." : null);
  const nameId = useId();
  const emailId = useId();
  const subjectId = useId();
  const messageId = useId();

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "200px 1fr",
    gap: 24,
    padding: "20px 0",
    borderBottom: "1px solid var(--color-divider)",
    alignItems: "start",
  };

  const underlineField: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid var(--color-card-border)",
    padding: "8px 0",
    color: "var(--color-text-primary)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-16)",
    outline: "none",
  };

  return (
    <div style={{ maxWidth: "var(--max-w-content)", margin: "0 auto", padding: "var(--spacing-section-y) var(--spacing-page-x)" }}>
      <div style={monoLabel}>Contact · Variant C — Atlas index</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 16, alignItems: "end" }} className="contact-c__hero">
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-64)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tighter)",
            lineHeight: "var(--leading-tight)",
            margin: 0,
            color: "var(--color-text-primary)",
          }}
        >
          Contact
          <br />
          <em style={{ color: "var(--color-accent)", fontStyle: "italic" }}>the editors.</em>
        </h1>
        <p style={{ ...monoBody, maxWidth: 420, paddingBottom: 12 }}>
          Civica is maintained by a small editorial team. Use this form for story tips, data corrections, partnerships, or press inquiries. A human reads every note.
        </p>
      </div>

      <div style={{ height: 2, background: "var(--color-accent)", width: 64, margin: "40px 0 0" }} />

      <div style={{ marginTop: 40 }}>
        {form.state === "success" ? (
          <SuccessPanel onReset={form.reset} tone="inline" />
        ) : (
          <form onSubmit={form.submit} noValidate className="contact-c__form">
            <div style={rowStyle}>
              <div>
                <div style={monoLabel}>01 · From</div>
                <p style={{ ...monoBody, margin: "8px 0 0", fontSize: "var(--text-11)" }}>Your name and reply-to email.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="contact-c__from">
                <div>
                  <label htmlFor={nameId} style={{ ...monoLabel, display: "block", marginBottom: 4 }}>Name *</label>
                  <input id={nameId} type="text" value={form.values.name} onChange={form.handleChange("name")} style={underlineField} aria-invalid={!!form.errors.name} />
                  {form.errors.name && <div style={errorText}>{form.errors.name}</div>}
                </div>
                <div>
                  <label htmlFor={emailId} style={{ ...monoLabel, display: "block", marginBottom: 4 }}>Email *</label>
                  <input id={emailId} type="email" value={form.values.email} onChange={form.handleChange("email")} style={underlineField} aria-invalid={!!form.errors.email} />
                  {form.errors.email && <div style={errorText}>{form.errors.email}</div>}
                </div>
              </div>
            </div>

            <div style={rowStyle}>
              <div>
                <div style={monoLabel}>02 · Category</div>
                <p style={{ ...monoBody, margin: "8px 0 0", fontSize: "var(--text-11)" }}>Helps us route your message.</p>
              </div>
              <div>
                <select id={subjectId} value={form.values.subject} onChange={form.handleChange("subject")} style={{ ...underlineField, appearance: "none", paddingRight: 24 }} aria-invalid={!!form.errors.subject}>
                  <option value="">Select a category…</option>
                  {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {form.errors.subject && <div style={errorText}>{form.errors.subject}</div>}
              </div>
            </div>

            <div style={rowStyle}>
              <div>
                <div style={monoLabel}>03 · Message</div>
                <p style={{ ...monoBody, margin: "8px 0 0", fontSize: "var(--text-11)" }}>Include links, sources, or screenshots where relevant.</p>
              </div>
              <div>
                <textarea id={messageId} value={form.values.message} onChange={form.handleChange("message")} style={{ ...underlineField, minHeight: 160, resize: "vertical" }} aria-invalid={!!form.errors.message} />
                {form.errors.message && <div style={errorText}>{form.errors.message}</div>}
              </div>
            </div>

            {form.state === "error" && form.serverError && (
              <div role="alert" style={{ marginTop: 20, padding: "10px 12px", borderLeft: "2px solid #E06C6C", background: "rgba(224, 108, 108, 0.08)", ...monoBody, color: "#E06C6C" }}>
                {form.serverError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
              <button type="submit" disabled={form.state === "submitting"} style={buttonPrimary}>
                {form.state === "submitting" ? "Transmitting…" : "Send to editors →"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div style={{ marginTop: 72, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 32, paddingTop: 32, borderTop: "1px solid var(--color-divider)" }} className="contact-c__footer">
        <div>
          <div style={monoLabel}>Response time</div>
          <p style={{ ...monoBody, margin: "10px 0 0" }}>~3 business days</p>
        </div>
        <div>
          <div style={monoLabel}>Editorial mail</div>
          <p style={{ ...monoBody, margin: "10px 0 0" }}>1180 Brickell Ave<br/>Suite 2100 · Miami, FL</p>
        </div>
        <div>
          <div style={monoLabel}>Developers</div>
          <p style={{ ...monoBody, margin: "10px 0 0" }}>
            <Link href="/api-docs" style={{ color: "var(--color-accent)" }}>Public API →</Link>
          </p>
        </div>
        <div>
          <div style={monoLabel}>Bugs</div>
          <p style={{ ...monoBody, margin: "10px 0 0" }}>
            <a href="https://github.com/civicaatlas/civica/issues" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)" }}>GitHub issues →</a>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .contact-c__hero { grid-template-columns: 1fr !important; align-items: start !important; }
          .contact-c__form > div { grid-template-columns: 1fr !important; }
          .contact-c__from { grid-template-columns: 1fr !important; }
          .contact-c__footer { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Switcher (only shown when ?contact= set, or always with marker)
   ============================================================ */

const VARIANT_LABELS: Record<Variant, string> = {
  BASELINE: "Baseline",
  A: "A — Split",
  B: "B — Desk",
  C: "C — Atlas",
};

function VariantSwitcher({ current }: { current: Variant }) {
  const variants: Variant[] = ["BASELINE", "A", "B", "C"];
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 0" }}>
      <div
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-card-border)",
          borderRadius: 999,
        }}
      >
        {variants.map((v) => {
          const active = v === current;
          const href = v === "BASELINE" ? "/contact" : `/contact?contact=${v}`;
          return (
            <Link
              key={v}
              href={href}
              prefetch={false}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-11)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                padding: "6px 14px",
                borderRadius: 999,
                textDecoration: "none",
                color: active ? "#0C0C0B" : "var(--color-text-50)",
                background: active ? "var(--color-accent)" : "transparent",
              }}
            >
              {VARIANT_LABELS[v]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ContactInner() {
  const params = useSearchParams();
  const raw = params.get("contact")?.toUpperCase();
  const variant: Variant = useMemo(() => {
    if (raw === "A" || raw === "B" || raw === "C") return raw;
    return "BASELINE";
  }, [raw]);
  const state = (params.get("state") || "").toLowerCase();
  const preview: FormState = state === "success" ? "success" : state === "error" ? "error" : "idle";

  return (
    <>
      <VariantSwitcher current={variant} />
      {variant === "BASELINE" && <BaselineVariant />}
      {variant === "A" && <VariantA preview={preview} />}
      {variant === "B" && <VariantB preview={preview} />}
      {variant === "C" && <VariantC preview={preview} />}
    </>
  );
}

export default function ContactClient() {
  return (
    <Suspense fallback={null}>
      <ContactInner />
    </Suspense>
  );
}
