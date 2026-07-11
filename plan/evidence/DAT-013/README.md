# DAT-013 — Migration and production-data-change discipline

The repository now states its migration history honestly: 25 checked SQL
artifacts exist, the legacy Drizzle journal names only 12, two sequence numbers
collide, and 11 operational data-change scripts sit outside the journal. The
registry closes that inventory without pretending the journal is authoritative;
DAT-026 still owns the clean baseline and ordered replacement history.

Implemented controls:

- every artifact has a forward path, restore/forward-compensation posture,
  zero-write planning command, invariant plan, history status, and internal
  release-note linkage;
- `npm run db:plan -- --id=<id> --live` reports exact pre-change relation row
  counts and writes nothing;
- `npm run db:push` refuses, while a guarded local-only wrapper requires an
  explicit opt-in and rejects production/Vercel;
- `npm run validate:migrations` closes the SQL/data-script inventory, journal
  truth, required metadata, release-note files, and package commands; and
- adversarial fixtures seed unregistered artifacts, missing compensation and
  release linkage, journal lies, unsafe db:push, parser comment traps, and
  destructive statements.

`preflight.json` is the read-only live plan across the complete registry.

## Final acceptance

- Registry: 36/36 artifacts (25 SQL, 11 operational data changes).
- Historical truth: 12 journaled artifacts; two disclosed sequence collisions;
  11 later unjournaled SQL artifacts; no fabricated journal repair.
- Live preflight: 36/36 plans, exact row counts for every affected relation,
  zero missing relations, and `writesPerformed: 0` throughout.
- Eight focused adversarial fixtures pass.
- Full unit suite: 588/588.
- TypeScript, targeted ESLint, documentation references, migration/preflight
  validators, claims/docs, and the full production build pass.
- No rendered UI changed; browser review is not applicable.
