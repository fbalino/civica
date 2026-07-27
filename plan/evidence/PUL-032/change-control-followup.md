# PUL-032 change-control follow-up

The first v13 change-control entry captured the production contract before the
full claims gate exposed three stale test fixtures. This follow-up updates the
protected runtime contract test to require persisted classifier configuration,
the four closed states, new-before-retry ordering, and the bounded attempt
count. The machine contract now names retry exhaustion as `terminal_failure`
and distinguishes terminal `none` from failure. A new golden test proves that
an authentication failure is terminal on its first attempt. The
data-dictionary and research-retention inventory tests now match the 71-table
and 33-retained-relation schemas.

The retry policy, migration, public prose, and live data did not change. The
v14 entry records the explicit machine-contract fields and corrected fixtures
without rewriting the v13 history.
