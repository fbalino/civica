import { config } from "dotenv";

config({ path: ".env.local", override: true, quiet: true });

import { db } from "../src/lib/db";
import { upsertBills } from "../src/lib/bills/upsert";
import { BillSourceAggregateError, runBillsSync } from "../src/lib/bills/sync";
import { fetchCABillsForSync } from "../src/lib/bills/sources/legisinfo-ca";
import { fetchDEBillsForSync } from "../src/lib/bills/sources/bundestag-dip";
import { fetchFRBillsForSync } from "../src/lib/bills/sources/an-senat-fr";

type Source = "ca" | "de" | "fr";

function requestedSource(): Source {
  const value = process.argv
    .slice(2)
    .find((argument) => argument.startsWith("--source="))
    ?.slice("--source=".length);
  if (value === "ca" || value === "de" || value === "fr") return value;
  throw new Error(
    "Pass exactly one of --source=ca, --source=de, or --source=fr",
  );
}

async function main() {
  const source = requestedSource();
  const configuration = {
    ca: {
      jurisdictionSlug: "canada",
      iso2: "CA",
      fetchDrafts: ({ jurisdictionId }: { jurisdictionId: string }) =>
        fetchCABillsForSync({ jurisdictionId, db, limit: 100 }),
    },
    de: {
      jurisdictionSlug: "germany",
      iso2: "DE",
      fetchDrafts: ({ jurisdictionId }: { jurisdictionId: string }) =>
        fetchDEBillsForSync({ jurisdictionId, db, limit: 100 }),
    },
    fr: {
      jurisdictionSlug: "france",
      iso2: "FR",
      fetchDrafts: ({ jurisdictionId }: { jurisdictionId: string }) =>
        fetchFRBillsForSync({ jurisdictionId, db, limit: 50 }),
    },
  } satisfies Record<
    Source,
    {
      jurisdictionSlug: string;
      iso2: string;
      fetchDrafts: (opts: { jurisdictionId: string }) => Promise<unknown>;
    }
  >;
  const selected = configuration[source];
  const summary = await runBillsSync(db, {
    ...selected,
    dryRun: true,
    readSummaries: async (_db, keys) => keys.map(() => null),
    generateSummaries: async (requests) => requests.map(() => ""),
    cacheSummary: async () => {},
    writeRows: async (database, rows) =>
      upsertBills(database, rows, { dryRun: true }),
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        source,
        fetched: summary.fetched,
        wouldWrite: summary.wouldWrite,
        sourceOutcomes: summary.sourceOutcomes,
        sourcesStamped: summary.sourcesStamped,
        dryRun: summary.dryRun,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  if (error instanceof BillSourceAggregateError) {
    console.error(
      JSON.stringify({
        ok: false,
        outcome: error.outcome,
        sourceFailures: error.outcomes.flatMap((source) =>
          source.status === "failed"
            ? [{ sourceId: source.sourceId, code: source.code }]
            : [],
        ),
      }),
    );
  } else {
    console.error(JSON.stringify({ ok: false, outcome: "validation_failed" }));
  }
  process.exit(1);
});
