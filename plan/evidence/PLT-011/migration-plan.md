# PLT-011 deployment and rollback plan

## Before deployment

1. Keep the verified all-path Vercel firewall rule active.
2. Confirm `RATE_LIMIT_KEY_SECRET` exists in each deployment environment without printing or retrieving its value. Production is recorded in the checked evidence; Preview remains an owner post-deployment check because this branch has no remote Preview deployment.
3. Run the credential-free policy, Index change-control, full test, and build gates against the exact release commit.

## Deployment

Deploy the application through the normal release path. The existing `rate_limits` table is reused, so no schema migration or Index data rewrite is required. The first durable increment in any scope also removes expired legacy counter rows in the same PostgreSQL statement.

## After deployment

Complete the PLT-011 item in `plan/MANUAL-CHECKS.md`: verify the environment-variable name is present in Preview and Production, exercise one limited response and one healthy request, and confirm logs contain neither the secret nor a raw client address.

## Rollback

Keep the platform firewall and independent HMAC secret in place during an application rollback. Do not restore a process-local fallback. If a protected Index route contract must be reverted after this append-only record lands, append a new presentation change record that binds the rollback; never edit or remove the v30 record.
