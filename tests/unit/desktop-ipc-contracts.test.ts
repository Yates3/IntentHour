import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  desktopIpcChannels,
  parseCancelTargetNotificationPayload,
  parseScheduleTargetNotificationPayload,
  parseTargetNotificationDeliveredPayload,
} from "../../desktop/ipc-contracts";

const SESSION_ID = "33333333-3333-4333-8333-333333333333";

describe("Desktop notification IPC contracts", () => {
  it("accepts only fixed schedule and cancel payload shapes", () => {
    expect(parseScheduleTargetNotificationPayload({
      sessionId: SESSION_ID,
      triggerAtMs: 123,
    })).toEqual({ sessionId: SESSION_ID, triggerAtMs: 123 });
    expect(parseCancelTargetNotificationPayload({
      sessionId: SESSION_ID,
    })).toEqual({ sessionId: SESSION_ID });

    expect(parseScheduleTargetNotificationPayload({
      sessionId: "invalid",
      triggerAtMs: 123,
    })).toBeUndefined();
    expect(parseScheduleTargetNotificationPayload({
      sessionId: SESSION_ID,
      triggerAtMs: Number.NaN,
    })).toBeUndefined();
    expect(parseScheduleTargetNotificationPayload({
      sessionId: SESSION_ID,
      triggerAtMs: 123,
      title: "Arbitrary notification",
    })).toBeUndefined();
    expect(parseCancelTargetNotificationPayload({
      sessionId: SESSION_ID,
      channel: "arbitrary",
    })).toBeUndefined();
  });

  it("validates main-to-renderer delivery events", () => {
    expect(parseTargetNotificationDeliveredPayload({
      sessionId: SESSION_ID,
      notifiedAtMs: 456,
    })).toEqual({ sessionId: SESSION_ID, notifiedAtMs: 456 });
    expect(parseTargetNotificationDeliveredPayload({
      sessionId: SESSION_ID,
      notifiedAtMs: "now",
    })).toBeUndefined();
  });

  it("keeps the preload bridge narrow and prevents arbitrary channel access", () => {
    const preloadSource = readFileSync("desktop/preload.cts", "utf8");

    expect(desktopIpcChannels).toEqual({
      scheduleTargetNotification: "focus-target-notification:schedule",
      cancelTargetNotification: "focus-target-notification:cancel",
      targetNotificationDelivered: "focus-target-notification:delivered",
    });
    expect(preloadSource).not.toContain("ipcRenderer: ipcRenderer");
    expect(preloadSource).not.toContain("send: ipcRenderer.send");
    expect(preloadSource).not.toContain("invoke: ipcRenderer.invoke");
    expect(preloadSource).not.toContain("BrowserWindow");
    expect(preloadSource).not.toContain("shell");
    expect(preloadSource).not.toContain("Tray");
  });
});
