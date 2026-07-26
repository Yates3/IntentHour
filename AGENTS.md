# IntentHour Agent Instructions

These instructions are for Codex and other AI agents working in this repository. Follow the current code and verified behavior over stale documentation. Do not expand the product scope or restructure the repository unless the user explicitly asks for that work.

## 1. Product scope

IntentHour is a production-oriented focus and reflection micro-SaaS for remote knowledge workers. Guests can choose one concrete outcome, run a reload-safe local timer, mark interruptions, and complete a session without an account. Pro Lifetime adds authenticated cloud history, cross-device completed-session sync, CSV export, Paddle-based entitlement, and one evidence-backed AI review for each completed ISO week.

The repository includes a published Windows x64 Electron local-focus Preview and local Squirrel packaging. Desktop currently supports device-local guest focus sessions and history only; it does not include authentication, cloud sync, Pro, billing, AI review, code signing, or automatic updates. Current v1 still excludes subscriptions, teams, mobile apps, browser extensions, real-time cross-device active timer handoff, calendar integrations, screen/app/browser monitoring, advertising pixels, and XorPay for the US launch. Do not add these or adjacent features unless the user explicitly changes the scope.

## 2. Repository map

- `src/`: React, TypeScript, and Vite client code. It owns the browser UI, IndexedDB-backed guest mode, local timer lifecycle, Paddle checkout launcher, and API clients.
- `desktop/`: Electron main/preload security boundary plus the React renderer and its independent Dexie database. It owns device-local guest focus sessions, local history, single-instance/window lifecycle, the system tray, target-reached notifications, and local packaging assets; it does not own cloud sync, authentication, billing, code signing, updates, or publishing.
- `worker/`: Cloudflare Worker server code. It owns Hono API routes, Better Auth integration, D1 access, Paddle billing and webhook handling, AI review generation, CSV export, security headers, and account deletion.
- `shared/`: Framework-independent Zod contracts, TypeScript types, deterministic review facts, and CSV helpers shared by client, Worker, and tests.
- `migrations/`: D1 SQL migrations. Database shape changes must be represented here as well as in the Drizzle schema.
- `tests/unit/`: Vitest coverage for pure helpers, local IndexedDB behavior, time math, Paddle signatures, AI review validation, security helpers, and shared schemas.
- `tests/e2e/`: Playwright coverage for browser flows and API-boundary behavior. External provider flows may still require manual verification.
- `docs/`: Human-facing architecture, deployment, security, maintenance, visual, and project-knowledge documentation.

Do not claim or create `apps/`, `services/`, or `packages/` structure unless a future task explicitly requires a repository migration.

## 3. Dependency direction

- `src/` may depend on `shared/`, browser APIs, and public `/api/*` endpoints. It must not import `worker/` internals.
- `worker/` may depend on `shared/`, D1/Drizzle, Hono, Better Auth, Paddle, Resend, Turnstile, and the DeepSeek/OpenAI-compatible client.
- `desktop/` may depend on `shared/` pure domain code. Electron runtime APIs must remain in the main or preload process; renderer code must not import Node.js or Electron.
- `shared/` must not import or depend on React, Cloudflare Worker runtime APIs, D1, Paddle SDK, Resend SDK, Turnstile SDK, or other vendor runtimes.
- Cross-client and server-compatible pure TypeScript types, Zod schemas, and serializable protocols may live in `shared/`.
- Server-only vendor raw payloads, SDK types, and provider processing logic must remain in `worker/`.
- Database reads and writes must happen only on the server side. Browser code may use IndexedDB for local guest and device-local data.
- The client must never create or trust Pro entitlement on its own.
- New business payloads and domain structures should use the shared contract layer first. Current primary contracts live in `shared/contracts.ts`, and future behavior-preserving splits may place domain contracts in multiple `shared/` files. If older code duplicates a structure, new code must not extend that duplication; migrate gradually when the touched area makes it safe.

## 4. Sources of truth

- Pro entitlement is determined by Paddle webhook processing persisted in D1 `entitlements`.
- Browser `checkout.completed` events may show pending UI only; they must not unlock Pro.
- AI weekly review evidence must come from deterministic server-side facts, not model-generated numbers.
- AI model output must be validated with the current Zod schema and must retain a deterministic fallback for invalid or unavailable output.
- D1 stores ended cloud sessions only: `completed` and `discarded`. Active `running` and `paused` timer state is device-local.
- Guest active timer state and local free history are owned by IndexedDB and the local session lifecycle.
- The shared contract layer is the source of truth for API and cross-module payloads. Current primary contracts live in `shared/contracts.ts`; future splits inside `shared/` must preserve a single source of truth instead of hand-writing the same structure separately in the client, Worker, and tests.
- Database structure is defined by `worker/db/schema.ts` plus `migrations/`. Keep both aligned.
- Never introduce a second independent source for entitlement, AI evidence, session ownership, or database shape.

## 5. Security and privacy invariants

- Never commit API keys, tokens, passwords, `.dev.vars`, `.env.local`, generated secret output, or provider credentials.
- AI weekly review requests must not include user intention text, outcome notes, interruption notes, email addresses, or other free-text private content. Send only allowed aggregates.
- Paddle webhooks must verify the untouched raw request body signature before processing.
- Every authenticated query or mutation must derive `user_id` from the server-side auth session and scope data to that user.
- Account deletion changes must check both application-data deletion and the boundary that external Paddle legal/transaction records are not deleted by the app.
- Do not temporarily disable authentication, authorization, webhook signature verification, Turnstile server verification, security headers, or ownership checks for debugging.
- Logs must not include intention text, notes, secrets, raw provider credentials, or sensitive payload bodies.

## 6. Change rules by area

### Client changes

- Keep guest mode usable without an account.
- Preserve reload recovery, pause/resume behavior, local persistence, and wall-clock timer correctness.
- Do not create trusted entitlement, user identity, price, or plan state in the client.
- When changing the focus lifecycle, check start, pause, resume, interruption marking, finish, discard, refresh, and sleeping-tab behavior.

### Desktop changes

- Keep `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, and `webviewTag: false`.
- Load only repository-owned local renderer content. Deny unrequested permissions, new windows, and navigation outside the approved local entry point.
- Do not expose generic IPC, filesystem, shell, process, credential, or Electron APIs through preload. Add narrowly typed allowlisted methods only when a real feature requires them.
- Keep desktop focus behavior dependent on shared domain rules rather than copying Web hook logic.
- Keep tray, window lifecycle, and native notifications in the main process. Renderer access must remain limited to the fixed, validated target-notification bridge.
- Do not claim cloud sync, signing, updates, or a published release until each capability exists and is verified. Packaging claims must distinguish locally generated/installed artifacts from a public release.

### API changes

- Validate all inputs. Prefer shared Zod contracts for new or changed payloads.
- Check authentication, user ownership, error responses, idempotency, and rate/security boundaries.
- Do not duplicate existing domain rules inside a single route when a shared helper or contract should own them.
- Keep API responses free of secrets and private provider internals.

### Database changes

- Use migrations for schema changes. Do not update only `worker/db/schema.ts`.
- Consider existing data, cascade deletion, indexes, conflict handling, rollback/compensating migration risk, and staging/production separation.
- Do not change the local-first boundary for active timers without explicit product approval.

### Billing changes

- Paddle webhook handling is the entitlement source of truth.
- Preserve raw-body signature verification and event idempotency.
- Full approved refunds and chargebacks must revoke the corresponding entitlement; partial refunds require manual review behavior unless the product rule changes.
- Do not let frontend parameters decide trusted price, plan, user ID, or entitlement.

### AI review changes

- Send only deterministic aggregate data to the model.
- Validate output with `weeklyReviewOutputSchema` or the current real shared schema.
- Evidence text must be constructed by the server from computed facts.
- Keep a deterministic fallback for model failure or invalid output.
- Never treat model-generated text as factual metrics.

## 7. Validation matrix

Use only scripts that exist in `package.json`.

- Shared contracts or TypeScript types: run `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run test`.
- Client UI, local timer, IndexedDB, sync client, or Paddle launcher: run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run test:e2e` when the user flow can be affected.
- Worker API, auth, sync, export, security headers, or account deletion: run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and relevant `npm.cmd run test:e2e` coverage.
- Database schema or migrations: run `npm.cmd run db:generate` only when generating a migration is intended, then `npm.cmd run db:migrate:local`, `npm.cmd run typecheck`, `npm.cmd run test`, and relevant E2E/API checks.
- Paddle billing or webhook logic: run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run test:e2e`; real sandbox checkout/refund behavior currently requires manual verification.
- AI weekly review logic: run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`; real provider generation currently requires configured secrets, Pro entitlement, consent, and enough completed sessions.
- Wrangler or Cloudflare binding/config changes: run `npm.cmd run cf-typegen`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run build`, and a dry-run deploy check. For default or production Worker configuration changes, run `npm.cmd run deploy:dry`. For staging deployment configuration changes, run `npm.cmd run deploy:staging:dry`. Do not run a real deployment command unless the user explicitly asks for deployment.
- Core user-flow changes: run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run test:e2e`, and `npm.cmd run build`.
- Desktop main, preload, renderer, local storage, or security-boundary changes: run `npm.cmd run typecheck`, `npm.cmd run desktop:typecheck`, `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run desktop:test`, `npm.cmd run desktop:smoke`, and `npm.cmd run desktop:build`.
- Desktop packaging changes: run the Desktop validation above, then `npm.cmd run desktop:package` and `npm.cmd run desktop:make`. Inspect the packaged ASAR and Authenticode status, install the generated artifact, and run `npm.cmd run desktop:test:installed`; installer elevation, SmartScreen, shortcuts, reinstall, and uninstall behavior also require explicit Windows acceptance evidence. These commands do not authorize publishing.
- Full pre-submit verification order: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run test:e2e`, `npm.cmd run build`.

If an external-provider or production-only path has no reliable automated coverage, report it as manual verification required. Do not claim it passed unless it was actually verified.

## 8. Documentation update rules

- Update `docs/ARCHITECTURE.md` when system boundaries, data authority, API ownership, or module relationships change.
- Update `docs/DEPLOYMENT.md` when deployment steps, environments, secrets, provider configuration, domains, or rollback guidance change.
- Update `docs/SECURITY.md` when authentication, authorization, privacy, logging, AI data handling, webhook verification, Turnstile, CSP, or cookie behavior changes.
- Update `docs/MAINTENANCE.md` when recurring checks, incident response, backup, provider monitoring, or operational procedures change.
- Update `docs/PROJECT_KNOWLEDGE.md` after meaningful product, architecture, storage, deployment, bug-fix, known-issue, or release-status changes.
- Update `README.md` when product presentation, local setup, validation, provider setup summary, or repository map changes.
- Update this root `AGENTS.md` when repository directory responsibilities, dependency direction, system sources of truth, security invariants, validation scripts, task completion format, or prohibited actions change.

Fast-changing deployment status, provider-console status, one-off staging results, and current database record counts must not be written as permanent architecture facts. Do not put temporary status, one-time test results, or current provider-console state in `AGENTS.md`. If documentation conflicts with current code or verified runtime behavior, treat code and verification as authoritative and correct the documentation in the relevant task.

## 9. Prohibited actions

- Do not perform a full Monorepo migration without an explicit user request.
- Do not introduce microservices, message queues, Docker, Kubernetes, or a new programming language to create unnecessary complexity.
- Do not replace Better Auth, D1, Dexie, Paddle, Cloudflare Workers, or the current React/Vite architecture without explicit approval.
- Do not mix unrelated refactors into a targeted fix.
- Do not redefine schemas or domain rules that already exist in `shared/`.
- Do not skip relevant validation and then claim the task is complete.
- Do not commit, push, deploy, or open a pull request unless the user explicitly requests it.
- Do not delete or reset user data, local databases, D1 data, or provider records without explicit approval and a verified target.
- Do not use destructive Git commands such as `git reset --hard`, forced checkout, or force push to overwrite uncommitted work.

## 10. Task completion format

When completing a code or configuration task, report:

- What changed.
- Why it changed.
- Which system boundaries were involved.
- Which validation commands were run.
- Which validations were not run and why.
- Remaining risks or manual checks.
- Whether documentation needs to be updated.

Keep completion reports evidence-based. Do not imply deployment, provider verification, payment success, AI generation, or browser behavior was verified unless it was actually observed in the current task.
