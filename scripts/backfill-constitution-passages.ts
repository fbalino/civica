/** ATL-009 deterministic passage backfill. Never advances source freshness. */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { constitutions, jurisdictions } from "../src/lib/db/schema";
import {
  prepareConstitutionPassages,
  type ConstitutionPassageSourceArticle,
} from "../src/lib/constitution/passage-index";
import { replaceCurrentConstitutionPassages } from "../src/lib/constitute/sync-constitutions";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const directory = await db
    .select({
      constitutionId: constitutions.id,
      jurisdictionId: constitutions.jurisdictionId,
      sourceDocumentId: constitutions.constituteProjectId,
      retrievedAt: constitutions.lastFetched,
      slug: jurisdictions.slug,
    })
    .from(constitutions)
    .innerJoin(
      jurisdictions,
      eq(jurisdictions.id, constitutions.jurisdictionId),
    );

  let current = 0;
  let written = 0;
  let superseded = 0;
  for (const [index, item] of directory.entries()) {
    if (!item.sourceDocumentId || !item.retrievedAt) {
      throw new Error(
        `${item.slug} lacks source document identity or retrieval time`,
      );
    }
    const [row] = await db
      .select({ structuredArticles: constitutions.structuredArticles })
      .from(constitutions)
      .where(eq(constitutions.id, item.constitutionId))
      .limit(1);
    const articles = row?.structuredArticles as
      ConstitutionPassageSourceArticle[] | null;
    if (!articles) throw new Error(`${item.slug} lacks structured articles`);

    if (dryRun) {
      current += prepareConstitutionPassages(
        item.sourceDocumentId,
        articles,
      ).length;
    } else {
      const result = await replaceCurrentConstitutionPassages(db, {
        constitutionId: item.constitutionId,
        jurisdictionId: item.jurisdictionId,
        sourceDocumentId: item.sourceDocumentId,
        retrievedAt: item.retrievedAt,
        articles,
      });
      current += result.current;
      written += result.written;
      superseded += result.superseded;
    }
    console.log(`[${index + 1}/${directory.length}] ${item.slug}`);
  }

  console.log(
    JSON.stringify(
      { dryRun, constitutions: directory.length, current, written, superseded },
      null,
      2,
    ),
  );
  if (current !== 96_126) {
    throw new Error(
      `Expected 96,126 non-empty current passages, received ${current}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
