/**
 * Task History View - Display executed task plans with rollback capability
 */

import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type PAPlugin from "../main";
import { formatDateTimeISO } from "../chat/helpers";
import {
  TaskHistoryManager,
  getHistoryStats,
  createTaskExecutor,
  type TaskHistoryEntry,
  type TaskHistoryData,
  type TaskPlan,
} from "../tasks";

export const VIEW_TYPE_TASK_HISTORY = "pa-task-history-view";

type HistoryStatusFilter = "all" | "completed" | "failed" | "rolled-back";

/**
 * View for displaying task execution history
 */
export class TaskHistoryView extends ItemView {
  private plugin: PAPlugin;
  private historyManager: TaskHistoryManager;
  private historyContentEl: HTMLElement | null = null;
  private statusFilter: HistoryStatusFilter = "all";

  public constructor(leaf: WorkspaceLeaf, plugin: PAPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.historyManager = new TaskHistoryManager();
  }

  public getViewType(): string {
    return VIEW_TYPE_TASK_HISTORY;
  }

  public getDisplayText(): string {
    return "Task History";
  }

  public getIcon(): string {
    return "history";
  }

  public async onOpen(): Promise<void> {
    await this.loadHistory();
    this.render();
  }

  public async onClose(): Promise<void> {
    await this.saveHistoryIfDirty();
  }

  /**
   * Load history from plugin data
   */
  private async loadHistory(): Promise<void> {
    try {
      const data = (await this.plugin.loadData()) as Record<string, unknown> | null;
      const historyData = data?.taskHistory as TaskHistoryData | undefined;
      this.historyManager.load(historyData ?? null);
    } catch (error) {
      console.error("[TaskHistory] Failed to load history:", error);
    }
  }

  /**
   * Save history to plugin data if changed
   */
  private async saveHistoryIfDirty(): Promise<void> {
    if (!this.historyManager.isDirty()) {
      return;
    }

    try {
      const existingData = ((await this.plugin.loadData()) ?? {}) as Record<string, unknown>;
      existingData.taskHistory = this.historyManager.export();
      await this.plugin.saveData(existingData);
      this.historyManager.markClean();
    } catch (error) {
      console.error("[TaskHistory] Failed to save history:", error);
    }
  }

  /**
   * Render the view
   */
  private render(): void {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("pa-task-history-container");

    this.addStyles();

    // Header
    const headerEl = container.createDiv({ cls: "pa-task-history-header" });
    headerEl.createEl("h2", { text: "Task History" });

    // Stats
    this.renderStats(headerEl);

    // Filter controls
    this.renderFilters(headerEl);

    // Content area
    this.historyContentEl = container.createDiv({ cls: "pa-task-history-content" });
    this.renderEntries();
  }

  /**
   * Render statistics summary
   */
  private renderStats(containerEl: HTMLElement): void {
    const entries = this.historyManager.getEntries();
    const stats = getHistoryStats(entries);

    const statsEl = containerEl.createDiv({ cls: "pa-task-history-stats" });
    statsEl.createSpan({ text: `Total: ${stats.total}`, cls: "stat-item" });
    statsEl.createSpan({ text: `✅ ${stats.completed}`, cls: "stat-item stat-completed" });
    statsEl.createSpan({ text: `❌ ${stats.failed}`, cls: "stat-item stat-failed" });
    statsEl.createSpan({ text: `↩️ ${stats.rolledBack}`, cls: "stat-item stat-rolled-back" });

    if (stats.rollbackable > 0) {
      statsEl.createSpan({
        text: `🔄 ${stats.rollbackable} rollbackable`,
        cls: "stat-item stat-rollbackable",
      });
    }
  }

  /**
   * Render filter buttons
   */
  private renderFilters(containerEl: HTMLElement): void {
    const filterEl = containerEl.createDiv({ cls: "pa-task-history-filters" });

    const filters: Array<{ value: HistoryStatusFilter; label: string }> = [
      { value: "all", label: "All" },
      { value: "completed", label: "Completed" },
      { value: "failed", label: "Failed" },
      { value: "rolled-back", label: "Rolled Back" },
    ];

    for (const filter of filters) {
      const btn = filterEl.createEl("button", {
        text: filter.label,
        cls: `filter-btn ${this.statusFilter === filter.value ? "active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.statusFilter = filter.value;
        this.render();
      });
    }

    // Clear history button
    const clearBtn = filterEl.createEl("button", {
      text: "Clear All",
      cls: "filter-btn clear-btn",
    });
    clearBtn.addEventListener("click", () => {
      void this.confirmClearHistory();
    });
  }

  /**
   * Render history entries
   */
  private renderEntries(): void {
    if (!this.historyContentEl) return;

    const entries = this.getFilteredEntries();

    if (entries.length === 0) {
      const emptyEl = this.historyContentEl.createDiv({ cls: "pa-task-history-empty" });
      emptyEl.createEl("p", {
        text:
          this.statusFilter === "all"
            ? "No task history yet. Execute some tasks to see them here."
            : `No ${this.statusFilter} tasks found.`,
      });
      return;
    }

    const listEl = this.historyContentEl.createDiv({ cls: "pa-task-history-list" });

    for (const entry of entries) {
      this.renderEntry(listEl, entry);
    }
  }

  /**
   * Get filtered entries based on current filter
   */
  private getFilteredEntries(): TaskHistoryEntry[] {
    if (this.statusFilter === "all") {
      return this.historyManager.getEntries();
    }
    return this.historyManager.getEntriesByStatus(this.statusFilter);
  }

  /**
   * Render a single history entry
   */
  private renderEntry(containerEl: HTMLElement, entry: TaskHistoryEntry): void {
    const entryEl = containerEl.createDiv({
      cls: `pa-task-history-entry status-${entry.status}`,
    });

    // Header row
    const headerRow = entryEl.createDiv({ cls: "entry-header" });

    // Status icon
    const statusIcon =
      entry.status === "completed"
        ? "✅"
        : entry.status === "failed"
          ? "❌"
          : "↩️";
    headerRow.createSpan({ text: statusIcon, cls: "entry-status-icon" });

    // Description
    headerRow.createSpan({
      text: entry.plan.description,
      cls: "entry-description",
    });

    // Timestamp
    const date = new Date(entry.executedAt);
    headerRow.createSpan({
      text: this.formatDate(date),
      cls: "entry-timestamp",
    });

    // Details row
    const detailsRow = entryEl.createDiv({ cls: "entry-details" });
    detailsRow.createSpan({
      text: `${entry.plan.steps.length} step${entry.plan.steps.length !== 1 ? "s" : ""}`,
      cls: "entry-step-count",
    });

    // Error message if failed
    if (entry.error) {
      const errorEl = entryEl.createDiv({ cls: "entry-error" });
      errorEl.createSpan({ text: entry.error });
    }

    // Steps expandable
    const stepsToggle = detailsRow.createEl("button", {
      text: "Show steps",
      cls: "steps-toggle",
    });
    const stepsEl = entryEl.createDiv({ cls: "entry-steps hidden" });
    this.renderSteps(stepsEl, entry.plan);

    stepsToggle.addEventListener("click", () => {
      const isHidden = stepsEl.hasClass("hidden");
      stepsEl.toggleClass("hidden", !isHidden);
      stepsToggle.textContent = isHidden ? "Hide steps" : "Show steps";
    });

    // Actions
    const actionsRow = entryEl.createDiv({ cls: "entry-actions" });

    if (entry.canRollback) {
      const rollbackBtn = actionsRow.createEl("button", {
        text: "↩️ Rollback",
        cls: "action-btn rollback-btn",
      });
      rollbackBtn.addEventListener("click", () => {
        void this.handleRollback(entry);
      });
    }
  }

  /**
   * Render step list for an entry
   */
  private renderSteps(containerEl: HTMLElement, plan: TaskPlan): void {
    for (const step of plan.steps) {
      const stepEl = containerEl.createDiv({ cls: `step-item status-${step.status}` });

      const statusIcon =
        step.status === "completed"
          ? "✓"
          : step.status === "failed"
            ? "✗"
            : step.status === "rolled-back"
              ? "↩"
              : "○";

      stepEl.createSpan({ text: statusIcon, cls: "step-status" });
      stepEl.createSpan({ text: step.type, cls: "step-type" });
      stepEl.createSpan({ text: step.description, cls: "step-description" });
    }
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return formatDateTimeISO(date);
  }

  /**
   * Handle rollback of an entry
   */
  private async handleRollback(entry: TaskHistoryEntry): Promise<void> {
    const confirmed = await this.confirmRollback(entry);
    if (!confirmed) return;

    try {
      new Notice("Rolling back task...");

      const executor = createTaskExecutor(
        this.app,
        this.plugin.safeVault,
        this.plugin.safeVault.getBackup()
      );

      const rolledBackPlan = await executor.rollback(entry.plan);

      // Update history
      this.historyManager.markRolledBack(entry.id);
      await this.saveHistoryIfDirty();

      if (rolledBackPlan.error) {
        new Notice(`Rollback completed with warnings: ${rolledBackPlan.error}`);
      } else {
        new Notice("Rollback completed successfully!");
      }

      this.render();
    } catch (error) {
      console.error("[TaskHistory] Rollback failed:", error);
      new Notice(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Confirm rollback action
   */
  private async confirmRollback(entry: TaskHistoryEntry): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new RollbackConfirmModal(this.app, entry, resolve);
      modal.open();
    });
  }

  /**
   * Confirm clear history action
   */
  private async confirmClearHistory(): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      const modal = new ClearHistoryModal(this.app, resolve);
      modal.open();
    });

    if (confirmed) {
      this.historyManager.clear();
      await this.saveHistoryIfDirty();
      new Notice("Task history cleared");
      this.render();
    }
  }

  /**
   * Refresh the view
   */
  public async refresh(): Promise<void> {
    await this.loadHistory();
    this.render();
  }

  /**
   * Add an entry to history (called from ChatView after task execution)
   */
  public async addEntry(
    plan: TaskPlan,
    status: "completed" | "failed" | "rolled-back",
    error?: string
  ): Promise<void> {
    this.historyManager.addEntry(plan, status, error);
    await this.saveHistoryIfDirty();
    this.render();
  }

  /**
   * Get the history manager for external access
   */
  public getHistoryManager(): TaskHistoryManager {
    return this.historyManager;
  }

  /**
   * Add component styles
   */
  private addStyles(): void {
    const styleId = "pa-task-history-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .pa-task-history-container {
        padding: 16px;
        height: 100%;
        overflow-y: auto;
      }

      .pa-task-history-header h2 {
        margin: 0 0 12px 0;
      }

      .pa-task-history-stats {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      .stat-item {
        font-size: 0.9em;
        padding: 4px 8px;
        background: var(--background-secondary);
        border-radius: 4px;
      }

      .pa-task-history-filters {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .filter-btn {
        padding: 6px 12px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        cursor: pointer;
        font-size: 0.85em;
      }

      .filter-btn:hover {
        background: var(--background-modifier-hover);
      }

      .filter-btn.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
      }

      .filter-btn.clear-btn {
        margin-left: auto;
        color: var(--text-error);
        border-color: var(--text-error);
      }

      .pa-task-history-empty {
        text-align: center;
        padding: 32px;
        color: var(--text-muted);
      }

      .pa-task-history-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .pa-task-history-entry {
        background: var(--background-secondary);
        border-radius: 8px;
        padding: 12px;
        border-left: 4px solid var(--text-muted);
      }

      .pa-task-history-entry.status-completed {
        border-left-color: var(--text-success);
      }

      .pa-task-history-entry.status-failed {
        border-left-color: var(--text-error);
      }

      .pa-task-history-entry.status-rolled-back {
        border-left-color: var(--text-warning);
      }

      .entry-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .entry-status-icon {
        font-size: 1.1em;
      }

      .entry-description {
        flex: 1;
        font-weight: 500;
      }

      .entry-timestamp {
        font-size: 0.85em;
        color: var(--text-muted);
      }

      .entry-details {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.9em;
        color: var(--text-muted);
      }

      .steps-toggle {
        font-size: 0.8em;
        padding: 2px 8px;
        background: none;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        cursor: pointer;
      }

      .entry-error {
        margin-top: 8px;
        padding: 8px;
        background: var(--background-modifier-error);
        border-radius: 4px;
        color: var(--text-error);
        font-size: 0.9em;
      }

      .entry-steps {
        margin-top: 12px;
        padding-left: 8px;
        border-left: 2px solid var(--background-modifier-border);
      }

      .entry-steps.hidden {
        display: none;
      }

      .step-item {
        display: flex;
        gap: 8px;
        padding: 4px 0;
        font-size: 0.9em;
      }

      .step-status {
        width: 16px;
        text-align: center;
      }

      .step-type {
        font-family: var(--font-monospace);
        background: var(--background-primary);
        padding: 0 4px;
        border-radius: 2px;
        font-size: 0.85em;
      }

      .step-description {
        color: var(--text-muted);
      }

      .entry-actions {
        margin-top: 12px;
        display: flex;
        gap: 8px;
      }

      .action-btn {
        padding: 6px 12px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 0.85em;
      }

      .rollback-btn {
        background: var(--background-modifier-error);
        color: var(--text-on-accent);
      }

      .rollback-btn:hover {
        opacity: 0.9;
      }
    `;
    document.head.appendChild(style);
  }
}

import { Modal, App } from "obsidian";

/**
 * Modal for confirming rollback
 */
class RollbackConfirmModal extends Modal {
  private entry: TaskHistoryEntry;
  private resolve: (value: boolean) => void;

  public constructor(app: App, entry: TaskHistoryEntry, resolve: (value: boolean) => void) {
    super(app);
    this.entry = entry;
    this.resolve = resolve;
  }

  public onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pa-rollback-confirm-modal");

    contentEl.createEl("h2", { text: "Confirm Rollback" });

    contentEl.createEl("p", {
      text: `Are you sure you want to rollback "${this.entry.plan.description}"?`,
    });

    contentEl.createEl("p", {
      text: `This will undo ${this.entry.plan.steps.length} step${this.entry.plan.steps.length !== 1 ? "s" : ""}.`,
      cls: "rollback-warning",
    });

    const buttonRow = contentEl.createDiv({ cls: "modal-button-row" });

    const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => {
      this.resolve(false);
      this.close();
    });

    const confirmBtn = buttonRow.createEl("button", {
      text: "Rollback",
      cls: "mod-warning",
    });
    confirmBtn.addEventListener("click", () => {
      this.resolve(true);
      this.close();
    });
  }

  public onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for confirming history clear
 */
class ClearHistoryModal extends Modal {
  private resolve: (value: boolean) => void;

  public constructor(app: App, resolve: (value: boolean) => void) {
    super(app);
    this.resolve = resolve;
  }

  public onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Clear Task History" });

    contentEl.createEl("p", {
      text: "Are you sure you want to clear all task history? This cannot be undone.",
    });

    const buttonRow = contentEl.createDiv({ cls: "modal-button-row" });

    const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => {
      this.resolve(false);
      this.close();
    });

    const confirmBtn = buttonRow.createEl("button", {
      text: "Clear All",
      cls: "mod-warning",
    });
    confirmBtn.addEventListener("click", () => {
      this.resolve(true);
      this.close();
    });
  }

  public onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
