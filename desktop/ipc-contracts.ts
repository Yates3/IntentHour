export const desktopIpcChannels = Object.freeze({
  scheduleTargetNotification: "focus-target-notification:schedule",
  cancelTargetNotification: "focus-target-notification:cancel",
  targetNotificationDelivered: "focus-target-notification:delivered",
});

export type ScheduleTargetNotificationPayload = {
  sessionId: string;
  triggerAtMs: number;
};

export type CancelTargetNotificationPayload = {
  sessionId: string;
};

export type TargetNotificationDeliveredPayload = {
  sessionId: string;
  notifiedAtMs: number;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length &&
    keys.every((key) => expected.includes(key));
}

export function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function parseScheduleTargetNotificationPayload(
  value: unknown,
): ScheduleTargetNotificationPayload | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["sessionId", "triggerAtMs"]) ||
    !isValidSessionId(value.sessionId) ||
    typeof value.triggerAtMs !== "number" ||
    !Number.isSafeInteger(value.triggerAtMs) ||
    value.triggerAtMs < 0
  ) {
    return undefined;
  }

  return {
    sessionId: value.sessionId,
    triggerAtMs: value.triggerAtMs,
  };
}

export function parseCancelTargetNotificationPayload(
  value: unknown,
): CancelTargetNotificationPayload | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["sessionId"]) ||
    !isValidSessionId(value.sessionId)
  ) {
    return undefined;
  }

  return { sessionId: value.sessionId };
}

export function parseTargetNotificationDeliveredPayload(
  value: unknown,
): TargetNotificationDeliveredPayload | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["sessionId", "notifiedAtMs"]) ||
    !isValidSessionId(value.sessionId) ||
    typeof value.notifiedAtMs !== "number" ||
    !Number.isSafeInteger(value.notifiedAtMs) ||
    value.notifiedAtMs < 0
  ) {
    return undefined;
  }

  return {
    sessionId: value.sessionId,
    notifiedAtMs: value.notifiedAtMs,
  };
}
