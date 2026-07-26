# IntentHour Desktop Preview 1.0.0

## Release status

Release package prepared; GitHub Release pending.

## Platform

- Windows x64
- Per-user Squirrel installer
- Installer: `IntentHour-Setup-1.0.0.exe`
- SHA-256: `F2583D44F0993C3DDF5E60ABEBB57A0DF37E59D8F140145421F7B91E6F9FE5C7`
- Authenticode: unsigned

Windows SmartScreen may warn because the preview does not yet have a code-signing certificate or reputation.

## Included

- Account-free local focus Sessions
- Start, pause, resume, interruption categories, finish, and discard
- Full application restart recovery
- Device-local completed and discarded history
- Single-instance application behavior
- Close to system tray and explicit Tray Quit
- One native reminder when a running Session reaches its target
- Reminder does not automatically end the Session

## Data boundary

Desktop uses an independent local database. The current preview does not sign in, connect to Web cloud history, grant Pro, process billing, export CSV, or generate AI reviews.

Uninstall removes product registration, standard shortcuts, and running product processes. Desktop `userData` is intentionally retained so local history is not silently destroyed. A small Squirrel deferred-cleanup shell can remain until Windows releases installation files.

## Install

1. Download the installer and `SHA256SUMS.txt` from the same future GitHub Release.
2. Verify the installer SHA-256.
3. Run `IntentHour-Setup-1.0.0.exe`.
4. If SmartScreen appears, confirm the unsigned preview status and publisher information before continuing.
5. Launch IntentHour from its Start Menu shortcut.

## Uninstall

Use Windows Installed Apps or the IntentHour uninstall entry. Local Desktop history is retained by design.

## Known limitations

- GitHub Release not yet published
- Unsigned installer
- No automatic updater
- No Desktop account or cloud sync
- No Pro, billing, CSV, or AI review on Desktop
- No real-time active timer handoff
- No macOS or Linux build

This document describes the verified local release candidate only. It is not a download link.
