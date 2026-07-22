# Deployment and launch gates

## Environments

Use separate D1 databases, OAuth applications, Paddle webhook destinations, Turnstile widgets, Resend domains, and secrets for development, staging, and production. Do not point a preview Worker at production data.

## First Cloudflare setup

1. Authenticate Wrangler: `npx.cmd wrangler login`.
2. Create databases: `npx.cmd wrangler d1 create intenthour-staging` and `npx.cmd wrangler d1 create intenthour-production`.
3. Replace the placeholder `database_id` in `wrangler.jsonc` or add explicit `env.staging` and `env.production` blocks.
4. Apply migrations with the intended environment flag before deploying.
5. Add every server secret with `npx.cmd wrangler secret put NAME` in the matching environment.
6. Provide `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_ENVIRONMENT=production`, and `VITE_TURNSTILE_SITE_KEY` to the production build.
7. Run the complete validation commands from the README, then `npm.cmd run deploy:dry` and `npm.cmd run deploy`.

## Current staging environment

- Worker: `intenthour-staging`
- Primary URL: `https://intenthour.yates-33.top`
- Workers.dev URL: `https://intenthour-staging.ylin99207.workers.dev`
- D1: `intenthour-staging`
- Deploy preview: `npm.cmd run deploy:staging:dry`
- Apply migrations: `npm.cmd run db:migrate:staging`
- Deploy: `npm.cmd run deploy:staging`
- Public E2E: `$env:PLAYWRIGHT_BASE_URL='https://intenthour-staging.ylin99207.workers.dev'; npm.cmd run test:e2e`

Provider status:

- Google OAuth: code and Worker configuration use the custom-domain callback
  `https://intenthour.yates-33.top/api/auth/callback/google`. Google Cloud
  Console must include that exact Authorized redirect URI; otherwise Google
  returns `redirect_uri_mismatch` before Better Auth can complete login.
- Turnstile: configured for both `intenthour.yates-33.top` and
  `intenthour-staging.ylin99207.workers.dev`.
- Resend magic links: waiting for a verified sending domain and API key.
- DeepSeek weekly reviews: code and schema validation are configured for
  `deepseek-v4-flash`, the `DEEPSEEK_API_KEY` Worker secret is present, and the
  public configuration reports AI reviews enabled. A real generation remains
  pending until an account has at least three sessions in a completed ISO week.
- Paddle sandbox: configured with a `$39` one-time price, API key, client token,
  and active webhook destination. Signature rejection, accepted delivery, and
  duplicate-event idempotency are verified. A completed `$39` checkout has
  activated exactly one Pro entitlement through `transaction.completed`, and
  the first completed local session has synced to D1.

Staging Worker version `5f05da69-29e6-46b2-8b69-1d53789a111e` was deployed on
2026-07-22 after moving staging auth to the custom domain. Local validation
passed typecheck, lint, and 25 unit tests. Public custom-domain Playwright checks
for API boundaries, guest focus, Pro sync mocking, and pause/reload behavior
passed on Chromium: 5 passed, 1 mobile-only skip. CSV exports also neutralize
leading spreadsheet formula characters in user-authored text.

The staging build defaults to the domain-restricted `IntentHour Staging Login`
Turnstile widget. Override `VITE_TURNSTILE_SITE_KEY` only when intentionally
testing another widget. Provide `VITE_PADDLE_CLIENT_TOKEN` in the process
environment when sandbox checkout is ready; never commit Paddle or provider
secrets. If Cloudflare Web Analytics is enabled for the custom domain, CSP must
allow `https://static.cloudflareinsights.com` in `script-src` and
`https://cloudflareinsights.com` in `connect-src`.

The build has a post-build guard that deletes any `.dev.vars` accidentally copied into temporary output. Deployment must still be inspected for secrets before release.

## External provider gates

The code can be fully demonstrated locally and in Paddle sandbox, but a public commercial launch additionally requires:

- A verified domain and production Worker route.
- Google OAuth consent/app credentials with exact Better Auth callback URLs.
- A verified Resend sending domain and public contact address.
- A production Turnstile site key/secret pair for the final hostname.
- Paddle merchant approval, approved domain, `$39` one-time v1.x product/price, client token, API key, and webhook secret.
- Paddle webhook subscriptions for transaction completion and adjustment/refund/chargeback updates.
- Public privacy, terms, refund, and contact pages with final legal entity/contact details.
- A production DeepSeek API key stored only as a Worker secret and a configured spend limit/alert.

## Paddle sandbox acceptance

1. Sign in with a sandbox-capable test account.
2. Request checkout and confirm the browser receives only a transaction ID.
3. Complete a sandbox payment and keep the UI locked until the verified webhook is processed.
4. Confirm `/api/me/entitlement` changes to Pro.
5. Open a second browser, sign in as the same account, and verify completed-session sync.
6. Send a duplicate webhook and confirm it is consumed once.
7. Approve a full sandbox refund and confirm Pro is revoked; verify a partial refund is recorded without automatic revocation.

## Rollback

Worker deployments are versioned by Cloudflare; roll back application code independently from D1. Database migrations are forward-only by default. Before schema changes, take a D1 export and write a tested compensating migration instead of deleting production tables.
