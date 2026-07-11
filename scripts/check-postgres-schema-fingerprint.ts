import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PUBLIC_SCHEMA_FINGERPRINT_SQL, publicSchemaFingerprint } from "../src/lib/db/authoritative-migrations";

const url = process.argv[2];
if (!url) throw new Error("Usage: tsx scripts/check-postgres-schema-fingerprint.ts <postgres-url>");
const psql = process.env.PSQL ?? "/opt/homebrew/Cellar/postgresql@17/17.9/bin/psql";
const serialized = execFileSync(psql, [url, "-At", "-v", "ON_ERROR_STOP=1", "-c", PUBLIC_SCHEMA_FINGERPRINT_SQL], { encoding: "utf8", maxBuffer: 10_000_000 }).trim();
const actual = publicSchemaFingerprint(JSON.parse(serialized));
const expected = JSON.parse(readFileSync("data/authoritative-schema-fingerprint.v1.json", "utf8")) as { sha256: string };
console.log(JSON.stringify({ actual, expected: expected.sha256, pass: actual === expected.sha256 }, null, 2));
if (actual !== expected.sha256) process.exit(1);
