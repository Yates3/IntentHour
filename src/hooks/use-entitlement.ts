import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export interface EntitlementState {
  authenticated: boolean;
  pro: boolean;
  status: "active" | "revoked" | "none";
  purchasedAt?: string;
}

const guestState: EntitlementState = { authenticated: false, pro: false, status: "none" };

export function useEntitlement() {
  const [entitlement, setEntitlement] = useState<EntitlementState>(guestState);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setEntitlement(await apiFetch<EntitlementState>("/api/me/entitlement"));
    } catch {
      setEntitlement(guestState);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { entitlement, loading, refresh };
}
