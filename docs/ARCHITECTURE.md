# Architecture

## Runtime shape

One Cloudflare Worker owns both the static React application and all `/api/*` requests. Cloudflare Static Assets serves the Vite client bundle; the Hono Worker runs first for API paths. D1 is the durable system of record for authenticated Pro data, while IndexedDB is the system of record for Web guests and active timers.

The repository also contains an unreleased Windows x64 Electron local-focus preview. Its renderer owns an independent Dexie database for device-local guest sessions and reuses shared focus-domain rules. The main process owns single-instance behavior, close-to-tray window lifecycle, and native target reminders. A narrow validated IPC bridge schedules or cancels fixed notifications. Electron Forge and Squirrel produce local unpacked and per-user installer artifacts, but Desktop does not own cloud synchronization, authentication, billing, code signing, automatic updates, or release publishing.

```mermaid
flowchart LR
  B[Browser] -->|static assets| W[Cloudflare Worker]
  B -->|guest sessions| I[(IndexedDB)]
  B -->|authenticated API| H[Hono API]
  H --> A[Better Auth]
  H --> D[(D1)]
  H --> P[Paddle]
  H --> O[DeepSeek Chat Completions API]
  H --> R[Resend]
  B --> T[Turnstile widget]
  H --> T2[Turnstile Siteverify]
  E[Electron Desktop renderer] --> ED[(Desktop IndexedDB)]
  E --> S[Shared pure domain rules]
  B --> S
  H --> S
```

## Desktop process boundary

- `desktop/main.ts` owns the single-instance lock, application/window lifecycle, singleton Tray, native Notification, navigation blocking, popup denial, and permission denial.
- `desktop/preload.cts` exposes immutable runtime metadata plus fixed schedule/cancel/delivery notification methods through `contextBridge`; no generic IPC surface exists.
- `desktop/window-lifecycle.ts` owns close-to-hide, show/focus, explicit quit, second-instance handling, and tray singleton behavior behind injectable interfaces.
- `desktop/notification-scheduler.ts` owns one-shot main-process scheduling and Session-ID deduplication. `desktop/notification-state.ts` persists delivered Session IDs under Electron `userData`, outside the shared Session schema.
- `desktop/renderer/` is a local React/Vite client with a restrictive CSP, no Node.js access, and an independent `intenthour-desktop-v1` Dexie database.
- `desktop/security.ts` is the checked source for BrowserWindow security preferences.
- `forge.config.cjs` defines the Windows x64 Squirrel package boundary. It whitelists only compiled Desktop runtime files, minimal runtime dependencies, and local branding assets into the ASAR.
- `scripts/run-desktop-make.mjs` stages Forge work in a temporary ASCII-only path before copying verified output back to `out/`, avoiding Squirrel resource-tool failures when the repository path contains non-ASCII characters.
- `shared/` remains the intended reuse boundary for framework-independent focus rules. Electron runtime types and behavior stay in `desktop/`.
- Web and Cloudflare deployment remain independent from Desktop compilation, local-flow tests, smoke validation, packaging, and release artifacts.

## Data authority

- Guests: completed records, interruptions, and active timer state stay in IndexedDB. Ended records older than seven days are removed; running and paused records are preserved.
- Pro users: completed records sync to D1. Active timers remain on the device that started them.
- Client-created business IDs are UUIDs. The API always derives `user_id` from the authenticated cookie and never accepts another account identifier from the body.
- Session conflicts use the latest ISO `updated_at`. Entitlements, Paddle events, and AI output are always server-authoritative.
- First Pro sync uploads only local completed records still inside the free seven-day window.

## AI privacy boundary

The model receives deterministic aggregates only: session counts, focused minutes, outcome totals, time buckets, and interruption-category counts. It never receives email, intention text, or free-text notes. The model selects two suggestions and fixed `evidenceKey` values; the API renders evidence from computed facts and caches the result permanently for that ISO week. Under three valid sessions, no model call is made.

## Billing state

The browser requests a transaction ID from `POST /api/billing/checkout`; the Worker embeds the authenticated user ID and configured price. A Paddle `checkout.completed` browser event only shows a pending state. Verified, idempotently recorded webhooks grant or revoke the entitlement. Full approved refunds and chargebacks revoke Pro; partial refunds are recorded for manual review.

## Key API routes

| Route | Authority | Purpose |
| --- | --- | --- |
| `/api/auth/*` | Better Auth | OAuth, magic link, callback and session |
| `POST /api/sync/push` | Pro server guard | Idempotent completed-record upload |
| `GET /api/sync/pull?cursor=` | Pro server guard | `(updated_at,id)` incremental pull |
| `POST /api/billing/checkout` | Authenticated server | Create trusted Paddle transaction |
| `POST /api/webhooks/paddle` | Paddle HMAC | Grant/revoke entitlements |
| `GET /api/me/entitlement` | Server | Current verified access |
| `GET/POST /api/reviews/:isoWeek` | Pro + consent | Read/generate cached review |
| `GET /api/export.csv` | Pro server guard | Stream account-owned history |
| `DELETE /api/me` | Authenticated server | Delete application account data |
