import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TargetNotificationScheduler,
  type NotificationStateStore,
  type NotificationTimer,
} from "../../desktop/notification-scheduler";

const FIRST_SESSION = "33333333-3333-4333-8333-333333333333";
const SECOND_SESSION = "44444444-4444-4444-8444-444444444444";

class MemoryState implements NotificationStateStore {
  readonly values = new Map<string, number>();

  has(sessionId: string): boolean {
    return this.values.has(sessionId);
  }

  mark(sessionId: string, notifiedAtMs: number): void {
    this.values.set(sessionId, notifiedAtMs);
  }
}

describe("TargetNotificationScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  function setup(state = new MemoryState()) {
    const show = vi.fn();
    const showWindow = vi.fn();
    const onDelivered = vi.fn();
    const onError = vi.fn();
    const timer: NotificationTimer = {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    const scheduler = new TargetNotificationScheduler({
      now: () => Date.now(),
      timer,
      state,
      createNotification: (onClick) => ({
        show: () => {
          show();
          onClick();
        },
      }),
      showWindow,
      onDelivered,
      onError,
    });
    return {
      scheduler,
      state,
      show,
      showWindow,
      onDelivered,
      onError,
    };
  }

  it("schedules one notification and notification click shows the existing window", () => {
    const test = setup();
    expect(test.scheduler.schedule({
      sessionId: FIRST_SESSION,
      triggerAtMs: 2_000,
    })).toBe("scheduled");

    vi.advanceTimersByTime(999);
    expect(test.show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(test.show).toHaveBeenCalledOnce();
    expect(test.showWindow).toHaveBeenCalledOnce();
    expect(test.state.values.get(FIRST_SESSION)).toBe(2_000);
    expect(test.onDelivered).toHaveBeenCalledWith({
      sessionId: FIRST_SESSION,
      notifiedAtMs: 2_000,
    });
  });

  it("does not schedule the same Session twice before or after delivery", () => {
    const test = setup();
    const payload = { sessionId: FIRST_SESSION, triggerAtMs: 2_000 };

    expect(test.scheduler.schedule(payload)).toBe("scheduled");
    expect(test.scheduler.schedule(payload)).toBe("already-scheduled");
    vi.advanceTimersByTime(1_000);
    expect(test.scheduler.schedule({
      sessionId: FIRST_SESSION,
      triggerAtMs: 3_000,
    })).toBe("already-notified");
    vi.advanceTimersByTime(1_000);

    expect(test.show).toHaveBeenCalledOnce();
  });

  it("cancels a paused or ended Session and reschedules it after resume", () => {
    const test = setup();
    expect(test.scheduler.schedule({
      sessionId: FIRST_SESSION,
      triggerAtMs: 2_000,
    })).toBe("scheduled");
    expect(test.scheduler.cancel({ sessionId: FIRST_SESSION })).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(test.show).not.toHaveBeenCalled();

    expect(test.scheduler.schedule({
      sessionId: FIRST_SESSION,
      triggerAtMs: 4_000,
    })).toBe("scheduled");
    vi.advanceTimersByTime(2_000);
    expect(test.show).toHaveBeenCalledOnce();
  });

  it("lets a new Session notify after the prior Session was delivered", () => {
    const test = setup();
    test.scheduler.schedule({
      sessionId: FIRST_SESSION,
      triggerAtMs: 1_100,
    });
    vi.advanceTimersByTime(100);
    test.scheduler.schedule({
      sessionId: SECOND_SESSION,
      triggerAtMs: 1_200,
    });
    vi.advanceTimersByTime(100);

    expect(test.show).toHaveBeenCalledTimes(2);
  });

  it("uses persisted notification state after restart", () => {
    const state = new MemoryState();
    state.mark(FIRST_SESSION, 900);
    const test = setup(state);

    expect(test.scheduler.schedule({
      sessionId: FIRST_SESSION,
      triggerAtMs: 1_000,
    })).toBe("already-notified");
    vi.runAllTimers();
    expect(test.show).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs, arbitrary payloads, and unreasonable trigger times", () => {
    const test = setup();

    expect(test.scheduler.schedule({
      sessionId: "invalid",
      triggerAtMs: 2_000,
    })).toBe("invalid");
    expect(test.scheduler.schedule({
      sessionId: FIRST_SESSION,
      triggerAtMs: Date.now() + 25 * 60 * 60_000,
    })).toBe("invalid");
    expect(test.scheduler.schedule({
      sessionId: FIRST_SESSION,
      triggerAtMs: 2_000,
      body: "Run a command",
    })).toBe("invalid");
    expect(test.scheduler.cancel({ sessionId: "invalid" })).toBe(false);
    expect(test.show).not.toHaveBeenCalled();
  });
});
