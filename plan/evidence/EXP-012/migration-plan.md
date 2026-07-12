# EXP-012 migration and rollback note

No database or asset-byte migration is required. The change adds a shared PageHero disclosure, enriches the existing country/territory link's accessible name, and corrects the licensing/claim registry to describe the checked manifest.

Deploy through the ordinary application release. Existing route URLs and image URLs remain stable. If layout monitoring finds a disclosure collision, keep the policy text and accessible classification intact while correcting the shared `.page-hero-art-disclosure` composition; do not remove the disclosure or revert to page-local variants. A rollback must also roll back the matching public-claim fragment and append a new change-control entry rather than editing history.
