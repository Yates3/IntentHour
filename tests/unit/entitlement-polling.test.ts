import { describe, expect, it, vi } from "vitest";
import { waitForProEntitlement } from "../../src/lib/entitlement-polling";
import type { EntitlementState } from "../../src/hooks/use-entitlement";

const free: EntitlementState = { authenticated: true, pro: false, status: "none" };
const pro: EntitlementState = { authenticated: true, pro: true, status: "active" };

describe("Paddle entitlement confirmation", () => {
  it("unlocks only after the server reports an active entitlement", async () => {
    const refresh = vi.fn()
      .mockResolvedValueOnce(free)
      .mockResolvedValueOnce(free)
      .mockResolvedValueOnce(pro);

    await expect(waitForProEntitlement(refresh, { attempts: 3, delayMs: 0 })).resolves.toBe(true);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("stays locked when the server never confirms Pro", async () => {
    const refresh = vi.fn().mockResolvedValue(free);

    await expect(waitForProEntitlement(refresh, { attempts: 2, delayMs: 0 })).resolves.toBe(false);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
