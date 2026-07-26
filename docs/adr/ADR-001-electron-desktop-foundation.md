# ADR-001: Electron Desktop foundation

- Status: Accepted
- Date: 2026-07-26

This ADR records the initial foundation decision. Statements about the renderer
being a scaffold describe that milestone, not the current product status.

## Context

IntentHour has a working React/Vite Web client and framework-independent focus-time and lifecycle rules in `shared/`. A real second client is now required, but moving the stable Web and Worker code into a workspace before the Desktop boundary exists would add migration risk without product value.

## Decision

Add a minimal Windows Electron runtime in `desktop/` without moving existing directories or creating a workspace.

The first foundation includes:

- TypeScript main and preload processes compiled independently from the Web build.
- A local static renderer that clearly identifies itself as a scaffold.
- Context isolation, renderer sandboxing, disabled Node integration, enabled web security, denied permissions, denied popups, restricted navigation, and restrictive CSP.
- No generic IPC and no filesystem, shell, credential, synchronization, authentication, billing, or update surface.
- An automated security-preference unit test and a hidden-window startup smoke test.

Electron is selected because it reuses the existing TypeScript and Chromium development model without introducing Rust into the first desktop milestone. Electron version upgrades remain explicit dependency maintenance work.

## Consequences

- Web and Cloudflare builds remain unchanged and independently deployable.
- Desktop compilation and smoke testing use dedicated npm scripts.
- The renderer is not yet a product client and must not be presented as released functionality.
- Future focus behavior should reuse `shared/` domain rules and introduce a storage interface before choosing a desktop persistence implementation.
- Installer packaging, signing, custom protocols, fuses, tray, notifications, and release automation require later decisions and verification.

## Subsequent implementation status

Later milestones retained this decision and added a real local-focus renderer,
an independent Dexie database, shared domain lifecycle rules, restart recovery,
local history, single-instance handling, close-to-tray behavior, a native target
reminder, Electron Playwright coverage, and Windows x64 Squirrel packaging.

The installer has been generated and locally accepted, but the Desktop Preview
is still unsigned and unpublished. Desktop authentication, cloud sync, Pro,
automatic updates, custom protocols, and macOS/Linux releases remain outside
the current implementation.
