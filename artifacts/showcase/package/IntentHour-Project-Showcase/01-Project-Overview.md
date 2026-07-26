# IntentHour Project Overview

## Positioning

IntentHour is a local-first focus and reflection system for remote knowledge workers. It preserves the outcome someone intended to protect, categorized interruption marks, and the result of the work—not only elapsed time.

The product currently has two clients:

- **Web:** account-free local focus plus optional authenticated Pro history, ended-session sync, CSV export, Paddle Lifetime entitlement, and evidence-backed weekly AI review.
- **Windows Desktop Preview:** account-free local focus, restart recovery, device-local history, system tray lifecycle, and a native target reminder.

## Product status

- Live Web product: <https://intenthour.yates-33.top>
- Windows x64 Desktop Preview: release candidate prepared locally; GitHub Release not yet published
- Version: `1.0.0`
- Installer filename: `IntentHour-Setup-1.0.0.exe`
- Desktop signing: unsigned preview

## Core workflow

1. Choose one concrete outcome.
2. Start a local, reload- or restart-safe Session.
3. Mark categorized interruptions without surveillance.
4. Finish or discard the Session.
5. Review device-local history or, on Pro Web accounts, cloud trends and grounded weekly review.

## Engineering boundaries

- Active timers remain local to the starting device.
- Web Pro sync stores ended Sessions only.
- Pure TypeScript rules in `shared/` keep Web and Desktop lifecycle semantics aligned.
- The Cloudflare Worker owns identity, cloud data access, Paddle entitlement, CSV export, and AI review.
- Desktop is intentionally local-only in this preview; it does not claim account, cloud, billing, export, or AI capability.
- Neither client monitors screens, applications, browser history, or keyboard content.

## Technology

React, TypeScript, Vite, Electron, Dexie/IndexedDB, Cloudflare Workers, Hono, D1, Drizzle, Better Auth, Paddle, DeepSeek-compatible structured review, Zod, Vitest, Playwright, Electron Forge, and Squirrel.

## Further reading

- `02-Recruiter-Overview.md`
- `03-Architecture.md`
- `04-Validation-Summary.md`
- `05-Desktop-Release-Notes.md`
- `06-Demo-Script.md`
- `07-Links.md`
