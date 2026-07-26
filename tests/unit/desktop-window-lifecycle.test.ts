import { describe, expect, it, vi } from "vitest";
import {
  DesktopWindowLifecycle,
  type CloseEventLike,
  type DesktopWindowLike,
  type TrayActions,
} from "../../desktop/window-lifecycle";

function createWindow() {
  let closeListener: ((event: CloseEventLike) => void) | undefined;
  let closedListener: (() => void) | undefined;
  const window = {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    on: vi.fn((event: string, listener: (event?: CloseEventLike) => void) => {
      if (event === "close") {
        closeListener = listener;
      } else {
        closedListener = listener;
      }
    }),
  } satisfies DesktopWindowLike;
  return {
    window,
    close: (event: CloseEventLike) => closeListener?.(event),
    closed: () => closedListener?.(),
  };
}

function setup() {
  const fakeWindow = createWindow();
  const tray = { destroy: vi.fn() };
  let trayActions: TrayActions | undefined;
  const createWindowDependency = vi.fn(() => Promise.resolve(fakeWindow.window));
  const createTray = vi.fn((actions: TrayActions) => {
    trayActions = actions;
    return tray;
  });
  const quitApp = vi.fn();
  const onError = vi.fn();
  const lifecycle = new DesktopWindowLifecycle({
    createWindow: createWindowDependency,
    createTray,
    quitApp,
    onError,
  });
  return {
    lifecycle,
    fakeWindow,
    tray,
    getTrayActions: () => trayActions,
    createWindowDependency,
    createTray,
    quitApp,
    onError,
  };
}

describe("DesktopWindowLifecycle", () => {
  it("creates one tray and reuses it across repeated initialization", () => {
    const test = setup();

    expect(test.lifecycle.ensureTray()).toBe(test.tray);
    expect(test.lifecycle.ensureTray()).toBe(test.tray);
    expect(test.createTray).toHaveBeenCalledOnce();
    expect(test.lifecycle.hasTray()).toBe(true);
  });

  it("hides rather than closes when the user clicks the window close button", async () => {
    const test = setup();
    await test.lifecycle.ensureWindow();
    const event = { preventDefault: vi.fn() };

    test.fakeWindow.close(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(test.fakeWindow.window.hide).toHaveBeenCalledOnce();
    expect(test.quitApp).not.toHaveBeenCalled();
  });

  it("the tray Open action restores, shows, and focuses the existing window", async () => {
    const test = setup();
    test.fakeWindow.window.isMinimized.mockReturnValue(true);
    await test.lifecycle.ensureWindow();
    test.lifecycle.ensureTray();

    test.getTrayActions()?.open();
    await vi.waitFor(() => {
      expect(test.fakeWindow.window.restore).toHaveBeenCalledOnce();
      expect(test.fakeWindow.window.show).toHaveBeenCalledOnce();
      expect(test.fakeWindow.window.focus).toHaveBeenCalledOnce();
    });
    expect(test.createWindowDependency).toHaveBeenCalledOnce();
  });

  it("the tray Hide action hides the current window", async () => {
    const test = setup();
    await test.lifecycle.ensureWindow();
    test.lifecycle.ensureTray();

    test.getTrayActions()?.hide();

    expect(test.fakeWindow.window.hide).toHaveBeenCalledOnce();
  });

  it("the tray Quit action destroys the tray and allows the app to exit", async () => {
    const test = setup();
    await test.lifecycle.ensureWindow();
    test.lifecycle.ensureTray();
    test.getTrayActions()?.quit();

    expect(test.tray.destroy).toHaveBeenCalledOnce();
    expect(test.quitApp).toHaveBeenCalledOnce();

    const event = { preventDefault: vi.fn() };
    test.fakeWindow.close(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("a second instance shows the existing window without creating another", async () => {
    const test = setup();
    await test.lifecycle.ensureWindow();

    test.lifecycle.handleSecondInstance();
    await vi.waitFor(() => {
      expect(test.fakeWindow.window.show).toHaveBeenCalledOnce();
      expect(test.fakeWindow.window.focus).toHaveBeenCalledOnce();
    });
    expect(test.createWindowDependency).toHaveBeenCalledOnce();
  });

  it("recreates an unexpectedly destroyed window", async () => {
    const first = createWindow();
    const second = createWindow();
    const createWindowDependency = vi.fn()
      .mockResolvedValueOnce(first.window)
      .mockResolvedValueOnce(second.window);
    const lifecycle = new DesktopWindowLifecycle({
      createWindow: createWindowDependency,
      createTray: () => ({ destroy: vi.fn() }),
      quitApp: vi.fn(),
      onError: vi.fn(),
    });
    await lifecycle.ensureWindow();
    first.window.isDestroyed.mockReturnValue(true);

    await lifecycle.showWindow();

    expect(createWindowDependency).toHaveBeenCalledTimes(2);
    expect(second.window.show).toHaveBeenCalledOnce();
  });
});
