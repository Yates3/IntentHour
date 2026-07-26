export {};

type ScheduleTargetNotificationPayload = {
  sessionId: string;
  triggerAtMs: number;
};

type SessionOnlyPayload = {
  sessionId: string;
};

type TargetNotificationDeliveredPayload = {
  sessionId: string;
  notifiedAtMs: number;
};

declare global {
  interface Window {
    intentHourDesktop?: {
      runtime: {
        platform: string;
        electronVersion: string;
      };
      scheduleFocusTargetNotification(
        payload: ScheduleTargetNotificationPayload,
      ): void;
      cancelFocusTargetNotification(payload: SessionOnlyPayload): void;
      onFocusTargetNotificationDelivered(
        listener: (payload: TargetNotificationDeliveredPayload) => void,
      ): () => void;
    };
  }
}
