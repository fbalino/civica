# CLM-007 browser checks

Production build served locally at `http://127.0.0.1:3107` and exercised with the Playwright CLI.

| Surface | Viewport | Result | Evidence |
|---|---:|---|---|
| Pulse methodology | 1440×1000, full page | Version/status/source/cadence/review/scalar disclosures rendered; no horizontal overflow; stale delta-row caveat absent | [PNG](pulse-methodology-final-desktop.png) |
| Brazil dimensional Pulse | 390×844 | Five named dimensions; nonmoving dimensions use `—`; limited-signal labels and event titles do not collide | [PNG](brazil-pulse-dimensions-mobile-final.png) |
| Brazil current-window events | 390×844 | CI only in masthead; event cards carry the honest current-window label | [PNG](brazil-pulse-panel-mobile-final.png) |
| Liechtenstein dimensional empty state | 390×844 | Explicit no-observation copy and no fabricated zero delta | [PNG](liechtenstein-pulse-dimensions-empty-mobile-final.png) |
| Liechtenstein country events empty state | 390×844 | No `Liechtensteinin` join bug; no horizontal overflow | [PNG](liechtenstein-pulse-empty-mobile-final.png) |
| API docs | 1440×1000 | Generated `/api/v1/pulse/methodology` example and `pulse-v2.1-beta` contract visible | [PNG](api-docs-pulse-method-final.png) |
| Pulse changelog | 1440×1000 | Experimental warning, complete review gates, automatic/human-origin distinction, and mixed-history warning visible | [PNG](pulse-changelog-final-desktop.png) |
| Historical backtest | 1440×1000 | Clearly labelled archived diagnostic, earlier architecture, hand-curated scenarios, not current validation | [PNG](pulse-backtest-final-desktop.png) |

Additional interaction/accessibility checks:

- First `Tab` focused the Civica Atlas home link.
- `prefers-reduced-motion: reduce` emulation returned `true`.
- Desktop methodology and both mobile country pages reported no horizontal overflow.
- Final tested pages reported zero console errors.
- Nonblocking warnings were limited to known unused preload warnings for shared country engravings/CSS; no application exception or failed first-party request occurred.

Earlier before/after screenshots remain in this directory to preserve the mobile overlap repair trail; files suffixed `final` are the acceptance evidence.
