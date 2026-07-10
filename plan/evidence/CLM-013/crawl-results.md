# CLM-013 production crawl results

## Diagnostic crawl

Command:

```text
npm run crawl:metadata -- --base-url=http://localhost:3100 --concurrency=12
```

Result:

```text
Discovered 844 route(s) in sitemap.xml.
Summary: 830/844 route(s) passed the public metadata contract.
Crawl failed: 24 issue(s) across 14 route(s).
```

The diagnostic failure set was fully actionable:

- three Index-namespace pages lacked Beta/research-experiment language in structured metadata (`peer-grouping`, `corrections`, `replication`)
- the redirect-only `/organizations` landing was incorrectly listed as an HTTP-200 sitemap destination
- ten comparison pages exposed HTML-escaped `&amp;` values that the raw-source parser had not decoded, producing 20 canonical/`og:url` comparison errors

## Final crawl

Command:

```text
npm run crawl:metadata -- --base-url=http://localhost:3100 --concurrency=16
```

Result:

```text
Discovered 843 route(s) in sitemap.xml.
Summary: 843/843 route(s) passed the public metadata contract.
Every crawled route satisfies the public metadata contract.
```

The emitted sitemap was fetched twice after the final build. Both responses had the same SHA-256:

```text
dbcfc564a0278b128f51225d070e922fa1cd33d2dac6716e71221d61508470ab
```

This confirms the built sitemap is stable across requests; its dates come from checked-in or stored source state rather than the request clock.
