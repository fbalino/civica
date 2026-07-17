# PLT-018 source review — 2026-07-16

## Next.js official documentation

- [Instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
  — consulted 2026-07-16. It documents the root `instrumentation.ts`
  convention and `onRequestError` request context used to bind a server failure
  to a canonical route without persisting its error value.
- [productionBrowserSourceMaps](https://nextjs.org/docs/app/api-reference/config/next-config-js/productionBrowserSourceMaps)
  — consulted 2026-07-16. It confirms that enabling browser maps makes them
  publicly served unless the deployment platform protects them.

## Vercel official documentation

- [Protected Source Maps](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/protected-source-maps)
  — consulted 2026-07-16. It documents the project-level Deployment Protection
  setting, authenticated project/deployment access, and the project-owner
  opt-in required for existing projects.
- [Runtime Logs](https://vercel.com/docs/observability/runtime-logs) — consulted
  2026-07-16. It documents deployment/runtime log inspection, which remains the
  owned alert channel for this single-owner project.

## Applied decision

Enable Turbopack debug IDs and server maps, but generate browser maps only when
the deployment has both the Vercel platform protection setting and the explicit
`VERCEL_PROTECTED_SOURCEMAPS=true` deployment variable. Civica stores the
release/source-map identity, never an exception value or source-map payload.
The platform owner must enable and verify the external protection before the
variable is set; the code refuses the unsafe unconditional browser-map flag.
