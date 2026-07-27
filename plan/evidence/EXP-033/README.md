# EXP-033 — Atlas selection and comparison accessibility evidence

**Completed:** 2026-07-18

The Atlas now has a single source of selection truth: a map pointer/touch
selection and the native labelled country selector both update
`selectedCountryId`. That state drives the selector value, the selected map
path, the live status, profile action, and the explicit two-country comparison
flow.

## Browser contract

`e2e/exp-033-atlas-accessibility.spec.ts` covers each of these scenarios in
Chromium:

- desktop and small-mobile viewports, in light and dark themes;
- visible `World Atlas` H1 and labelled native country control;
- a real map-pointer selection of Brazil, followed by selector/status
  synchronization;
- native-selector state updating the map highlight;
- keyboard traversal and activation of the profile/compare controls; and
- two selected countries enabling keyboard activation of the canonical
  `/compare?c=…&c=…` route.

On small screens the test selects a map country before expanding Country
controls, matching the intended touch sequence: tap one country on the map,
then use the explicit controls to add two countries and open comparison. No
tap gesture is presented as a hidden or impossible way to compare countries.

## Verification

The verification ran in a disposable detached worktree at
`/private/tmp/civica-exp033-15ada91a`, with its own local development server
on port 3100. It made only reader GET requests; no form submission, database
write, production deployment, or credential change was performed.

```sh
E2E_BASE_URL=http://localhost:3100 \
  npx playwright test e2e/exp-033-atlas-accessibility.spec.ts --workers=1
# 4 passed (41.6s)

E2E_BASE_URL=http://localhost:3100 npm run test:e2e:a11y
# 51 passed (1.3m)

npx tsc --noEmit --pretty false
# exit 0
```

The desktop and small-mobile selected-state screens were also inspected in the
same real browser. The map remains a visual overview; Country controls are the
canonical accessible selection and comparison path.
