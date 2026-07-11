console.error("db:push is intentionally disabled as a production-history mechanism. Use npm run db:plan -- --id=<id> and the reviewed migration workflow. For an explicitly disposable local database only, use CIVICA_ALLOW_DB_PUSH=local-only npm run db:push:local.");
process.exit(1);
