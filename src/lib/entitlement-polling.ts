import type { EntitlementState } from "../hooks/use-entitlement";

export async function waitForProEntitlement(
  refresh: () => Promise<EntitlementState>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> {
  const attempts = Math.max(1, options.attempts ?? 20);
  const delayMs = Math.max(0, options.delayMs ?? 1_500);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const entitlement = await refresh();
    if (entitlement.pro && entitlement.status === "active") return true;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    }
  }

  return false;
}
