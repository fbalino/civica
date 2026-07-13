/**
 * Retired by ATL-012.
 *
 * The former seed deleted every relationship and blanket-stamped all Atlas
 * jurisdictions into six organizations. That behavior destroyed interval
 * history and made unsupported membership claims. Keep this path as a loud
 * compatibility failure so old runbooks cannot silently reintroduce it.
 */

throw new Error(
  "seed-organizations.ts is retired; run `npm run plan:organization-memberships` and then `npm run sync:organization-memberships`.",
);
