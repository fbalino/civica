# CLM-020 release note

Civica corrected how publisher measures appear beside publisher names.

- **Country Rankings table.** Freedom House's row shows its status with the
  Freedom in the World edition, for example "Free · Freedom in the World
  2024", and no number. Civica's frozen release stored Freedom House's two
  ratings but not its status column, so an information note explains that the
  status comes from Freedom House's own published rule. The table had shown a
  Civica 0 to 100 rescale of those ratings as Freedom House's score ("Free
  (100/100)" for 41 of 190 countries); Freedom House's own Total Score reaches
  100 for one country.
- The V-Dem row shows V-Dem's own Liberal Democracy Index figure at V-Dem's
  published precision (0.769 for Uruguay) and no longer shows a Civica rank.
- Each row names its publisher edition, the year the figure describes, and the
  retrieval time recorded in the release's input manifest. The chip beside
  each measure reads "Civica release · 2024 Q4", naming the Civica release
  that holds the row.
- The table no longer carries the legacy Human Development Index and
  Corruption Perceptions Index rows. Both measures remain on the page, with
  their editions and provenance, in Governance Evidence, Indicator History,
  and Civica Conditions.
- **Civica Conditions.** The 0 to 100 Human Development and Peace & Security
  positions carry a "Civica calculation" marker and their formulas on the
  country page and in the explorer, whose position column is headed "Civica
  calculation / year". The comparison view shows the publisher components
  only. `GET /api/v1/conditions` labels every scored position with
  `scoreOrigin`.
- **API.** `GET /api/countries/:slug/scores` returns
  `country-publisher-scores/v2` rows with their origin and clocks, withholding
  publisher values whose terms do not permit public export.

Known limitation: the Human Development values the current Conditions release
labels 2023 repeat UNDP's 2022 figures. CLM-021 will correct them in a new
release once the owner chooses the Human Development Report edition. Other
places where a Civica calculation still sits beside a publisher's name are
listed in `plan/evidence/CLM-020/follow-ups.md`.
