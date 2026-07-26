import { describe, expect, it } from "vitest";
import { desktopWebPreferences } from "../../desktop/security";

describe("Electron desktop security boundary", () => {
  it("keeps the renderer isolated from Node and privileged browser features", () => {
    expect(desktopWebPreferences).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    });
    expect(Object.isFrozen(desktopWebPreferences)).toBe(true);
  });
});
