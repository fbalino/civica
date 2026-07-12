"use client";

import { useState } from "react";
import { PULSE_ADJUDICATION_REASON_CODES, type PulseCoderAnswer } from "@/lib/pulse/v2/coder-protocol";
import type { PulseCodingSubmissionEnvelope } from "@/lib/pulse/v2/coding-workspace";

interface Props {
  assignmentId: string;
  packetId: string;
  comparisonSha256: string;
  axes: string[];
  submissions: PulseCodingSubmissionEnvelope[];
}

export function AdjudicationForm({ assignmentId, packetId, comparisonSha256, axes, submissions }: Props) {
  const [choice, setChoice] = useState<"coder_a" | "coder_b" | "new" | "unresolved">("unresolved");
  const [reasonCodes, setReasonCodes] = useState<string[]>([]);
  const [rationale, setRationale] = useState("");
  const [newAnswer, setNewAnswer] = useState(JSON.stringify(submissions[0]?.answer ?? {}, null, 2));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setMessage(null);
    try {
      let resolution:
        | { kind: "select_submission"; coderId: string; rationale: string }
        | { kind: "new_annotation"; answer: PulseCoderAnswer; rationale: string }
        | { kind: "unresolved"; rationale: string };
      if (choice === "coder_a" || choice === "coder_b") {
        const index = choice === "coder_a" ? 0 : 1;
        resolution = { kind: "select_submission", coderId: submissions[index].coderId, rationale };
      } else if (choice === "new") {
        resolution = { kind: "new_annotation", answer: JSON.parse(newAnswer) as PulseCoderAnswer, rationale };
      } else resolution = { kind: "unresolved", rationale };
      const response = await fetch(`/api/pulse-coding/adjudications/${assignmentId}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          packetId,
          comparisonSha256,
          status: choice === "unresolved" ? "unresolved" : "resolved",
          reasonCodes,
          resolution,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Adjudication failed.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Adjudication failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-card coding-adjudication-form" aria-labelledby="adjudication-decision-title">
      <p className="admin-eyebrow">Separate adjudication</p>
      <h2 id="adjudication-decision-title" className="admin-section-title">Record an evidence-grounded disposition</h2>
      <p className="admin-section-intro">There is no majority-vote option. Select a supported raw submission, write a new annotation, or leave the packet unresolved.</p>
      <div className="coding-axis-list" aria-label="Disagreement axes">
        {axes.length ? axes.map((axis) => <span className="editorial-chip editorial-chip--rose" key={axis}>{axis.replaceAll("_", " ")}</span>) : <span className="editorial-chip editorial-chip--sage">No tracked disagreement</span>}
      </div>
      <fieldset className="coding-fieldset">
        <legend className="admin-field-label">Disposition</legend>
        {[
          ["coder_a", `Select ${submissions[0]?.coderId ?? "Coder A"}`],
          ["coder_b", `Select ${submissions[1]?.coderId ?? "Coder B"}`],
          ["new", "Write a new annotation"],
          ["unresolved", "Leave unresolved"],
        ].map(([value, label]) => (
          <label className="coding-radio-row" key={value}>
            <input type="radio" name="adjudication-choice" checked={choice === value} onChange={() => setChoice(value as typeof choice)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {choice === "new" ? (
        <div className="admin-field">
          <label className="admin-field-label" htmlFor="new-adjudication-answer">New structured annotation</label>
          <textarea id="new-adjudication-answer" className="admin-textarea coding-json-editor" value={newAnswer} onChange={(event) => setNewAnswer(event.target.value)} />
          <p className="admin-hint">Use the same structured answer contract shown in the raw submissions. This path is for evidence-grounded synthesis, not compromise scoring.</p>
        </div>
      ) : null}
      <fieldset className="coding-fieldset">
        <legend className="admin-field-label">Reason codes</legend>
        <div className="coding-reason-grid">
          {PULSE_ADJUDICATION_REASON_CODES.map((code) => (
            <label className="coding-check-row" key={code}>
              <input type="checkbox" checked={reasonCodes.includes(code)} onChange={() => setReasonCodes(reasonCodes.includes(code) ? reasonCodes.filter((item) => item !== code) : [...reasonCodes, code])} />
              <span>{code.replaceAll("_", " ")}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="admin-field">
        <label className="admin-field-label" htmlFor="adjudication-rationale">Rationale and evidence basis</label>
        <textarea id="adjudication-rationale" className="admin-textarea" value={rationale} onChange={(event) => setRationale(event.target.value)} />
      </div>
      {message ? <p className="coding-validation-errors" role="alert">{message}</p> : null}
      <button type="button" className="btn btn--primary" disabled={pending || !reasonCodes.length || !rationale.trim()} onClick={submit}>
        {pending ? "Recording…" : "Record terminal adjudication"}
      </button>
    </section>
  );
}
