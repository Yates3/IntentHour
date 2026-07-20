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
- URL: `https://intenthour-staging.ylin99207.workers.dev`
- D1: `intenthour-staging`
- Deploy preview: `npm.cmd run deploy:staging:dry`
- Apply migrations: `npm.cmd run db:migrate:staging`
- Deploy: `npm.cmd run deploy:staging`
- Public E2E: `$env:PLAYWRIGHT_BASE_URL='https://intenthour-staging.ylin99207.workers.dev'; npm.cmd run test:e2e`

Provider status:

- Google OAuth: configured; callback and authorization launch verified.
- Turnstile: configured with a staging-hostname-restricted widget.
- Resend magic links: waiting for a verified sending domain and API key.
- Paddle sandbox: configured with a `$39` one-time price, API key, client token,
  and active webhook destination. Signature rejection, accepted delivery, and
  duplicate-event idempotency are verified; a completed checkout remains the
  final human-in-the-loop acceptance step.

The staging build defaults to the domain-restricted `IntentHour Staging Login`
Turnstile widget. Override `VITE_TURNSTILE_SITE_KEY` only when intentionally
testing another widget. Provide `VITE_PADDLE_CLIENT_TOKEN` in the process
environment when sandbox checkout is ready; never commit Paddle or provider
secrets.

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
- A production OpenAI project key stored only as a Worker secret and a configured spend limit/alert.

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
