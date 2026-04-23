"use client";

export interface ConstitutionData {
  year: number | null;
  yearUpdated: number | null;
  constituteProjectId: string | null;
  fullTextHtml: string | null;
}

export interface ConstitutionTabProps {
  active: boolean;
  loading: boolean;
  data: ConstitutionData | null;
}

export function ConstitutionTab({ active, loading, data }: ConstitutionTabProps) {
  const hasContent = !!data && !!(data.year || data.fullTextHtml);

  return (
    <div className={`atlas-pane${active ? " on" : ""}`}>
      {loading && active ? (
        <Empty label="Loading…" />
      ) : hasContent && data ? (
        <>
          <div
            style={{
              display: "flex",
              gap: 24,
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: "1px solid var(--atlas-rule)",
            }}
          >
            {data.year && (
              <div>
                <Eyebrow>Enacted</Eyebrow>
                <div className="atlas-serif" style={{ fontSize: 32 }}>
                  {data.year}
                </div>
              </div>
            )}
            {data.yearUpdated && (
              <div>
                <Eyebrow>Last Amended</Eyebrow>
                <div className="atlas-serif" style={{ fontSize: 32 }}>
                  {data.yearUpdated}
                </div>
              </div>
            )}
          </div>
          {data.constituteProjectId && (
            <div style={{ marginBottom: 16 }}>
              <a
                href={`https://www.constituteproject.org/constitution/${data.constituteProjectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="atlas-mono"
                style={{
                  fontSize: 11,
                  color: "var(--atlas-accent)",
                  textDecoration: "underline",
                  letterSpacing: ".06em",
                }}
              >
                Read full text on Constitute Project &nearr;
              </a>
            </div>
          )}
          {data.fullTextHtml && (
            <div
              className="atlas-sans"
              style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: "var(--atlas-ink-2)",
                maxHeight: 400,
                overflow: "auto",
                paddingRight: 4,
              }}
              dangerouslySetInnerHTML={{ __html: data.fullTextHtml }}
            />
          )}
        </>
      ) : (
        <Empty label="Constitution data not yet available" />
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
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
      {label}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="atlas-mono"
      style={{
        fontSize: 10,
        color: "var(--atlas-muted)",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}
