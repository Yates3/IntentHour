# Security and privacy controls

- Authentication cookies are Secure in production, HttpOnly, and SameSite Lax through Better Auth configuration.
- Magic-link tokens expire after five minutes, are single-use, and are hash-stored in D1.
- Turnstile tokens are sent to the Worker and validated with Siteverify; client rendering alone never counts as validation.
- Paddle signatures are computed over the untouched raw request body and rejected outside a five-minute tolerance. `event_id` is stored to prevent duplicate consumption.
- Every cloud query is scoped by the authenticated `user_id`. Sync bodies cannot select another account.
- CSP, frame denial, MIME sniffing protection, restrictive permissions, and referrer policy are returned by the Worker.
- Logs contain request ID, method, route, status, and duration only. Intention and note bodies are not logged.
- DeepSeek receives aggregate facts only; emails, intentions, and free-text notes are excluded before the request is built.
- `.dev.vars`, `.env.local`, output, traces, and test artifacts are ignored. No client bundle should contain server keys.

Before production, rotate any credential exposed outside its secret manager, verify all configured origins/callbacks, enable Cloudflare rate limiting for anonymous email/contact routes, and review dependency advisories without force-upgrading across major versions.
