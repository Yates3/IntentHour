# IntentHour — Recruiter Overview

## One-line positioning

IntentHour is a local-first focus and reflection system for remote knowledge workers, delivered as a deployed Web product and an installable Windows Desktop Preview.

## Product entry points

- Live Web: [https://intenthour.yates-33.top](https://intenthour.yates-33.top)
- Windows Desktop: [download the 1.0.0 Preview](https://github.com/Yates3/IntentHour/releases/tag/desktop-v1.0.0)
- 90-second walkthrough: [06-Demo-Script.md](06-Demo-Script.md) — video pending
- Detailed project overview: [01-Project-Overview.md](01-Project-Overview.md)

## Problem and workflow

Most timers measure duration but lose the original intent, interruptions, and end result. IntentHour records:

```text
Set an intention → Focus → Mark interruptions → Finish or discard → Review patterns
```

The Web client provides account, cloud history, Pro entitlement, CSV export, and an evidence-backed AI weekly review. The Windows client provides an account-free local focus loop, process restart recovery, system tray behavior, native target reminder, and device-local history.

## System

- React, TypeScript, Vite Web client
- Electron main/preload/renderer Desktop client
- Shared framework-independent domain rules and Zod contracts
- Cloudflare Worker + Hono API
- D1 + Drizzle, Better Auth, Paddle, Resend, Turnstile
- DeepSeek-compatible structured AI review
- Dexie/IndexedDB local persistence
- Vitest, Web Playwright, Electron Playwright, installation acceptance

## Three engineering highlights

1. **Two clients, one behavioral core.** Focus lifecycle rules were extracted from a working React hook behind characterization tests, so Web and Desktop share time and state semantics without sharing UI or storage implementations.
2. **Clear trust boundaries.** Paddle webhooks are the entitlement authority; AI evidence is rendered from deterministic server facts; Electron exposes only narrow validated notification IPC.
3. **Production-oriented verification.** The project covers sleeping-tab timing, process restart recovery, fixed-port Windows E2E isolation, Chinese-path-safe packaging, ASAR inspection, installer metadata, reinstall retention, and uninstall behavior.

## Current verified state

- Web is reachable publicly.
- Windows x64 Desktop builds, packages, installs, launches, persists local sessions, restores after restart, uses the tray, and uninstalls.
- Unit, browser, and Electron suites pass locally.
- Desktop 1.0.0 is published as a GitHub prerelease with the verified installer and SHA256SUMS.
- Desktop remains local-only; no claim is made about Desktop login or cloud sync.

## My responsibilities

Product definition, interaction direction, system architecture, AI-assisted implementation planning, Web/Worker/Desktop integration, shared-domain design, testing strategy, Cloudflare delivery, Windows packaging, security review, and project documentation.

## Recommended review order

1. Open the [Live Web product](https://intenthour.yates-33.top).
2. Read the [90-second demo script](06-Demo-Script.md).
3. Review the Desktop screenshots and release status in the [project overview](01-Project-Overview.md).
4. Scan the architecture diagram and engineering highlights.
5. Inspect `shared/`, `worker/`, `desktop/`, and the test suites.

No user, revenue, conversion, or customer-volume claims are made because they are not evidenced by the repository.
