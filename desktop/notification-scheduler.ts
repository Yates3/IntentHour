import {
  parseCancelTargetNotificationPayload,
  parseScheduleTargetNotificationPayload,
  type ScheduleTargetNotificationPayload,
} from "./ipc-contracts.js";

export type TargetNotification = {
  show(): void;
};

export type NotificationStateStore = {
  has(sessionId: string): boolean;
  mark(sessionId: string, notifiedAtMs: number): void;
};

export type NotificationTimer = {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type TargetNotificationSchedulerDependencies = {
  now(): number;
  timer: NotificationTimer;
  state: NotificationStateStore;
  createNotification(onClick: () => void): TargetNotification | undefined;
  showWindow(): void;
  onDelivered(payload: { sessionId: string; notifiedAtMs: number }): void;
  onError(error: unknown): void;
};

export type ScheduleResult =
  | "scheduled"
  | "already-scheduled"
  | "already-notified"
  | "invalid";

const MAX_SCHEDULE_AHEAD_MS = 24 * 60 * 60 * 1_000;

export class TargetNotificationScheduler {
  private current:
    | {
      sessionId: string;
      triggerAtMs: number;
      token: symbol;
      timerHandle: unknown;
    }
    | undefined;

  constructor(
    private readonly dependencies: TargetNotificationSchedulerDependencies,
  ) {}

  schedule(value: unknown): ScheduleResult {
    const payload = parseScheduleTargetNotificationPayload(value);
    if (!payload) return "invalid";

    const nowMs = this.dependencies.now();
    if (
      !Number.isSafeInteger(nowMs) ||
      payload.triggerAtMs > nowMs + MAX_SCHEDULE_AHEAD_MS
    ) {
      return "invalid";
    }

    if (this.dependencies.state.has(payload.sessionId)) {
      this.cancelCurrentFor(payload.sessionId);
      return "already-notified";
    }

    if (
      this.current?.sessionId === payload.sessionId &&
      this.current.triggerAtMs === payload.triggerAtMs
    ) {
      return "already-scheduled";
    }

    this.cancelAll();
    const token = Symbol(payload.sessionId);
    const delayMs = Math.max(0, payload.triggerAtMs - nowMs);
    const timerHandle = this.dependencies.timer.setTimeout(
      () => this.deliver(payload, token),
      delayMs,
    );
    this.current = {
      sessionId: payload.sessionId,
      triggerAtMs: payload.triggerAtMs,
      token,
      timerHandle,
    };
    return "scheduled";
  }

  cancel(value: unknown): boolean {
    const payload = parseCancelTargetNotificationPayload(value);
    if (!payload) return false;
    return this.cancelCurrentFor(payload.sessionId);
  }

  cancelAll(): void {
    if (!this.current) return;
    this.dependencies.timer.clearTimeout(this.current.timerHandle);
    this.current = undefined;
  }

  private cancelCurrentFor(sessionId: string): boolean {
    if (this.current?.sessionId !== sessionId) return false;
    this.cancelAll();
    return true;
  }

  private deliver(
    payload: ScheduleTargetNotificationPayload,
    token: symbol,
  ): void {
    if (
      this.current?.sessionId !== payload.sessionId ||
      this.current.token !== token
    ) {
      return;
    }
    this.current = undefined;
    if (this.dependencies.state.has(payload.sessionId)) return;

    const notifiedAtMs = this.dependencies.now();
    try {
      const notification = this.dependencies.createNotification(
        () => this.dependencies.showWindow(),
      );
      if (!notification) return;
      this.dependencies.state.mark(payload.sessionId, notifiedAtMs);
      notification.show();
      this.dependencies.onDelivered({
        sessionId: payload.sessionId,
        notifiedAtMs,
      });
    } catch (error: unknown) {
      this.dependencies.onError(error);
    }
  }
}
