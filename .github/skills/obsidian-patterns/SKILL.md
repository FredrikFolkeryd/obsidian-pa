---
name: obsidian-patterns
description: >
  Provides code patterns and best practices for Obsidian plugin development.
  Use this skill when implementing plugin features to ensure consistency with
  Obsidian API conventions and lifecycle management.

  Covers Plugin class structure, settings management, commands, events,
  and resource cleanup patterns.
---

# Obsidian Plugin Patterns

## Purpose

This skill provides standardised code patterns for Obsidian plugin development, ensuring consistent implementation across the codebase and proper API usage.

## Plugin Entry Point

### Basic Plugin Structure

```typescript
import { Plugin } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, SettingsTab } from './settings';

export default class MyPlugin extends Plugin {
  settings: PluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register commands
    this.addCommand({
      id: 'my-command',
      name: 'My Command',
      callback: () => this.handleCommand(),
    });

    // Register settings tab
    this.addSettingTab(new SettingsTab(this.app, this));

    // Register event handlers (automatically cleaned up)
    this.registerEvent(
      this.app.workspace.on('file-open', this.handleFileOpen.bind(this))
    );

    console.log('Plugin loaded');
  }

  onunload(): void {
    // Clean up any resources not handled by registerEvent
    console.log('Plugin unloaded');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private handleCommand(): void {
    // Command implementation
  }

  private handleFileOpen(file: TFile | null): void {
    // Event handler implementation
  }
}
```

## Settings Management

### Settings Interface

```typescript
export interface PluginSettings {
  apiEndpoint: string;
  timeout: number;
  enableFeature: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  apiEndpoint: '',
  timeout: 30000,
  enableFeature: false,
};
```

### Settings Tab

```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import type MyPlugin from './main';

export class SettingsTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'My Plugin Settings' });

    new Setting(containerEl)
      .setName('API Endpoint')
      .setDesc('The endpoint for API requests')
      .addText((text) =>
        text
          .setPlaceholder('https://api.example.com')
          .setValue(this.plugin.settings.apiEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.apiEndpoint = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Timeout')
      .setDesc('Request timeout in milliseconds')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.timeout))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.timeout = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Enable Feature')
      .setDesc('Toggle experimental feature')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableFeature)
          .onChange(async (value) => {
            this.plugin.settings.enableFeature = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
```

## Commands

### Basic Command

```typescript
this.addCommand({
  id: 'unique-command-id',
  name: 'Human Readable Name',
  callback: () => {
    // Runs without any conditions
  },
});
```

### Editor Command (requires active editor)

```typescript
this.addCommand({
  id: 'editor-command',
  name: 'Editor Command',
  editorCallback: (editor: Editor, view: MarkdownView) => {
    const selection = editor.getSelection();
    editor.replaceSelection(selection.toUpperCase());
  },
});
```

### Conditional Command

```typescript
this.addCommand({
  id: 'conditional-command',
  name: 'Conditional Command',
  checkCallback: (checking: boolean) => {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      if (!checking) {
        // Perform the action
        this.processFile(activeFile);
      }
      return true; // Command is available
    }
    return false; // Command is not available
  },
});
```

## Event Handling

### Always Use registerEvent

```typescript
// ✅ Correct: Event is automatically cleaned up on unload
this.registerEvent(
  this.app.vault.on('create', (file) => {
    console.log('File created:', file.path);
  })
);

this.registerEvent(
  this.app.workspace.on('active-leaf-change', (leaf) => {
    console.log('Active leaf changed');
  })
);

// ❌ Wrong: Manual event registration without cleanup
this.app.vault.on('create', (file) => {
  // This listener will persist after plugin unload!
});
```

### Common Events

```typescript
// File events
this.registerEvent(this.app.vault.on('create', this.onFileCreate.bind(this)));
this.registerEvent(this.app.vault.on('modify', this.onFileModify.bind(this)));
this.registerEvent(this.app.vault.on('delete', this.onFileDelete.bind(this)));
this.registerEvent(this.app.vault.on('rename', this.onFileRename.bind(this)));

// Workspace events
this.registerEvent(this.app.workspace.on('file-open', this.onFileOpen.bind(this)));
this.registerEvent(this.app.workspace.on('active-leaf-change', this.onLeafChange.bind(this)));
this.registerEvent(this.app.workspace.on('layout-change', this.onLayoutChange.bind(this)));

// Metadata events
this.registerEvent(this.app.metadataCache.on('changed', this.onMetadataChange.bind(this)));
this.registerEvent(this.app.metadataCache.on('resolved', this.onMetadataResolved.bind(this)));
```

## Modals

### Basic Modal

```typescript
import { App, Modal } from 'obsidian';

export class MyModal extends Modal {
  result: string;
  onSubmit: (result: string) => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Enter Value' });

    const input = contentEl.createEl('input', { type: 'text' });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.result = input.value;
        this.close();
        this.onSubmit(this.result);
      }
    });

    const button = contentEl.createEl('button', { text: 'Submit' });
    button.addEventListener('click', () => {
      this.result = input.value;
      this.close();
      this.onSubmit(this.result);
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
```

### Suggestion Modal (Fuzzy Finder)

```typescript
import { App, FuzzySuggestModal } from 'obsidian';

interface Item {
  name: string;
  value: string;
}

export class ItemSuggestModal extends FuzzySuggestModal<Item> {
  items: Item[];
  onChoose: (item: Item) => void;

  constructor(app: App, items: Item[], onChoose: (item: Item) => void) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
  }

  getItems(): Item[] {
    return this.items;
  }

  getItemText(item: Item): string {
    return item.name;
  }

  onChooseItem(item: Item, evt: MouseEvent | KeyboardEvent): void {
    this.onChoose(item);
  }
}
```

## Vault Operations

### Reading Files

```typescript
// Read file content
const content = await this.app.vault.read(file);

// Read file content (cached, faster for recent files)
const cachedContent = await this.app.vault.cachedRead(file);

// Get all markdown files
const markdownFiles = this.app.vault.getMarkdownFiles();

// Get file by path
const file = this.app.vault.getAbstractFileByPath('folder/note.md');
if (file instanceof TFile) {
  // It's a file
}
```

### Writing Files

```typescript
// Modify existing file
await this.app.vault.modify(file, newContent);

// Create new file
const newFile = await this.app.vault.create('path/to/new-note.md', content);

// Append to file
await this.app.vault.append(file, additionalContent);
```

### Working with Metadata

```typescript
// Get cached metadata
const cache = this.app.metadataCache.getFileCache(file);
if (cache) {
  const frontmatter = cache.frontmatter;
  const headings = cache.headings;
  const links = cache.links;
}

// Get frontmatter
const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
if (frontmatter) {
  console.log('Title:', frontmatter.title);
  console.log('Tags:', frontmatter.tags);
}
```

## Resource Cleanup

### Intervals and Timeouts

```typescript
// ✅ Correct: Use registerInterval for automatic cleanup
this.registerInterval(
  window.setInterval(() => {
    this.periodicTask();
  }, 60000)
);

// ❌ Wrong: Manual interval without cleanup tracking
setInterval(() => {
  // This will continue running after plugin unload!
}, 60000);
```

### DOM Events

```typescript
// ✅ Correct: Use registerDomEvent for automatic cleanup
this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
  console.log('Document clicked');
});

// ❌ Wrong: Manual DOM event without cleanup
document.addEventListener('click', (evt) => {
  // This listener will persist after plugin unload!
});
```

## Views

### Custom View

```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE = 'my-custom-view';

export class MyView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'My Custom View';
  }

  getIcon(): string {
    return 'dice';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl('h4', { text: 'My Custom View' });
  }

  async onClose(): Promise<void> {
    // Cleanup
  }
}
```

### Registering View

```typescript
// In plugin onload()
this.registerView(VIEW_TYPE, (leaf) => new MyView(leaf));

// Add ribbon icon to open view
this.addRibbonIcon('dice', 'Open My View', () => {
  this.activateView();
});

async activateView(): Promise<void> {
  const { workspace } = this.app;

  let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
  if (!leaf) {
    const rightLeaf = workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({ type: VIEW_TYPE, active: true });
      leaf = rightLeaf;
    }
  }

  if (leaf) {
    workspace.revealLeaf(leaf);
  }
}
```

## Best Practices Summary

1. **Always use `registerEvent`** for workspace and vault events
2. **Always use `registerInterval`** for setInterval calls
3. **Always use `registerDomEvent`** for DOM event listeners
4. **Clean up resources** in `onunload()` that aren't auto-managed
5. **Use cached reads** (`cachedRead`) when possible for performance
6. **Bind `this`** when passing methods as callbacks
7. **Use explicit return types** on all public methods
8. **Handle null cases** (active file may be null)
