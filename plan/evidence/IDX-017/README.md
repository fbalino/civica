# IDX-017 evidence — longitudinal responsiveness and revisions

The protocol was committed in `ad57836` before BR events or V-Dem revision effects were calculated. Exact QoG Jan24/Jan25/Jan26 and V-Dem v14/v15 captures were frozen under IDX-040.

On 55 usable independently coded BR transitions, K1 direction accuracy is 74.5% (95% cluster interval 63.3%–85.0%) and median signed t−1→t+1 movement is five points (three to seven). Mean response peaks in transition year. In 2,890 quiet periods, median absolute change is one point, the 95th percentile is four, and the event-to-quiet median ratio is five.

The isolated V-Dem v14→v15 source revision changes 526 of 3,088 comparable rounded K1 scores, with median zero, 95th percentile one, and maximum two points. QoG label-edition stability passes Jan25→Jan26 at 99.2% common-window Jaccard but fails Jan24→Jan26 at 84.9%; this adverse benchmark-revision result remains visible.

Lag-one autocorrelation is 0.9965 for score levels and 0.1107 for annual changes, so persistence in levels cannot substitute for change reliability.

`npm run validate:index-longitudinal-preregistration`, `npm run validate:index-longitudinal`, focused bootstrap tests, exact archive hashes, and TypeScript pass. No missing event endpoint is imputed.
