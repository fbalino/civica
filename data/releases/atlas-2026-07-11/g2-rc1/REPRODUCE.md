# Reproduce the frozen Atlas candidate

From a clean checkout of the repository:

1. Install Node.js v25.4.0 and run `npm ci`.
2. Confirm no `.env.local`, `.next`, `.turbo`, or copied cache is present.
3. Run `npm run reproduce:g2-atlas`.
4. Run `npm test` and `npm run build`.

The reproduction command uses only checked release files. It requires no database, model credential, or runtime network request and must match both semantic and compressed release hashes.
