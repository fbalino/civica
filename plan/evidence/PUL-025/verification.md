# PUL-025 verification

The following gates are the completion proof:

```sh
npm run validate:pulse-validation-protocol
npm run validate:index-pulse-validation-protocol
npm run validate:index-change-control
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
npm run build
```

The protocol validator checks deterministic JSON identity, all ten fixture IDs,
the frozen retrospective-frame counts, the regression-only warning in the
legacy harness and public archive page, and the not-started state. The unit
tests enforce the lane boundary, required error roles, full-stage prospective
scope, label embargo, and method-change rule.
