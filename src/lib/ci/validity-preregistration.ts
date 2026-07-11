export const INDEX_VALIDITY_PROTOCOL_VERSION = "civica-index-validity-preregistration/v1" as const;
export const INDEX_VALIDITY_REGISTERED_AT = "2026-07-11T10:28:09Z" as const;

export const INDEX_VALIDITY_PREREGISTRATION = Object.freeze({
  protocolVersion: INDEX_VALIDITY_PROTOCOL_VERSION, registeredAt: INDEX_VALIDITY_REGISTERED_AT,
  status: "locked_before_validity_correlations",
  inputs: { panelReleaseId: "ci-research-panel-2000-2024-v3", k1Method: "k1-current-composite-tournament/v1", k2Method: "k2-measurement-concordance/v1", externalConstruct: "undp_hdi:hdi", externalConstructRole: "human-development correlate that is related to governance levels but not a governance-quality criterion", period: "2012-2023 common complete coverage" },
  hypotheses: [
    { id: "H1", type: "convergent_but_distinct", test: "Spearman association of K1 country-mean level with country-mean HDI", expected: "rho >= 0.30 and rho < 0.80", failureMeaning: "below 0.30 is weak convergence; 0.80 or above flags likely development confounding rather than stronger validity" },
    { id: "H2", type: "temporal_convergence", test: "median annual cross-sectional Spearman association of K1 with HDI", expected: "median rho >= 0.30 and every annual estimate reported", failureMeaning: "weak or unstable cross-sectional convergence" },
    { id: "H3", type: "discriminant_change", test: "Spearman association of consecutive K1 change with consecutive HDI change", expected: "absolute rho <= 0.30", failureMeaning: "Index change may track slow material-development movement or shared revision noise" },
    { id: "H4", type: "undesired_association", test: "Spearman association of K2 concordance spread with HDI level", expected: "absolute rho <= 0.30", failureMeaning: "measurement disagreement may be structured by development rather than only rater disagreement" },
    { id: "H5", type: "mechanical_input_association", test: "Spearman association of K1 with each constituent source input", expected: "report only; never counts as validity", failureMeaning: "not a gate because the associations are mathematically induced" },
  ],
  estimation: { correlation: "Spearman with average ranks for ties", uncertainty: "2000 deterministic jurisdiction-cluster bootstrap resamples, percentile 95% interval", seed: "civica-index-validity-bootstrap-v1", missingness: "pairwise complete within each frozen hypothesis; no imputation", multiplicity: "No null-hypothesis significance gate; report effect sizes and intervals. H1-H4 are noncompensating descriptive gates." },
  candidateLimits: { K0: "reference fidelity is tested elsewhere", K3: "external historical transfer labels pending", K4: "blinded scholar labels pending", K5: "double-coded relation and expert labels pending" },
  heldoutRule: "The candidate implementations and parameters were frozen before this protocol. External construct values are not used for fitting or tuning.",
});

export function validityPreregistrationErrors(protocol = INDEX_VALIDITY_PREREGISTRATION): string[] { const errors: string[]=[]; if(protocol.status!=="locked_before_validity_correlations")errors.push("protocol unlocked"); if(protocol.hypotheses.length!==5)errors.push("hypothesis set incomplete"); if(!protocol.hypotheses.some((row)=>row.type==="undesired_association"))errors.push("undesired association missing"); if(!protocol.hypotheses.some((row)=>row.type==="mechanical_input_association"&&row.expected.includes("never counts")))errors.push("mechanical associations can count as validity"); if(!protocol.estimation.uncertainty.includes("jurisdiction-cluster"))errors.push("cluster uncertainty missing"); return errors; }
