"use client";

import type { Bill } from "../data";

export interface BillsTabProps {
  active: boolean;
  countryName: string;
  billsData: Bill[] | null;
  billsLoading: boolean;
  /**
   * Called when a bill's "Ask AI" button is clicked. The legacy / route
   * wires this to the in-file chat via chatInputRef+sendChat; shell routes
   * dispatch a civica:ask CustomEvent that the @right AskCivicaPanel listens for.
   */
  onAskBill: (prompt: string) => void;
}

export function BillsTab({
  active,
  countryName,
  billsData,
  billsLoading,
  onAskBill,
}: BillsTabProps) {
  return (
    <div className={`atlas-pane${active ? " on" : ""}`}>
      {billsLoading ? (
        <div
          className="atlas-mono"
          style={{
            fontSize: 11,
            color: "var(--atlas-muted)",
            padding: "40px 0",
            textAlign: "center",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Loading…
        </div>
      ) : billsData && billsData.length > 0 ? (
        billsData.map((b, i) => (
          <BillCard key={i} bill={b} index={i} onAsk={onAskBill} />
        ))
      ) : (
        <div
          className="atlas-mono"
          style={{
            color: "var(--atlas-muted)",
            fontSize: 12,
            padding: "40px 0",
            textAlign: "center",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          No bill data available for {countryName}
        </div>
      )}
    </div>
  );
}

interface BillCardProps {
  bill: Bill;
  index: number;
  onAsk: (text: string) => void;
}

function BillCard({ bill, index, onAsk }: BillCardProps) {
  const stages = ["Draft", "Committee", "Lower Floor", "Upper House", "Enacted"];
  return (
    <div className="atlas-bill">
      <div className="idx">{String(index + 1).padStart(2, "0")}</div>
      <div>
        <div className="t">{bill.title}</div>
        {bill.summary && <div className="sum">{bill.summary}</div>}
        <div className="tags">
          {bill.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <div className="timeline">
          {stages.flatMap((s, j) => [
            <span
              key={`dot-${j}`}
              className={`dot${
                j < bill.stage ? " done" : j === bill.stage ? " now" : ""
              }`}
            />,
            ...(j < stages.length - 1
              ? [<span key={`line-${j}`} className="line" />]
              : []),
          ])}
        </div>
        <div className="tlabs">
          {stages.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        {bill.votes &&
          (() => {
            const tot = bill.votes.yes + bill.votes.no + bill.votes.abs;
            const y = (bill.votes.yes / tot) * 100;
            const n = (bill.votes.no / tot) * 100;
            const a = (bill.votes.abs / tot) * 100;
            return (
              <>
                <div className="atlas-vote-bar">
                  <div className="y" style={{ width: `${y}%` }} />
                  <div className="n" style={{ width: `${n}%` }} />
                  <div className="a" style={{ width: `${a}%` }} />
                </div>
                <div className="atlas-vote-row">
                  <span>Yes {bill.votes!.yes}</span>
                  <span>No {bill.votes!.no}</span>
                  <span>Abs {bill.votes!.abs}</span>
                </div>
              </>
            );
          })()}
      </div>
      <div className="actions">
        {bill.url && (
          <a
            href={bill.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ask-btn"
            style={{ textDecoration: "none", textAlign: "center" }}
          >
            Official Text &rarr;
          </a>
        )}
        <button
          className="ask-btn"
          onClick={() =>
            onAsk(
              `Explain "${bill.title}" to me — what does it actually do, who wins, who loses, and where is it in the process?`,
            )
          }
        >
          Ask AI
        </button>
      </div>
    </div>
  );
}
