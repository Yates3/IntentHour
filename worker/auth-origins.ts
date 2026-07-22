export interface AuthOriginEnvironment {
  APP_URL?: string;
  BETTER_AUTH_URL?: string;
  APP_ALLOWED_ORIGINS?: string;
}

export function authOrigins(env: AuthOriginEnvironment): string[] {
  const candidates = [
    env.BETTER_AUTH_URL,
    env.APP_URL,
    ...(env.APP_ALLOWED_ORIGINS?.split(",") ?? []),
  ];
  const origins: string[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized && !origins.includes(normalized)) origins.push(normalized);
  }
  return origins;
}

function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}
