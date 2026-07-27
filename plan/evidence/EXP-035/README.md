# EXP-035 evidence — precise provenance controls

## Delivered contract

`<SourceDot>` now exposes the following in both its keyboard-accessible name
and focus/hover disclosure:

- source name;
- explicit live, frozen, experimental, or unknown source state;
- exact UTC timestamp, a date-only label, or `Unknown timestamp`;
- publisher vintage or `Not supplied on this surface`; and
- verified license status or an explicit pending-rights state.

The client-safe display registry does not guess source rights. It only repeats
terms that the server-side rights registry already verifies; every other source
states that reuse is pending and not implied.

## Verification

```text
node --import tsx --test src/lib/data/__tests__/source-provenance-display.test.ts
# 3 passed

npx tsc --noEmit
# passed

npm run validate:design-tokens
# passed — no new drift (206 legacy baseline entries)

EXP035_CAPTURE_DIR=plan/evidence/EXP-035/mockups \
E2E_BASE_URL=http://localhost:3100 \
npm run test:e2e -- e2e/exp-035-provenance-controls.spec.ts
# 2 passed — canonical design-system control in light and dark themes
```

The browser check filters one already-known, unrelated `/design-system`
hydration diagnostic from its legacy ramp tooltip demo; it continues to fail on
any other route, request, or page error.

## Screenshots

- `mockups/source-dot-light.png`
- `mockups/source-dot-dark.png`
