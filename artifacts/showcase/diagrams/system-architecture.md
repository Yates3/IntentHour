# IntentHour System Architecture

```mermaid
flowchart LR
  Web["React Web client"] --> WebDB[("Web IndexedDB")]
  Desktop["Electron Desktop client"] --> DesktopDB[("Desktop IndexedDB")]
  Web --> Shared["Shared domain rules and contracts"]
  Desktop --> Shared
  Web --> Worker["Cloudflare Worker + Hono"]
  Worker --> Shared
  Worker --> Auth["Better Auth"]
  Worker --> D1[("D1 + Drizzle")]
  Worker --> Paddle["Paddle"]
  Worker --> AI["DeepSeek-compatible AI provider"]
  Worker --> Email["Resend"]
```

- Running and paused Sessions remain device-local.
- The current Desktop Preview has no cloud connection.
- The Worker owns identity, D1 ownership, entitlement, export, and AI-provider access.
- Provider secrets never enter Web or Desktop bundles.

Source of truth: [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md).
