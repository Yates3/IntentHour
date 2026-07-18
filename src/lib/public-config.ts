import { apiFetch } from "./api";

export interface PublicConfig {
  googleSignIn: boolean;
  magicLinkSignIn: boolean;
  paddleCheckout: boolean;
  aiReview: boolean;
}

let pendingConfig: Promise<PublicConfig> | undefined;

export function getPublicConfig(): Promise<PublicConfig> {
  pendingConfig ??= apiFetch<PublicConfig>("/api/config/public").catch((error) => {
    pendingConfig = undefined;
    throw error;
  });
  return pendingConfig;
}
