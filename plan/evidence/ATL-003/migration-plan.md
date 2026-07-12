# ATL-003 migration plan

No database migration is required. ATL-003 publishes and documents the existing
`indicator_history` relations and their existing release/artifact/
transformation lineage. It does not alter stored values, Index inputs,
normalizations, weights, missingness, uncertainty, ranks, or the adopted
source-native Index disposition.

Deployment is additive:

1. ship the country and Compare reader modules;
2. ship the rights-filtered country-history endpoint;
3. retain current rows and indexes unchanged;
4. roll back by removing the surfaces and endpoint if needed, without a data
   reversal.

