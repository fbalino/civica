import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

import {
  databaseFailureAbortsRender,
  fallbackWithoutDatabase,
  isCachedRenderFailure,
  readOrCredentialFreeFallback,
  rethrowDatabaseFailure,
} from "./cached-render";

async function withDatabaseUrl<T>(
  value: string | undefined,
  run: () => Promise<T> | T,
): Promise<T> {
  const prior = process.env.DATABASE_URL;
  if (value === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = value;
  try {
    return await run();
  } finally {
    if (prior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prior;
  }
}

const failure = new Error("Error connecting to database");

test("a configured database makes a failed read abort the cached render", async () => {
  await withDatabaseUrl("postgresql://fixture.invalid/civica", async () => {
    assert.equal(databaseFailureAbortsRender(), true);
    assert.equal(isCachedRenderFailure(failure), true);
    assert.throws(() => rethrowDatabaseFailure(failure), failure);
    assert.throws(() => fallbackWithoutDatabase(() => [])(failure), failure);
    await assert.rejects(
      readOrCredentialFreeFallback(() => Promise.reject(failure), () => []),
      failure,
    );
    await assert.rejects(
      Promise.reject(failure).catch(fallbackWithoutDatabase(() => null)),
      failure,
    );
  });
});

test("the credential-free build keeps its unavailable states", async () => {
  for (const value of [undefined, "", "   "]) {
    await withDatabaseUrl(value, async () => {
      assert.equal(databaseFailureAbortsRender(), false);
      assert.equal(isCachedRenderFailure(failure), false);
      assert.doesNotThrow(() => rethrowDatabaseFailure(failure));
      assert.deepEqual(fallbackWithoutDatabase(() => [])(failure), []);
      assert.deepEqual(
        await readOrCredentialFreeFallback(
          () => Promise.reject(failure),
          () => ["fallback"],
        ),
        ["fallback"],
      );
    });
  }
});

test("a successful read is returned unchanged either way", async () => {
  await withDatabaseUrl("postgresql://fixture.invalid/civica", async () => {
    assert.deepEqual(
      await readOrCredentialFreeFallback(
        () => Promise.resolve(["row"]),
        () => [],
      ),
      ["row"],
    );
  });
});

/**
 * Static guard: in every cached page, and in the components and helpers only
 * cached pages render, a database read may not be caught into a degraded
 * render without first rethrowing when a database is configured.
 */
const CACHED_PAGE_DEPENDENCIES = [
  "src/app/(reader)/country/[slug]/layout.tsx",
  "src/components/ci/CountryTrendSection.tsx",
  "src/components/factbook/FactbookBills.tsx",
  "src/components/factbook/FactbookLeaders.tsx",
  "src/components/factbook/FactbookLegislature.tsx",
  "src/components/factbook/FactbookOrganizations.tsx",
  "src/components/home/HomeGrid.tsx",
  "src/components/scores/ScoresAndRankings.tsx",
  "src/lib/factbook/cabinet-roster-provenance.ts",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [full]
      : [];
  });
}

function cachedPageFiles(): string[] {
  return walk("src/app").filter((file) =>
    /^export const revalidate = 86400;$/m.test(readFileSync(file, "utf8")),
  );
}

function uncheckedCatchSites(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const offenders: string[] = [];
  const at = (node: ts.Node) =>
    `${file}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const visit = (node: ts.Node) => {
    if (ts.isCatchClause(node) && !/rethrowDatabaseFailure\(/.test(node.block.getText())) {
      offenders.push(`${at(node)} catch block does not rethrow a database failure`);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "catch" &&
        node.arguments[0] &&
        !/fallbackWithoutDatabase\(/.test(node.arguments[0].getText())
      ) {
        offenders.push(`${at(node)} .catch() does not use fallbackWithoutDatabase`);
      }
      if (
        ts.isIdentifier(callee) &&
        callee.text === "captureAtlasSurfaceQuery" &&
        !/isCachedRenderFailure/.test(node.arguments[1]?.getText() ?? "")
      ) {
        offenders.push(`${at(node)} captureAtlasSurfaceQuery lacks isCachedRenderFailure`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return offenders;
}

test("cached pages never catch a database failure into a cacheable render", () => {
  const pages = cachedPageFiles();
  assert.ok(pages.length >= 20, `expected the cached pages, found ${pages.length}`);
  const offenders = [...pages, ...CACHED_PAGE_DEPENDENCIES].flatMap((file) =>
    uncheckedCatchSites(file, readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders, []);
});

test("the guard flags each swallowing shape", () => {
  const offenders = uncheckedCatchSites(
    "fixture.tsx",
    `
      async function Page() {
        try { await read(); } catch { /* degraded */ }
        await read().catch(() => []);
        await captureAtlasSurfaceQuery(() => read());
        try { await read(); } catch (error) { rethrowDatabaseFailure(error); }
        await read().catch(fallbackWithoutDatabase(() => []));
        await captureAtlasSurfaceQuery(() => read(), { rethrow: isCachedRenderFailure });
      }
    `,
  );
  assert.equal(offenders.length, 3);
});
