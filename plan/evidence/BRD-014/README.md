# BRD-014 — accessibility & responsible-disclosure statements

Completed 2026-07-12.

## Shipped
- **`/accessibility`** (new canonical reader page, PageHero + editorial-page):
  - Accessibility statement — targets **WCAG 2.2 AA**, states it is honest
    work-in-progress (not certified), lists the current known limitations
    (map/chart keyboard + non-visual equivalents + reduced-motion, tracked by
    EXP-020/027/022), and routes feedback to `/contact` as a defect.
  - Responsible-disclosure statement with an explicit **safe-harbour** posture,
    in/out-of-scope, private reporting via `/contact` or
    `admin@civicaatlas.org`, and a pointer to the machine-readable policy.
- **`public/.well-known/security.txt`** (RFC 9116): Contact (form + email),
  Expires, Preferred-Languages, Canonical, Policy → `/accessibility#security`.
  Served with HTTP 200.
- Linked from the site footer (Accessibility, beside Contact/Licensing).

## Verification (2026-07-12)
- `/accessibility` renders on the design system (2 sections, WCAG 2.2 +
  safe-harbour + security.txt reference present), no console errors.
- `curl /.well-known/security.txt` → 200, valid RFC 9116.
- `validate:metadata` passes (new route canonical/sitemap clean); QA-015
  footer/asset guards still pass; typecheck and lint clean.

## Queued manual (BRD-014)
"Monitored contact paths work" and "runbooks tested" need real external
delivery — the `/contact` form persists to the admin message queue, but
confirming email delivery to `admin@civicaatlas.org` and an end-to-end triage
response is an owner check (queued in MANUAL-CHECKS).
