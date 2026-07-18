export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; code?: string }
    | T
    | null;
  if (!response.ok) {
    const error = body as { error?: string; code?: string } | null;
    throw new ApiError(error?.error ?? "Request failed", response.status, error?.code);
  }
  return body as T;
}
