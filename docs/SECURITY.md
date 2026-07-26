# Security and privacy controls

- Authentication cookies are Secure in production, HttpOnly, and SameSite Lax through Better Auth configuration.
- Magic-link tokens expire after five minutes, are single-use, and are hash-stored in D1.
- Turnstile tokens are sent to the Worker and validated with Siteverify; client rendering alone never counts as validation.
- Paddle signatures are computed over the untouched raw request body and rejected outside a five-minute tolerance. `event_id` is stored to prevent duplicate consumption.
- Every cloud query is scoped by the authenticated `user_id`. Sync bodies cannot select another account.
- CSP, frame denial, MIME sniffing protection, restrictive permissions, and referrer policy are returned by the Worker.
- Logs contain request ID, method, route, status, and duration only. Intention and note bodies are not logged.
- DeepSeek receives aggregate facts only; emails, intentions, and free-text notes are excluded before the request is built.
- `.dev.vars`, `.env.local`, output, traces, and test artifacts are ignored. No client bundle should contain server keys.

## Electron Desktop boundary

- The renderer uses context isolation, process sandboxing, disabled Node integration, enabled web security, and no `<webview>` support.
- The current shell loads repository-owned local files only. New windows and navigation away from the approved entry point are denied.
- Permission checks and permission requests are denied by default.
- The preload bridge exposes immutable runtime metadata and three fixed target-notification operations: schedule, cancel, and delivery subscription. It does not expose `ipcRenderer`, notification text, Tray, BrowserWindow, filesystem, shell, process control, credentials, or arbitrary Electron APIs.
- Main validates the sender URL/webContents and exact payload shape before accepting schedule or cancel events. Session IDs must be UUIDs, trigger times are bounded, and notification title/body remain fixed in main.
- Delivered Session IDs are persisted in a Desktop-only main-process metadata file under Electron `userData`, preventing restart duplicates without modifying shared Session, Web IndexedDB, D1, or sync schemas.
- The renderer HTML defines a restrictive CSP and performs no network requests.
- Future IPC must use narrow allowlisted channels, validate inputs and senders, and receive dedicated tests before it is enabled.
- Electron Forge packaging uses an explicit ASAR whitelist: compiled Desktop runtime files, the local renderer, minimal runtime dependencies, and repository-owned branding assets. Test runtime switches, source maps, Web/Worker sources, local databases, `.dev.vars`, and `.env.local` are excluded and must be re-audited after packaging changes.
- Squirrel produces a per-user Windows x64 installer from local assets. The current preview is not Authenticode-signed and has no updater, Electron-fuse policy, or custom protocol; SmartScreen reputation and dependency advisories remain release risks that must be disclosed before any public preview.

Before production, rotate any credential exposed outside its secret manager, verify all configured origins/callbacks, enable Cloudflare rate limiting for anonymous email/contact routes, and review dependency advisories without force-upgrading across major versions.
