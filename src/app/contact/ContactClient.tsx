"use client";

import { useId, useState } from "react";
import Link from "next/link";

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

function SuccessPanel({ onReset }: { onReset: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        border: "1px solid var(--color-card-border)",
        background: "var(--color-card-bg)",
        borderRadius: "var(--radius-sm)",
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
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

function InfoTile({ label, body }: { label: string; body: React.ReactNode }) {
  return (
    <div className="cv-card">
      <div style={monoLabel}>{label}</div>
      <p style={{ ...monoBody, margin: "10px 0 0" }}>{body}</p>
    </div>
  );
}

export default function ContactClient() {
  const [values, setValues] = useState<FormValues>({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<FormState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

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

  const subjectChip = (value: string, label: string) => {
    const active = values.subject === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setSubject(value)}
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
        <div style={monoLabel}>Contact</div>
        <h1 className="page-heading" style={{ marginTop: 16, fontSize: "var(--text-52)" }}>Dispatch desk</h1>
        <p style={{ ...monoBody, margin: "16px auto 0", maxWidth: 560 }}>
          Story tips, data corrections, partnerships, press. Pick a category, send a note — a human on the editorial team will read it.
        </p>
      </div>

      <div
        style={{
          marginTop: 48,
          border: "1px solid var(--color-card-border)",
          background: "var(--color-card-bg)",
          borderRadius: "var(--radius-sm)",
          padding: 32,
        }}
      >
        {state === "success" ? (
          <SuccessPanel onReset={reset} />
        ) : (
          <form onSubmit={submit} noValidate>
            <div>
              <div style={monoLabel}>Category</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {SUBJECTS.map((s) => subjectChip(s.value, s.label))}
              </div>
              {errors.subject && <div style={errorText}>{errors.subject}</div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }} className="contact-b__row">
              <div>
                <FieldLabel htmlFor={nameId} required>Name</FieldLabel>
                <input id={nameId} type="text" value={values.name} onChange={handleChange("name")} style={fieldBase} aria-invalid={!!errors.name} />
                {errors.name && <div style={errorText}>{errors.name}</div>}
              </div>
              <div>
                <FieldLabel htmlFor={emailId} required>Email</FieldLabel>
                <input id={emailId} type="email" value={values.email} onChange={handleChange("email")} style={fieldBase} aria-invalid={!!errors.email} />
                {errors.email && <div style={errorText}>{errors.email}</div>}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <FieldLabel htmlFor={messageId} required>Message</FieldLabel>
              <textarea id={messageId} value={values.message} onChange={handleChange("message")} style={{ ...fieldBase, minHeight: 160, resize: "vertical" }} aria-invalid={!!errors.message} />
              {errors.message && <div style={errorText}>{errors.message}</div>}
            </div>

            {state === "error" && serverError && (
              <div
                role="alert"
                style={{
                  marginTop: 20,
                  padding: "10px 12px",
                  borderLeft: "2px solid #E06C6C",
                  background: "rgba(224, 108, 108, 0.08)",
                  ...monoBody,
                  color: "#E06C6C",
                }}
              >
                {serverError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, flexWrap: "wrap", gap: 12 }}>
              <span style={{ ...monoLabel, color: "var(--color-text-25)" }}>* required</span>
              <button type="submit" disabled={state === "submitting"} style={buttonPrimary}>
                {state === "submitting" ? "Sending…" : "Send message"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div
        style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        className="contact-b__tiles"
      >
        <InfoTile
          label="SLA · Response"
          body={<>We usually reply within <strong style={{ color: "var(--color-text-85)" }}>3 business days</strong>.</>}
        />
        <InfoTile
          label="Dispatch · Mailing"
          body={<>Civica Editors<br/>1180 Brickell Ave · Suite 2100<br/>Miami, FL 33131</>}
        />
        <InfoTile
          label="Developers · API"
          body={<>Use the open <Link href="/api-docs" style={{ color: "var(--color-accent)" }}>public API</Link> — no auth required.</>}
        />
        <InfoTile
          label="Bugs · GitHub"
          body={
            <>
              <a
                href="https://github.com/civicaatlas/civica/issues"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--color-accent)" }}
              >
                Open a ticket on GitHub
              </a>{" "}
              with the URL and a screenshot.
            </>
          }
        />
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
