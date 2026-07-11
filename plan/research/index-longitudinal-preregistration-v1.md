# Index longitudinal validation preregistration v1

**Protocol:** `civica-index-longitudinal-validation/v1`  
**Status:** locked before BR event and revision results

Known changes are country-years where the frozen BR democracy state changes. Responsiveness uses the signed K1 movement from the year before the transition through the year after it. Direction accuracy must reach 70%, and median signed movement must reach five points. Lead/lag means are reported from −2 through +2 years; the largest absolute signed response should occur at transition year or one year later.

Quiet periods have unchanged BR state and no transition within one year. Their median absolute annual K1 movement must be no more than two points and the 95th percentile no more than ten. Median signed event movement must be at least twice median quiet movement. These are noise controls, not a claim that BR captures every institutional change.

Revision sensitivity compares QoG Jan24/Jan25/Jan26 BR event sets and recomputes K1 after replacing only V-Dem v15 LDI with exact v14 values. QoG event-edition agreement must reach 90%. The median absolute K1 source-revision shift must be at most one point and its 95th percentile at most three.

All missing endpoints and labels are excluded without imputation and counted. Direction accuracy, signed movement, and quiet movement receive 2,000 deterministic jurisdiction-cluster bootstrap intervals. BR coding is an external criterion, not ground truth, and responsiveness does not establish causality.
