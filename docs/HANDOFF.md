# IntentHour Project Handoff

## Project overview

IntentHour is one product system with a Web client, Windows Desktop Preview, shared focus-domain rules, and a Cloudflare Worker API. The Web product has authenticated cloud capabilities. Desktop is an unreleased local-only preview.

Read these first:

1. [AGENTS.md](../AGENTS.md)
2. [README.md](../README.md)
3. [ARCHITECTURE.md](ARCHITECTURE.md)
4. [SECURITY.md](SECURITY.md)
5. [DEPLOYMENT.md](DEPLOYMENT.md)
6. [MAINTENANCE.md](MAINTENANCE.md)

## Current entry points

- Live Web: [https://intenthour.yates-33.top](https://intenthour.yates-33.top)
- Local Web default: `http://127.0.0.1:4317`
- Desktop development: `npm.cmd run desktop:dev`
- Desktop release: prepared locally under `out/`; GitHub Release pending

## Repository structure

| Path | Responsibility |
| --- | --- |
| `src/` | Web React UI, browser IndexedDB, focus orchestration, auth/billing/API clients |
| `desktop/` | Electron main/preload/renderer, Desktop IndexedDB, tray, notification, packaging assets |
| `shared/` | Pure domain rules, Zod contracts, deterministic facts, CSV helpers |
| `worker/` | Hono API, Better Auth, D1, Paddle, AI review, export, security |
| `migrations/` | D1 SQL migrations |
| `tests/unit/` | Domain, contracts, storage, billing, AI, security, packaging |
| `tests/e2e/` | Web browser and API-boundary Playwright tests |
| `tests/desktop/` | Real Electron product-flow tests |
| `tests/desktop-installed/` | Installed/unpacked release acceptance |
| `docs/` | Architecture, operations, case study, recruiter and handoff material |
| `artifacts/showcase/` | Public screenshots, release notes, demo and delivery package |

## Environment requirements

- Node.js 24+ and npm 11+ for the main development runtime.
- Windows x64 for Squirrel packaging and installed-app acceptance.
- Chromium installed through Playwright for Web E2E.
- Node `22.23.1` is fetched by the Playwright web-server command for isolated E2E Vite startup.
- Wrangler authentication only when a Cloudflare command actually needs remote access.

Install:

```powershell
npm.cmd install --legacy-peer-deps
```

The legacy peer flag is currently required by the Better Auth optional peer tree.

## Web local run

```powershell
Copy-Item .dev.vars.example .dev.vars
Copy-Item .env.example .env.local
npm.cmd run db:migrate:local
npm.cmd run dev -- --host 127.0.0.1 --port 4317
```

Guest focus works without external-provider credentials. Keep `.dev.vars` and `.env.local` untracked.

## Desktop local run

```powershell
npm.cmd run desktop:typecheck
npm.cmd run desktop:dev
```

Desktop does not use the Web database. It has an independent Electron user-data directory and Dexie database.

## Desktop packaging

```powershell
npm.cmd run desktop:build
npm.cmd run desktop:package
npm.cmd run desktop:make
```

`desktop:make`:

1. Builds main, preload, and renderer.
2. Runs Forge/Squirrel under a unique ASCII temporary directory.
3. Copies verified output to `out/`.
4. Generates `RELEASE_NOTES.md` and `SHA256SUMS.txt`.
5. Leaves publishing to a separate explicit action.

Expected release directory:

```text
out/make/squirrel.windows/x64/
```

The installer is intentionally not tracked in Git.

## Worker local run

The Vite Cloudflare plugin serves the Web and Worker together:

```powershell
npm.cmd run db:migrate:local
npm.cmd run dev -- --host 127.0.0.1 --port 4317
```

Generate binding types after Wrangler binding changes:

```powershell
npm.cmd run cf-typegen
```

## Environment variable classes

### Public build configuration

Names prefixed with `VITE_` may be present in the browser bundle. Current examples include Paddle environment/client token and Turnstile site key. A public token or site key is not a server secret, but it must still be scoped in the provider console.

### Server secrets

Better Auth, Google OAuth, Resend, Paddle API/webhook, Turnstile secret, and AI-provider keys belong in `.dev.vars` locally and Worker Secrets remotely. Never put their values in documentation, screenshots, tests, Git, or client code.

Use `.dev.vars.example` and `.env.example` for names and safe placeholders. Do not copy current local values into handoff material.

## Database migrations

- Drizzle model: `worker/db/schema.ts`
- SQL migrations: `migrations/`
- Generate intentionally: `npm.cmd run db:generate`
- Apply locally: `npm.cmd run db:migrate:local`
- Apply staging: `npm.cmd run db:migrate:staging`

Do not change the Drizzle schema without a migration. D1 migrations are forward-oriented; export remote data and prepare a compensating migration before risky changes.

## Validation commands

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run desktop:typecheck
npm.cmd run desktop:test
npm.cmd run desktop:smoke
npm.cmd run desktop:build
npm.cmd run desktop:make
```

For an installed artifact, install the exact generated installer and run:

```powershell
npm.cmd run desktop:test:installed
```

Playwright Web E2E owns its server. Do not manually pre-start Vite. The server uses `127.0.0.1:41739`, `strictPort`, no reuse, and an isolated Node `22.23.1` runtime.

## Deployment

Cloudflare commands:

```powershell
npm.cmd run deploy:dry
npm.cmd run deploy:staging:dry
```

Real deployment requires explicit authorization:

```powershell
npm.cmd run deploy
npm.cmd run deploy:staging
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for provider gates. Never infer that a local or dry-run check proves OAuth, Paddle, Resend, Turnstile, or AI-provider production behavior.

## Rollback

- Worker: use Cloudflare version rollback for application code.
- D1: do not delete or reset remote data; use an export and tested compensating migration.
- Desktop Preview: remove the GitHub Release asset/release if necessary and publish a new version; do not replace a published binary without changing the checksum and release evidence.
- Local source: do not use destructive Git commands over uncommitted work.

## Desktop local data

Electron owns the Windows `userData` path for IntentHour. The exact path is resolved by Electron and must not be hard-coded into public documentation. The `intenthour-desktop-v1` IndexedDB database stores local Sessions and interruptions; a main-process metadata file records delivered reminder Session IDs.

Uninstall acceptance confirmed that application registration, standard shortcuts, and product processes are removed. User data is retained intentionally. Squirrel may leave a small deferred-cleanup installation shell until Windows releases it.

## Release files

- Source Release Notes: `desktop/packaging/RELEASE_NOTES.md`
- Public Release Notes: `artifacts/showcase/release/desktop-preview-release-notes.md`
- Generated installer/checksum: `out/make/squirrel.windows/x64/`
- Lightweight recruiter package: `artifacts/showcase/IntentHour-Project-Showcase.zip`

The public release SHA must be regenerated from the exact installer being uploaded.

## Current limitations

- Desktop account, cloud history, Pro, CSV, billing, and AI review are not implemented.
- Web/Desktop ended-session sync is not implemented.
- No real-time active timer handoff.
- No automatic updates, code signing, macOS, or Linux release.
- SmartScreen may warn for the unsigned installer.
- Provider console and production environment state require live verification.
- The repository does not currently include an explicit license file.
- `npm audit --omit=dev` reports zero production vulnerabilities, while the full development/build toolchain audit currently reports 42 transitive advisories (1 critical, 34 high, 4 moderate, 3 low), concentrated in Cloudflare and Electron packaging dependencies. Review compatible upstream updates before the public Desktop release; do not apply forced major downgrades as an automatic fix.

## Common issues

### `npm.ps1` is blocked

Use `npm.cmd`.

### `rg.exe` reports Access Denied

Use PowerShell `Get-ChildItem | Select-String`.

### Web E2E server exits or changes ports

Do not start Vite manually. Confirm `playwright.config.ts` still uses the Node `22.23.1` server helper, `127.0.0.1:41739`, and no server reuse.

### Squirrel fails under a Chinese repository path

Use `npm.cmd run desktop:make`; do not bypass `scripts/run-desktop-make.mjs`.

### Desktop appears closed but is still running

Normal close hides the window to the tray. Use the Tray Quit action for a user exit.

### OAuth returns a callback error

Verify the live OAuth-start `redirect_uri` and provider-console origin/callback configuration. Do not rely only on environment files.

## Files that must never be committed

- `.dev.vars`, `.dev.vars.*` except the example
- `.env`, `.env.*` except the example
- API keys, OAuth secrets, tokens, passwords
- `.wrangler/`
- `node_modules/`, `dist/`, `out/`, Playwright reports and test results
- Local IndexedDB/D1 state
- Browser profiles, cookies, payment records, or private screenshots

## Maintenance boundary

Before changing code, read [AGENTS.md](../AGENTS.md). Update architecture, security, deployment, maintenance, project knowledge, README, and AGENTS only when their owned facts change. Code and verified runtime behavior override stale prose.
