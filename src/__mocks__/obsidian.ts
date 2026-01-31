/**
 * Mock of the Obsidian module for testing
 *
 * This provides stub implementations of Obsidian types
 * that are used in our tests.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

export class App {
  public vault = new Vault();
  public workspace = new Workspace();
}

export class Vault {
  public read = async (_file: TFile): Promise<string> => "";
  public getAbstractFileByPath = (_path: string): TAbstractFile | null => null;
  public getMarkdownFiles = (): TFile[] => [];
  public getRoot = (): TFolder => new TFolder();

  public static recurseChildren(
    root: TFolder,
    callback: (file: TAbstractFile) => void
  ): void {
    // Mock implementation
  }
}

export class Workspace {
  public getActiveFile = (): TFile | null => null;
  public getLeavesOfType = (_viewType: string): WorkspaceLeaf[] => [];
  public getRightLeaf = (_split: boolean): WorkspaceLeaf | null => null;
  public revealLeaf = (_leaf: WorkspaceLeaf): void => undefined;
}

export class WorkspaceLeaf {
  public setViewState = async (_state: { type: string; active: boolean }): Promise<void> =>
    undefined;
}

export class TAbstractFile {
  public path = "";
  public name = "";
}

export class TFile extends TAbstractFile {
  public basename = "";
  public extension = "md";
  public stat = { mtime: 0, ctime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
  public children: TAbstractFile[] = [];
}

export class Plugin {
  public app: App = new App();
  public manifest = { id: "test-plugin", version: "0.0.0" };

  public addCommand(_command: { id: string; name: string; callback: () => void }): void {
    // Mock
  }

  public addRibbonIcon(
    _icon: string,
    _title: string,
    _callback: () => void
  ): HTMLElement {
    return document.createElement("div");
  }

  public addSettingTab(_tab: PluginSettingTab): void {
    // Mock
  }

  public registerView(
    _type: string,
    _viewCreator: (leaf: WorkspaceLeaf) => ItemView
  ): void {
    // Mock
  }

  public loadData = async (): Promise<unknown> => ({});
  public saveData = async (_data: unknown): Promise<void> => undefined;
}

export class PluginSettingTab {
  public app: App;
  public plugin: Plugin;
  public containerEl: HTMLElement = document.createElement("div");

  public constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  public display(): void {
    // Override in subclass
  }
}

export class ItemView {
  public leaf: WorkspaceLeaf;
  public app: App = new App();
  public containerEl: HTMLElement = document.createElement("div");

  public constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.containerEl.appendChild(document.createElement("div"));
  }

  public getViewType(): string {
    return "";
  }

  public getDisplayText(): string {
    return "";
  }

  public getIcon(): string {
    return "";
  }
}

export class Setting {
  public constructor(_containerEl: HTMLElement) {
    // Mock
  }

  public setName(_name: string): this {
    return this;
  }

  public setDesc(_desc: string): this {
    return this;
  }

  public addToggle(_callback: (toggle: Toggle) => void): this {
    return this;
  }

  public addText(_callback: (text: TextComponent) => void): this {
    return this;
  }

  public addDropdown(_callback: (dropdown: DropdownComponent) => void): this {
    return this;
  }

  public addButton(_callback: (button: ButtonComponent) => void): this {
    return this;
  }
}

export class Toggle {
  public setValue(_value: boolean): this {
    return this;
  }

  public onChange(_callback: (value: boolean) => void): this {
    return this;
  }
}

export class TextComponent {
  public inputEl: HTMLInputElement = document.createElement("input");

  public setPlaceholder(_placeholder: string): this {
    return this;
  }

  public setValue(_value: string): this {
    return this;
  }

  public onChange(_callback: (value: string) => void): this {
    return this;
  }
}

export class DropdownComponent {
  public addOption(_value: string, _display: string): this {
    return this;
  }

  public setValue(_value: string): this {
    return this;
  }

  public onChange(_callback: (value: string) => void): this {
    return this;
  }
}

export class ButtonComponent {
  public setButtonText(_text: string): this {
    return this;
  }

  public onClick(_callback: () => void): this {
    return this;
  }
}

export const MarkdownRenderer = {
  render: async (
    _app: App,
    _markdown: string,
    _el: HTMLElement,
    _sourcePath: string,
    _component: unknown
  ): Promise<void> => {
    // Mock
  },
};
