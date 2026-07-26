import { contextBridge, ipcRenderer } from "electron";

const channels = Object.freeze({
  scheduleTargetNotification: "focus-target-notification:schedule",
  cancelTargetNotification: "focus-target-notification:cancel",
  targetNotificationDelivered: "focus-target-notification:delivered",
});

const desktopRuntime = Object.freeze({
  platform: process.platform,
  electronVersion: process.versions.electron,
});

contextBridge.exposeInMainWorld(
  "intentHourDesktop",
  Object.freeze({
    runtime: desktopRuntime,
    scheduleFocusTargetNotification: (payload: unknown): void => {
      ipcRenderer.send(channels.scheduleTargetNotification, payload);
    },
    cancelFocusTargetNotification: (payload: unknown): void => {
      ipcRenderer.send(channels.cancelTargetNotification, payload);
    },
    onFocusTargetNotificationDelivered: (
      listener: (payload: unknown) => void,
    ): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        listener(payload);
      };
      ipcRenderer.on(channels.targetNotificationDelivered, handler);
      return () => {
        ipcRenderer.removeListener(
          channels.targetNotificationDelivered,
          handler,
        );
      };
    },
  }),
);
