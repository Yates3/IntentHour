# IntentHour 90-Second Demo Script

Recommended video filename: `intenthour-web-desktop-90s.mp4`

Audience: recruiters and engineering leads. Target length: 75–90 seconds.

| Time | Screen | English voiceover | 中文理解提示 |
| --- | --- | --- | --- |
| 0:00–0:07 | Title, Web focus workspace | “IntentHour is a local-first focus and reflection system. It protects the outcome someone chose, not just a block of time.” | 先讲产品差异：保护意图，不是普通计时器。 |
| 0:07–0:18 | Web: enter an intention and start | “A guest can enter one concrete outcome and start immediately, without creating an account.” | 展示游客无需登录。使用演示目标，不出现私人内容。 |
| 0:18–0:28 | Web: mark an interruption, pause, resume | “Interruptions are captured with one category tap. Pause and reload behavior is wall-clock corrected and persisted locally.” | 展示分心分类、暂停恢复和本地优先。 |
| 0:28–0:38 | Web: finish and open Weekly Patterns | “At the end, the user records the result. Pro history turns ended sessions into trends and a weekly review grounded in server-computed facts.” | 说明 AI 证据来自确定性聚合，不上传目标正文。 |
| 0:38–0:50 | Desktop focus and restart recovery | “The Windows Desktop Preview reuses the same domain rules, but keeps its active Session and history in an independent local database.” | 明确 Desktop 当前 local-only。 |
| 0:50–1:00 | Desktop tray/reminder and history | “Closing hides the app to the system tray. A native target reminder does not end the Session, and a full process restart restores the work.” | 展示托盘/提醒状态、重启恢复、历史。 |
| 1:00–1:12 | Repository architecture diagram | “One Cloudflare Worker owns auth, D1, Paddle entitlement, export, and the AI boundary. Secrets never enter either client.” | 快速展示 Web、Desktop、shared、Worker、D1。 |
| 1:12–1:22 | `shared/`, tests, `AGENTS.md` | “Framework-independent lifecycle rules, Zod contracts, Vitest, browser and Electron Playwright, and repository agent instructions keep changes verifiable.” | 展示共享代码、测试和 AI Coding 边界。 |
| 1:22–1:30 | Final product/links screen | “The Web product is live, and the locally accepted Windows x64 Preview is available as an unsigned GitHub prerelease.” | 强调 Desktop 已发布为 prerelease、仍未签名，并展示真实 Release 链接。 |

## Privacy checklist

- Use only demo intentions such as “Prepare launch brief.”
- Do not show email, OAuth account menus, browser profiles, payment details, API keys, `.env` files, Worker secrets, local filesystem paths, cookies, or provider consoles.
- Use a fresh browser context and isolated Desktop test profile.
- Hide bookmarks, unrelated tabs, notifications, clock/calendar details if they expose private context.

## Editing notes

- Record 1920×1080 or 2560×1440 and deliver at 1080p.
- Keep zoom and cursor movement stable; avoid speed ramps that hide UI state.
- Use direct cuts between Web, Desktop, and architecture.
- Show the Desktop reminder-delivered status and explain that the Session stays open.
- Use captions for “Web available” and “Windows Desktop Preview — local only.”
- Do not show visual reference files as product screens.
- If a native tray/notification capture is unavailable, use the verified in-product reminder state and say exactly what it proves.
