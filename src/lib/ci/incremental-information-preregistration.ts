export const INCREMENTAL_INFORMATION_PROTOCOL_VERSION =
  "civica-index-incremental-information/v1" as const;
export const INCREMENTAL_INFORMATION_PREREGISTRATION = Object.freeze({
  protocolVersion: INCREMENTAL_INFORMATION_PROTOCOL_VERSION,
  registeredAt: "2026-07-11T10:33:40Z",
  status: "locked_before_incremental_results",
  target: "K1 rounded score on complete final-holdout jurisdiction-years",
  training: "development split only",
  comparators: [
    { id: "B1", model: "native V-Dem LDI linear calibration" },
    {
      id: "B2",
      model: "frozen equal-weight common-scale baseline linear calibration",
    },
    {
      id: "B3",
      model: "frozen development-fitted first factor linear calibration",
    },
    {
      id: "P1",
      model:
        "ordinary least squares over the four public normalized inputs with intercept; development fit only",
    },
  ],
  metrics: ["held-out R2", "RMSE", "MAE", "delta R2 versus B1"],
  uncertainty:
    "2000 deterministic jurisdiction-cluster bootstrap samples on final holdout",
  originalityFailure: "P1 final-holdout R2 >= 0.90",
  meaningfulGain:
    "Complexity cannot claim decision utility without the separate preregistered human task improvement of at least 10 percentage points or 20% median time reduction with no comprehension loss",
  missingness:
    "complete four-dimension rows only for fair common-sample comparison; no imputation",
  otherCandidates: {
    K2: "incremental expert AUC versus B4 pending external labels",
    K3: "B5 structured-data comparison pending historical transfer benchmark",
    K4: "B5 comparison pending blinded fair-pair labels",
    K5: "B5 comparison pending adjudicated relation benchmark",
  },
  nonclaims: [
    "reproducing K1 does not predict governance outcomes",
    "high R2 is adverse for originality",
    "low error does not establish usefulness",
  ],
});
export function incrementalPreregistrationErrors(
  p = INCREMENTAL_INFORMATION_PREREGISTRATION,
) {
  const e: string[] = [];
  if (p.status !== "locked_before_incremental_results")
    e.push("protocol unlocked");
  if (p.comparators.length !== 4) e.push("comparators incomplete");
  if (!p.originalityFailure.includes("0.90"))
    e.push("originality threshold missing");
  if (!p.uncertainty.includes("jurisdiction-cluster"))
    e.push("cluster uncertainty missing");
  if (!p.meaningfulGain.includes("human task"))
    e.push("utility cannot remain separate");
  return e;
}
