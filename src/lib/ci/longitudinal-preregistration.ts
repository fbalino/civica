export const LONGITUDINAL_PROTOCOL_VERSION =
  "civica-index-longitudinal-validation/v1" as const;
export const LONGITUDINAL_PREREGISTRATION = Object.freeze({
  protocolVersion: LONGITUDINAL_PROTOCOL_VERSION,
  registeredAt: "2026-07-11T10:43:57Z",
  status: "locked_before_br_event_and_revision_results",
  inputs: {
    k1: "k1-current-composite-tournament/v1",
    panel: "ci-research-panel-2000-2024-v3",
    labels: "ci-longitudinal-validation-labels-2000-2022-v2",
    revisions: ["QoG Jan24/Jan25/Jan26", "V-Dem Core v14/v15"],
  },
  eventWindow:
    "K1 movement from t-1 to t+1 around a BR br_dem state transition at t; require both endpoints",
  responsiveness: {
    signedDirectionAccuracy: 0.7,
    medianSignedMovementPoints: 5,
  },
  leadLag: {
    lags: [-2, -1, 0, 1, 2],
    expectedPeak: "largest absolute mean signed movement at lag 0 or +1",
  },
  quietPeriods: {
    definition:
      "consecutive country-years with unchanged BR state and no transition within one year",
    medianAbsoluteK1ChangeMax: 2,
    p95AbsoluteK1ChangeMax: 10,
    eventToQuietMedianRatioMin: 2,
  },
  revisionSensitivity: {
    vdemV14V15MedianAbsoluteK1ShiftMax: 1,
    vdemV14V15P95AbsoluteK1ShiftMax: 3,
    qogEventEditionAgreementMin: 0.9,
  },
  missingness: "no imputation; every exclusion counted by reason",
  uncertainty:
    "2000 deterministic jurisdiction-cluster bootstrap intervals for direction accuracy, signed event movement, and quiet movement",
  nonclaims: [
    "BR transition coding is an external criterion, not ground truth",
    "responsiveness does not establish causality",
    "quiet does not mean no institutional change",
    "one-source revision test does not cover every upstream revision",
  ],
});
export function longitudinalPreregistrationErrors(
  p = LONGITUDINAL_PREREGISTRATION,
) {
  const e: string[] = [];
  if (p.status !== "locked_before_br_event_and_revision_results")
    e.push("unlocked");
  if (p.leadLag.lags.join(",") !== "-2,-1,0,1,2") e.push("lags drifted");
  if (!p.missingness.includes("no imputation")) e.push("imputation allowed");
  if (!p.revisionSensitivity.qogEventEditionAgreementMin)
    e.push("label revision gate missing");
  return e;
}
