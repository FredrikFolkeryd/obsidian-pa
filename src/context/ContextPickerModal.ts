/**
 * Context Picker Modal
 *
 * Allows users to select multiple files and folders for AI context.
 * Shows token usage and provides smart suggestions.
 */

import { App, Modal, TFile } from "obsidian";
import type { PASettings } from "../settings";
import {
  type TokenBudgetConfig,
  estimateTokens,
  formatTokenCount,
  getTokenBudgetForModel,
} from "./TokenBudget";

/**
 * Selected context item (file or folder)
 */
export interface ContextItem {
  type: "file" | "folder";
  path: string;
  name: string;
  /** Estimated tokens for this item */
  tokens: number;
  /** Whether folder should be recursive */
  recursive?: boolean;
}

/**
 * Context selection result
 */
export interface ContextPickerResult {
  items: ContextItem[];
  totalTokens: number;
}

/**
 * Modal for selecting context files and folders
 */
export class ContextPickerModal extends Modal {
  private settings: PASettings;
  private selectedItems: Map<string, ContextItem> = new Map();
  private tokenBudget: TokenBudgetConfig;
  private onSelect: (result: ContextPickerResult | null) => void;

  private searchEl: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private selectedEl: HTMLElement | null = null;
  private budgetEl: HTMLElement | null = null;

  // Cached file list for search
  private allFiles: TFile[] = [];

  public constructor(
    app: App,
    settings: PASettings,
    onSelect: (result: ContextPickerResult | null) => void,
    initialItems: ContextItem[] = []
  ) {
    super(app);
    this.settings = settings;
    this.onSelect = onSelect;
    this.tokenBudget = getTokenBudgetForModel(settings.model);

    // Initialize with any existing selections
    for (const item of initialItems) {
      this.selectedItems.set(item.path, item);
    }
  }

  public onOpen(): void {
    const { contentEl, titleEl } = this;

    titleEl.setText("Select Context Files");
    contentEl.addClass("pa-context-picker");

    // Cache file list
    this.allFiles = this.app.vault.getMarkdownFiles().filter((f) =>
      this.isPathAllowed(f.path)
    );

    // Build UI
    this.renderSearch(contentEl);
    this.renderSelectedItems(contentEl);
    this.renderSuggestions(contentEl);
    this.renderFileList(contentEl);
    this.renderBudget(contentEl);
    this.renderButtons(contentEl);

    // Focus search input
    setTimeout(() => this.searchEl?.focus(), 50);
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  /**
   * Render search input
   */
  private renderSearch(container: HTMLElement): void {
    const searchContainer = container.createDiv({ cls: "pa-context-search" });

    this.searchEl = searchContainer.createEl("input", {
      type: "text",
      placeholder: "Search files and folders...",
      cls: "pa-context-search-input",
    });

    this.searchEl.addEventListener("input", () => {
      this.updateFileList();
    });
  }

  /**
   * Render selected items
   */
  private renderSelectedItems(container: HTMLElement): void {
    this.selectedEl = container.createDiv({ cls: "pa-context-selected" });
    this.updateSelectedDisplay();
  }

  /**
   * Render smart suggestions (recent files, linked notes)
   */
  private renderSuggestions(container: HTMLElement): void {
    const suggestionsEl = container.createDiv({ cls: "pa-context-suggestions" });
    suggestionsEl.createEl("span", { text: "Suggestions:", cls: "pa-context-label" });

    // Recent files (last 5 accessed)
    const recentFiles = this.getRecentFiles(5);
    for (const file of recentFiles) {
      if (!this.selectedItems.has(file.path)) {
        const chip = suggestionsEl.createEl("button", {
          text: file.basename,
          cls: "pa-context-chip",
          attr: { title: file.path },
        });
        chip.addEventListener("click", () => { void this.addFile(file); });
      }
    }

    // If nothing to suggest
    if (recentFiles.length === 0) {
      suggestionsEl.createSpan({ text: "Open some notes to see suggestions", cls: "pa-context-hint" });
    }
  }

  /**
   * Render scrollable file list
   */
  private renderFileList(container: HTMLElement): void {
    this.listEl = container.createDiv({ cls: "pa-context-list" });
    this.updateFileList();
  }

  /**
   * Render token budget indicator
   */
  private renderBudget(container: HTMLElement): void {
    this.budgetEl = container.createDiv({ cls: "pa-context-budget" });
    this.updateBudgetDisplay();
  }

  /**
   * Render action buttons
   */
  private renderButtons(container: HTMLElement): void {
    const buttonContainer = container.createDiv({ cls: "pa-context-buttons" });

    const cancelBtn = buttonContainer.createEl("button", {
      text: "Cancel",
    });
    cancelBtn.addEventListener("click", () => {
      this.onSelect(null);
      this.close();
    });

    const confirmBtn = buttonContainer.createEl("button", {
      text: "Add Context",
      cls: "mod-cta",
    });
    confirmBtn.addEventListener("click", () => {
      const items = Array.from(this.selectedItems.values());
      const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0);
      this.onSelect({ items, totalTokens });
      this.close();
    });
  }

  /**
   * Update the file list based on search
   */
  private updateFileList(): void {
    if (!this.listEl) return;
    this.listEl.empty();

    const query = this.searchEl?.value.toLowerCase() || "";
    const filteredFiles = query
      ? this.allFiles.filter(
          (f) =>
            f.basename.toLowerCase().includes(query) ||
            f.path.toLowerCase().includes(query)
        )
      : this.allFiles.slice(0, 50); // Show first 50 if no search

    // Group by folder
    const byFolder = new Map<string, TFile[]>();
    for (const file of filteredFiles) {
      const folder = file.parent?.path || "/";
      if (!byFolder.has(folder)) {
        byFolder.set(folder, []);
      }
      byFolder.get(folder)!.push(file);
    }

    // Render folders and files
    for (const [folder, files] of byFolder) {
      const folderEl = this.listEl.createDiv({ cls: "pa-context-folder" });

      // Folder header with select-all
      const folderHeader = folderEl.createDiv({ cls: "pa-context-folder-header" });
      const folderCheckbox = folderHeader.createEl("input", { type: "checkbox" });
      folderHeader.createSpan({ text: `📁 ${folder || "Root"}`, cls: "pa-context-folder-name" });

      folderCheckbox.addEventListener("change", () => {
        if (folderCheckbox.checked) {
          void this.addFolder(folder, files);
        } else {
          this.removeFolder(folder, files);
        }
      });

      // Files in folder
      for (const file of files) {
        const fileEl = folderEl.createDiv({ cls: "pa-context-file" });
        const isSelected = this.selectedItems.has(file.path);

        const checkbox = fileEl.createEl("input", { type: "checkbox" });
        checkbox.checked = isSelected;

        fileEl.createSpan({ text: file.basename, cls: "pa-context-file-name" });

        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            void this.addFile(file);
          } else {
            this.removeItem(file.path);
          }
        });
      }
    }

    if (filteredFiles.length === 0) {
      this.listEl.createDiv({
        text: query ? "No matching files found" : "No accessible files",
        cls: "pa-context-empty",
      });
    }
  }

  /**
   * Update selected items display
   */
  private updateSelectedDisplay(): void {
    if (!this.selectedEl) return;
    this.selectedEl.empty();

    if (this.selectedItems.size === 0) {
      this.selectedEl.createSpan({
        text: "No files selected",
        cls: "pa-context-hint",
      });
      return;
    }

    this.selectedEl.createSpan({
      text: `Selected (${this.selectedItems.size}):`,
      cls: "pa-context-label",
    });

    for (const [path, item] of this.selectedItems) {
      const chip = this.selectedEl.createDiv({ cls: "pa-context-selected-chip" });
      const icon = item.type === "folder" ? "📁" : "📄";
      chip.createSpan({ text: `${icon} ${item.name}` });
      chip.createSpan({
        text: formatTokenCount(item.tokens),
        cls: "pa-context-token-count",
      });

      const removeBtn = chip.createEl("button", {
        text: "×",
        cls: "pa-context-remove",
      });
      removeBtn.addEventListener("click", () => this.removeItem(path));
    }
  }

  /**
   * Update token budget display
   */
  private updateBudgetDisplay(): void {
    if (!this.budgetEl) return;
    this.budgetEl.empty();

    const items = Array.from(this.selectedItems.values());
    const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0);
    const availableTokens = this.tokenBudget.maxContextTokens - this.tokenBudget.reserveForResponse;
    const usedPercent = Math.round((totalTokens / availableTokens) * 100);
    const isOverLimit = totalTokens > availableTokens;
    const isWarning = usedPercent > 70 && !isOverLimit;

    const summary = `${formatTokenCount(totalTokens)} / ${formatTokenCount(availableTokens)} tokens (${usedPercent}%)`;
    const cls = isOverLimit
      ? "pa-context-budget-over"
      : isWarning
      ? "pa-context-budget-warning"
      : "pa-context-budget-ok";

    this.budgetEl.createSpan({ text: summary, cls });
  }

  /**
   * Add a file to selection
   */
  private async addFile(file: TFile): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    const tokens = estimateTokens(content);

    this.selectedItems.set(file.path, {
      type: "file",
      path: file.path,
      name: file.basename,
      tokens,
    });

    this.updateSelectedDisplay();
    this.updateBudgetDisplay();
    this.updateFileList();
  }

  /**
   * Add a folder (all files within)
   */
  private async addFolder(_folderPath: string, files: TFile[]): Promise<void> {
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const tokens = estimateTokens(content);

      this.selectedItems.set(file.path, {
        type: "file",
        path: file.path,
        name: file.basename,
        tokens,
      });
    }

    this.updateSelectedDisplay();
    this.updateBudgetDisplay();
    this.updateFileList();
  }

  /**
   * Remove a folder (all files within)
   */
  private removeFolder(_folderPath: string, files: TFile[]): void {
    for (const file of files) {
      this.selectedItems.delete(file.path);
    }

    this.updateSelectedDisplay();
    this.updateBudgetDisplay();
    this.updateFileList();
  }

  /**
   * Remove an item from selection
   */
  private removeItem(path: string): void {
    this.selectedItems.delete(path);
    this.updateSelectedDisplay();
    this.updateBudgetDisplay();
    this.updateFileList();
  }

  /**
   * Get recently accessed files
   */
  private getRecentFiles(count: number): TFile[] {
    return this.allFiles
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, count);
  }

  /**
   * Check if a path is allowed based on consent settings
   */
  private isPathAllowed(path: string): boolean {
    if (!this.settings.consentEnabled) return false;

    const { consentMode, includedFolders, excludedFolders } = this.settings;

    if (consentMode === "opt-in") {
      if (includedFolders.length === 0) return false;
      return includedFolders.some(
        (folder: string) => path.startsWith(folder + "/") || path === folder || folder === "/"
      );
    } else {
      return !excludedFolders.some(
        (folder: string) => path.startsWith(folder + "/") || path === folder      );
    }
  }
}