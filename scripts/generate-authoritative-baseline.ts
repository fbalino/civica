import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const candidates = [process.env.PG_DUMP, "/opt/homebrew/Cellar/postgresql@17/17.9/bin/pg_dump", "pg_dump"].filter(Boolean) as string[];
const pgDump = candidates.find((path) => path === "pg_dump" || existsSync(path));
if (!pgDump) throw new Error("PostgreSQL 17 pg_dump not found; set PG_DUMP");

let dump = execFileSync(pgDump, [process.env.DATABASE_URL, "--schema-only", "--schema=public", "--no-owner", "--no-privileges"], { encoding: "utf8", maxBuffer: 20_000_000 });
dump = dump
  .split("\n")
  .filter((line) => !line.startsWith("\\restrict ") && !line.startsWith("\\unrestrict "))
  .join("\n")
  .replace(/--\n-- Name: public; Type: SCHEMA;[\s\S]*?COMMENT ON SCHEMA public IS 'standard public schema';\n\n/g, "")
  .replace(/^-- Dumped from database version.*\n-- Dumped by pg_dump version.*\n/m, "-- Generated from the reviewed production-shaped PostgreSQL 17 public schema.\n")
  .trim();
const header = `-- Civica authoritative baseline. Generated; do not hand-edit.\n-- Empty databases only. Existing production adopts only after exact fingerprint verification.\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\n\n`;
const output = resolve("drizzle/authoritative/0000_authoritative_baseline.sql");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${header}${dump}\n`);
console.log(`Wrote ${output}`);
