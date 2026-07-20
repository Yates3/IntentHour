# Maintenance runbook

## Weekly

- Review Worker errors, Paddle webhook failures, Resend bounces, Turnstile failure rate, and DeepSeek spend.
- Check `webhook_events` for failed processing and `billing_adjustments` for partial refunds requiring manual review.
- Confirm the public auth, checkout, legal, and contact paths remain reachable.

## Monthly

- Run `npm.cmd audit --omit=dev` and evaluate reachable production advisories.
- Exercise a sandbox purchase, duplicate webhook, full refund, cross-browser sync, AI review, CSV export, and account deletion.
- Export/backup D1 before migrations and confirm restore instructions.
- Review policy/version changes before changing `2026-07-18.v1`; new consent must be explicit when the data scope changes.

## AI review changes

Do not change evidence wording in the model. Add any new evidence key to the shared Zod enum, deterministic aggregate builder, server-rendered evidence map, tests, and stored structure version. Existing weekly reviews remain immutable.

## Incident priorities

1. Disable checkout if entitlement grants are unreliable.
2. Preserve raw provider event IDs and timestamps without logging user content.
3. Revoke/rotate compromised secrets at the provider and Cloudflare.
4. Patch and validate in staging, then deploy a versioned Worker release.
5. Reconcile affected entitlements from Paddle's authoritative transaction history.
