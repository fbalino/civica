"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/editorial/Button";
import { DataTable } from "@/components/editorial/DataTable";
import { Chip } from "@/components/editorial/Pill";
import type {
  AtlasChangeKind,
  AtlasEntityChangeHistoryDocument,
  AtlasHistoryEntityType,
} from "@/lib/atlas/change-history";

const PAGE_SIZE = 5;

const CHANGE_KIND_LABELS: Record<AtlasChangeKind, string> = {
  routine_refresh: "Routine refresh",
  substantive_revision: "Substantive revision",
  correction: "Correction",
  retraction: "Retraction",
  methodology_change: "Methodology change",
};

const CHANGE_KIND_TONES: Record<
  AtlasChangeKind,
  "blue" | "sand" | "rose" | "accent"
> = {
  routine_refresh: "blue",
  substantive_revision: "sand",
  correction: "rose",
  retraction: "rose",
  methodology_change: "accent",
};

export function formatAtlasHistoryField(field: string): string {
  return field
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatAtlasHistoryValue(value: unknown): string {
  if (value === null || value === undefined) return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value.length > 0 ? value : "Empty";
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function historyEndpoint(
  entityType: AtlasHistoryEntityType,
  entityId: string,
  offset: number,
) {
  return `/api/citations/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/history?limit=${PAGE_SIZE}&offset=${offset}`;
}

async function fetchHistoryPage(
  entityType: AtlasHistoryEntityType,
  entityId: string,
  offset: number,
  signal?: AbortSignal,
): Promise<AtlasEntityChangeHistoryDocument> {
  const response = await fetch(historyEndpoint(entityType, entityId, offset), {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Atlas history request failed with ${response.status}`);
  }
  return (await response.json()) as AtlasEntityChangeHistoryDocument;
}

function HistoryValue({
  field,
  value,
}: {
  field: string;
  value: unknown;
}) {
  const formatted = formatAtlasHistoryValue(value);
  if (
    field === "source_url" &&
    typeof value === "string" &&
    /^https?:\/\//.test(value)
  ) {
    return (
      <a href={value} target="_blank" rel="noreferrer noopener">
        {formatted}
      </a>
    );
  }
  return <>{formatted}</>;
}

export function AtlasChangeHistoryDisclosure({
  entityType,
  entityId,
}: {
  entityType: AtlasHistoryEntityType;
  entityId: string;
}) {
  const [document, setDocument] =
    useState<AtlasEntityChangeHistoryDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setUnavailable(false);
    fetchHistoryPage(entityType, entityId, 0, controller.signal)
      .then((next) => setDocument(next))
      .catch(() => {
        if (!controller.signal.aborted) setUnavailable(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [entityId, entityType]);

  const loadEarlier = useCallback(async () => {
    if (!document || loadingMore || !document.pagination.hasMore) return;
    setLoadingMore(true);
    setUnavailable(false);
    try {
      const next = await fetchHistoryPage(
        entityType,
        entityId,
        document.events.length,
      );
      setDocument({
        ...next,
        events: [...document.events, ...next.events],
      });
    } catch {
      setUnavailable(true);
    } finally {
      setLoadingMore(false);
    }
  }, [document, entityId, entityType, loadingMore]);

  return (
    <section className="atlas-change-history" aria-label="Release history">
      <div className="atlas-change-history__head">
        <div>
          <h4>Release history</h4>
          <p>Recorded changes to this exact source observation.</p>
        </div>
        <Chip variant="neutral" size="sm">
          Public record
        </Chip>
      </div>

      {loading ? (
        <p className="atlas-change-history__state" role="status">
          Loading recorded history…
        </p>
      ) : null}

      {!loading && unavailable && !document ? (
        <p className="atlas-change-history__state" role="status">
          Release history is temporarily unavailable. The current value and
          source record remain visible above.
        </p>
      ) : null}

      {!loading &&
      document?.coverage.state === "no_recorded_history" ? (
        <div className="atlas-change-history__state">
          <strong>No recorded public history</strong>
          <p>{document.coverage.note}</p>
        </div>
      ) : null}

      {document && document.events.length > 0 ? (
        <>
          <ol className="atlas-change-history__events">
            {document.events.map((event) => (
              <li key={event.id} className="atlas-change-history__event">
                <div className="atlas-change-history__event-head">
                  <Chip
                    variant={CHANGE_KIND_TONES[event.changeKind]}
                    size="sm"
                  >
                    {CHANGE_KIND_LABELS[event.changeKind]}
                  </Chip>
                  <time dateTime={event.recordedAt}>
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(new Date(event.recordedAt))}
                  </time>
                </div>
                <h5>{event.reason}</h5>
                <p className="atlas-change-history__meta">
                  Release {event.releaseId} · Method {event.methodologyVersion}
                </p>
                {event.correction ? (
                  <p className="atlas-change-history__meta">
                    Public correction status:{" "}
                    {formatAtlasHistoryField(event.correction.status)}
                  </p>
                ) : null}
                <DataTable aria-label={`${event.reason} field changes`}>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Previous</th>
                      <th>Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.changes.map((change) => (
                      <tr key={change.field}>
                        <th scope="row">
                          {formatAtlasHistoryField(change.field)}
                        </th>
                        <td>
                          <HistoryValue
                            field={change.field}
                            value={change.before}
                          />
                        </td>
                        <td>
                          <HistoryValue
                            field={change.field}
                            value={change.after}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </li>
            ))}
          </ol>
          <p className="atlas-change-history__coverage">
            {document.coverage.note}
          </p>
          {document.pagination.hasMore ? (
            <Button
              variant="tertiary"
              size="sm"
              loading={loadingMore}
              onClick={loadEarlier}
            >
              Load earlier changes
            </Button>
          ) : null}
          {unavailable ? (
            <p className="atlas-change-history__state" role="status">
              Earlier history could not be loaded. Try again.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
