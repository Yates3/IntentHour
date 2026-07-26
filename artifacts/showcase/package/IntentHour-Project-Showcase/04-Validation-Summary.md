# IntentHour Validation Summary

This snapshot records the local validation performed for the GitHub showcase on 2026-07-26.

## Web and shared system

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed with zero warnings |
| `npm.cmd run test` | 19 files, 116 tests passed |
| `npm.cmd run test:e2e` | 37 passed, 5 intentionally skipped by project, viewport, or provider conditions |
| `npm.cmd run build` | Passed |

## Windows Desktop

| Check | Result |
| --- | --- |
| `npm.cmd run desktop:typecheck` | Passed |
| `npm.cmd run desktop:test` | 3 Electron tests passed |
| `npm.cmd run desktop:smoke` | Passed |
| `npm.cmd run desktop:make` | Squirrel x64 installer generated |

The latest installed-app acceptance cycle verified installation, Start Menu launch, single-window behavior, a local focus-flow smoke, reinstall data retention, and uninstall. The installer was regenerated for this showcase after that acceptance cycle; it was not executed again, so the final release artifact remained intact for hashing.

## Desktop artifact

- Filename: `IntentHour-Setup-1.0.0.exe`
- Size: 140,221,440 bytes
- SHA-256: `F2583D44F0993C3DDF5E60ABEBB57A0DF37E59D8F140145421F7B91E6F9FE5C7`
- Signing: unsigned
- Publication: [`desktop-v1.0.0` GitHub prerelease](https://github.com/Yates3/IntentHour/releases/tag/desktop-v1.0.0)

## Manual provider checks

Google OAuth, magic-link email, Paddle checkout/refund, AI provider generation, production Cloudflare bindings, Windows SmartScreen appearance, and a future GitHub download must be checked in their configured environments. This document does not claim those external paths were re-verified during the showcase pass.
