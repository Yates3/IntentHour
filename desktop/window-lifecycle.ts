export type CloseEventLike = {
  preventDefault(): void;
};

export type DesktopWindowLike = {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
  hide(): void;
  on(event: "close", listener: (event: CloseEventLike) => void): void;
  on(event: "closed", listener: () => void): void;
};

export type DesktopTrayLike = {
  destroy(): void;
};

export type TrayActions = {
  open: () => void;
  hide: () => void;
  quit: () => void;
};

export type WindowLifecycleDependencies = {
  createWindow: () => Promise<DesktopWindowLike>;
  createTray: (actions: TrayActions) => DesktopTrayLike;
  quitApp: () => void;
  onError: (error: unknown) => void;
};

export class DesktopWindowLifecycle {
  private mainWindow: DesktopWindowLike | undefined;
  private tray: DesktopTrayLike | undefined;
  private creatingWindow: Promise<DesktopWindowLike> | undefined;
  private isQuitting = false;

  constructor(private readonly dependencies: WindowLifecycleDependencies) {}

  async ensureWindow(): Promise<DesktopWindowLike> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }
    if (this.creatingWindow) return this.creatingWindow;

    this.creatingWindow = this.dependencies.createWindow()
      .then((window) => {
        this.attachWindow(window);
        return window;
      })
      .finally(() => {
        this.creatingWindow = undefined;
      });
    return this.creatingWindow;
  }

  ensureTray(): DesktopTrayLike {
    if (this.tray) return this.tray;
    this.tray = this.dependencies.createTray({
      open: () => {
        void this.showWindow().catch((error: unknown) => {
          this.dependencies.onError(error);
        });
      },
      hide: () => this.hideWindow(),
      quit: () => this.quit(),
    });
    return this.tray;
  }

  async showWindow(): Promise<void> {
    const window = await this.ensureWindow();
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  hideWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide();
    }
  }

  handleSecondInstance(): void {
    void this.showWindow().catch((error: unknown) => {
      this.dependencies.onError(error);
    });
  }

  beforeQuit(): void {
    this.isQuitting = true;
    this.destroyTray();
  }

  quit(): void {
    this.isQuitting = true;
    this.destroyTray();
    this.dependencies.quitApp();
  }

  hasTray(): boolean {
    return this.tray !== undefined;
  }

  private attachWindow(window: DesktopWindowLike): void {
    this.mainWindow = window;
    window.on("close", (event) => {
      if (this.isQuitting) return;
      event.preventDefault();
      window.hide();
    });
    window.on("closed", () => {
      if (this.mainWindow === window) this.mainWindow = undefined;
    });
  }

  private destroyTray(): void {
    this.tray?.destroy();
    this.tray = undefined;
  }
}
