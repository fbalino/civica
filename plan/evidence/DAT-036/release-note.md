# DAT-036 future release note

Civica corrected how Wikidata observation dates are represented. Earlier
Atlas data could display a year-only Wikidata date as January 1, or a
month-only date as the first day of that month. Values were not changed by this
representation fix. Corrected records retain the publisher's actual
year/month/day precision and leave `as_of` empty unless Wikidata supplied day
precision.

The frozen `atlas-2026-07-11` G2 release remains immutable and retains this
known limitation. A later named release will carry corrected structured
publisher dates in `value_json.publisherDate` and link the repair through the
public correction and change-history surfaces.
