# PLT-016 source review — 2026-07-15

## Next.js official documentation

- [Instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
  — consulted 2026-07-15. It documents the stable root `instrumentation.ts`
  convention and the `onRequestError` hook with request context for server-side
  errors.
- [after](https://nextjs.org/docs/app/api-reference/functions/after) — consulted
  2026-07-15. It documents deferred work after the response and logging or
  analytics as a supported use case, including Route Handlers and Proxy.
- [Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) —
  consulted 2026-07-15. It documents Proxy's Node runtime default in Next 16
  and cautions against treating Proxy as an authorization boundary.

## Applied decision

Use the Node Proxy only to start a timer and schedule a content-free,
route-template observation after response completion. Use instrumentation for
the independent server-error counter and the shared cron wrapper for job
duration. No instrumentation callback receives a raw error value for storage.
