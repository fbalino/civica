"use client";

import { useState } from "react";

const SUBJECT_OPTIONS = [
  { value: "", label: "Select a topic…" },
  { value: "Data correction", label: "Data correction" },
  { value: "Story tip", label: "Story tip" },
  { value: "Partnership", label: "Partnership" },
  { value: "Press", label: "Press" },
  { value: "Other", label: "Other" },
];

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const fieldStyle = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--color-card-bg)",
  border: "1px solid var(--color-card-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-14)",
  lineHeight: "var(--leading-normal)",
  outline: "none",
  transition: "border-color 0.15s ease",
} as const;

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontWeight: "var(--font-weight-mono)" as const,
  fontSize: "var(--text-11)",
  color: "var(--color-text-30)",
  letterSpacing: "var(--tracking-caps)",
  textTransform: "uppercase" as const,
  marginBottom: 6,
};

const errorStyle = {
  fontFamily: "var(--font-mono)",
  fontWeight: "var(--font-weight-mono)" as const,
  fontSize: "var(--text-11)",
  color: "var(--color-danger)",
  marginTop: 4,
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const clientErrors: FieldErrors = {};
    if (!form.name.trim()) clientErrors.name = "Name is required.";
    if (!form.email.trim()) clientErrors.email = "Email is required.";
    if (!form.subject) clientErrors.subject = "Please select a topic.";
    if (!form.message.trim()) clientErrors.message = "Message is required.";

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      const firstErrorField = Object.keys(clientErrors)[0];
      document.getElementById(`contact-${firstErrorField}`)?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, _trap: "" }),
      });

      if (res.status === 201) {
        setSubmitted(true);
      } else if (res.status === 422) {
        const data = await res.json();
        setErrors(data.errors ?? {});
      } else if (res.status === 429) {
        setServerError("Too many submissions. Please wait a few minutes before trying again.");
      } else {
        setServerError("Something went wrong. Please try again later.");
      }
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: "32px 28px",
          background: "var(--color-card-bg)",
          border: "1px solid var(--color-card-border)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--color-success)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-20)",
            fontWeight: 400,
            color: "var(--color-text-primary)",
            margin: "0 0 10px",
          }}
        >
          Message received
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-13)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-relaxed)",
            margin: 0,
          }}
        >
          Thank you for reaching out. We typically reply within 3 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Honeypot — hidden from humans, filled by bots */}
      <input
        type="text"
        name="_trap"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", borderWidth: 0 }}
        autoComplete="off"
      />

      <div>
        <label htmlFor="contact-name" style={labelStyle}>Name</label>
        <input
          id="contact-name"
          type="text"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "contact-name-error" : undefined}
          style={{
            ...fieldStyle,
            borderColor: errors.name ? "var(--color-danger)" : "var(--color-card-border)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = errors.name ? "var(--color-danger)" : "var(--color-card-border)"; }}
        />
        {errors.name && <p id="contact-name-error" style={errorStyle} role="alert">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="contact-email" style={labelStyle}>Email</label>
        <input
          id="contact-email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          autoComplete="email"
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
          style={{
            ...fieldStyle,
            borderColor: errors.email ? "var(--color-danger)" : "var(--color-card-border)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = errors.email ? "var(--color-danger)" : "var(--color-card-border)"; }}
        />
        {errors.email && <p id="contact-email-error" style={errorStyle} role="alert">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="contact-subject" style={labelStyle}>Topic</label>
        <div style={{ position: "relative" }}>
          <select
            id="contact-subject"
            value={form.subject}
            onChange={(e) => update("subject", e.target.value)}
            aria-required="true"
            aria-invalid={!!errors.subject}
            aria-describedby={errors.subject ? "contact-subject-error" : undefined}
            style={{
              ...fieldStyle,
              appearance: "none",
              WebkitAppearance: "none",
              background: "var(--color-select-bg)",
              borderColor: errors.subject ? "var(--color-danger)" : "var(--color-card-border)",
              paddingRight: 32,
              cursor: "pointer",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = errors.subject ? "var(--color-danger)" : "var(--color-card-border)"; }}
          >
            {SUBJECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.value === ""}>
                {opt.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--color-text-30)",
              fontSize: "var(--text-11)",
            }}
          >
            ▾
          </span>
        </div>
        {errors.subject && <p id="contact-subject-error" style={errorStyle} role="alert">{errors.subject}</p>}
      </div>

      <div>
        <label htmlFor="contact-message" style={labelStyle}>Message</label>
        <textarea
          id="contact-message"
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          rows={6}
          aria-required="true"
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          style={{
            ...fieldStyle,
            resize: "vertical",
            minHeight: 120,
            borderColor: errors.message ? "var(--color-danger)" : "var(--color-card-border)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = errors.message ? "var(--color-danger)" : "var(--color-card-border)"; }}
        />
        {errors.message && <p id="contact-message-error" style={errorStyle} role="alert">{errors.message}</p>}
      </div>

      {serverError && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: "10px 14px",
            background: "var(--color-card-bg)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-danger)",
          }}
        >
          {serverError}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            background: loading ? "var(--color-card-bg)" : "var(--color-accent)",
            border: "1px solid " + (loading ? "var(--color-card-border)" : "var(--color-accent)"),
            borderRadius: "var(--radius-sm)",
            color: loading ? "var(--color-text-30)" : "var(--color-bg)",
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-13)",
            letterSpacing: "var(--tracking-wide)",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {loading ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
