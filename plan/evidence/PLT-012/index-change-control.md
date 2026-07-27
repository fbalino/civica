# PLT-012 Index presentation change control

PLT-012 closes the request, response, content, and error boundaries around the protected Index API routes. It does not change an Index input, transform, weight, missingness rule, uncertainty rule, score, band, rank, or published research value.

## Protected presentation change

Protected `/api/v1/index/*` requests now cross strict, bounded query and path schemas before database work. Unknown keys, duplicate scalar keys, malformed encodings, invalid identifiers, and out-of-range values receive one fixed noncacheable problem response. Default release and methodology selection still resolve from the same checked release registry.

Successful Index envelopes and retirement/deprecation headers remain unchanged. Error envelopes now include a stable machine code, and deprecation metadata is enumerated explicitly instead of relying on future-prone object spreading. The route-I/O registry binds these presentation contracts to the complete route inventory and fails when a registered method lacks a reviewed request, response, or error policy.

## Research invariants

No PLT-012 code writes or recalculates Index observations. The protected query changes only reject inputs that were undocumented, ambiguous, malformed, duplicated, or outside existing bounds. Atlas-only democracy projection cleanup is excluded from Index-input change detection and does not enter any Index calculation path.

## Migration and rollback

There is no database migration and no research-row rewrite. Deploy the application normally after the credential-free security, Index change-control, test, and build gates pass against the exact release commit.

Clients should treat the additive `code` field as the stable error discriminator and must not depend on provider, database, stack, or validation-library detail. A rollback must preserve bounded parsing, fixed unknown-error responses, and explicit public projections. Any rollback that changes a protected Index presentation file after this record lands requires a new append-only presentation record; this v31 record must not be edited in place.

## Verification binding

The closed route policy proves exact coverage of every canonical route-method tuple. Seeded fuzz and negative fixtures cover malformed bytes, encodings, prototype keys, deep/oversized structures, duplicate values, unknown fields, private-address URL retrieval, redirect revalidation, decompressed-size limits, spreadsheet formula prefixes, sanitizer exploit strings, future database columns, credential hashes, and unknown exception text.
