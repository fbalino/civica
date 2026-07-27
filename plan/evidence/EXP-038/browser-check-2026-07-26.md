# EXP-038 browser check — 2026-07-26

Command:

```sh
E2E_BASE_URL=http://localhost:3004 npx playwright test \
  e2e/exp-038-copy-and-disclosure.spec.ts --project=chromium
```

Result: 6 passed, 0 failed.

The suite checked:

- `/` and `/about#project-disclosure` at 1440×1000 and 390×844 in light and
  dark themes;
- `/methodology`;
- `/governance-evidence?country=andorra`;
- `/licensing`;
- `/contact`;
- `/about/advisory-board/apply`; and
- `/country/andorra/constitution`.

It asserted the approved text, all six canonical disclosure sections, the
machine-readable disclosure and correction links, the retained independence
label, no horizontal overflow, and no hard console or network failures.

The first diagnostic run used `/governance-evidence` without a selected
country, so the country-release paragraph was correctly absent. The acceptance
test was corrected to select Andorra and the complete suite then passed. This
was a test-state correction, not an application defect.
