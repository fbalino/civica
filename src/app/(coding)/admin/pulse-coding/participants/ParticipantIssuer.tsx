"use client";

import { useState } from "react";

interface StudyOption {
  id: string;
  title: string;
}

export function ParticipantIssuer({ studies }: { studies: StudyOption[] }) {
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setAccessCode(null);
    setMessage(null);
    try {
      const response = await fetch("/api/pulse-coding/admin/participants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const body = (await response.json()) as {
        accessCode?: string;
        assignments?: number;
        error?: string;
      };
      if (!response.ok || !body.accessCode)
        throw new Error(body.error || "Access could not be issued.");
      setAccessCode(body.accessCode);
      setMessage(`Created ${body.assignments ?? 0} packet assignments.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access could not be issued.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="admin-form">
      <div className="admin-field">
        <label className="admin-field-label" htmlFor="studyId">Study</label>
        <select id="studyId" name="studyId" className="admin-select" required>
          {studies.map((study) => (
            <option key={study.id} value={study.id}>{study.title}</option>
          ))}
        </select>
      </div>
      <div className="admin-field">
        <label className="admin-field-label" htmlFor="pseudonym">Pseudonym</label>
        <input id="pseudonym" name="pseudonym" className="admin-input" required maxLength={80} />
      </div>
      <div className="admin-grid-2">
        <div className="admin-field">
          <label className="admin-field-label" htmlFor="slot">Role slot</label>
          <select id="slot" name="slot" className="admin-select" required>
            <option value="coder_a">Coder A</option>
            <option value="coder_b">Coder B</option>
            <option value="adjudicator">Adjudicator</option>
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-field-label" htmlFor="actorType">Participant type</label>
          <select id="actorType" name="actorType" className="admin-select" required>
            <option value="qualified_human">Qualified human</option>
            <option value="agent_dry_pilot">Agent dry pilot</option>
          </select>
        </div>
      </div>
      <div className="admin-field">
        <label className="admin-field-label" htmlFor="useStatus">Use status</label>
        <select id="useStatus" name="useStatus" className="admin-select" required>
          <option value="dry_run_not_gold">Dry run — not gold</option>
          <option value="evaluation_candidate">Evaluation candidate</option>
        </select>
      </div>
      <button type="submit" className="btn btn--primary" disabled={pending || studies.length === 0}>
        {pending ? "Issuing…" : "Issue access"}
      </button>
      {message ? <p className="admin-hint" role="status">{message}</p> : null}
      {accessCode ? (
        <div className="admin-note coding-access-code" role="status">
          <strong>Copy this code now.</strong> It is shown once and is never stored in plaintext.
          <code>{accessCode}</code>
        </div>
      ) : null}
    </form>
  );
}
