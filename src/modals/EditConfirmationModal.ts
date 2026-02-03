/**
 * Edit Confirmation Modal
 *
 * Shows a diff preview and confirmation dialog before applying AI-suggested edits.
 * Provides Accept/Cancel buttons with clear visual feedback.
 */

import { Modal, App } from "obsidian";
import type { ProposedEdit } from "../vault/SafeVaultAccess";

/**
 * Result of the confirmation modal
 */
export interface ConfirmationResult {
  confirmed: boolean;
  edit: ProposedEdit;
}

/**
 * Modal for confirming AI-proposed edits with diff preview
 */
export class EditConfirmationModal extends Modal {
  private edit: ProposedEdit;
  private onConfirm: (result: ConfirmationResult) => void;
  private resolved = false;

  public constructor(
    app: App,
    edit: ProposedEdit,
    onConfirm: (result: ConfirmationResult) => void
  ) {
    super(app);
    this.edit = edit;
    this.onConfirm = onConfirm;
  }

  public onOpen(): void {
    const { contentEl, titleEl } = this;

    // Title
    titleEl.setText("Confirm Edit");

    // Container
    contentEl.addClass("pa-edit-confirmation");

    // File info
    const fileInfo = contentEl.createDiv({ cls: "pa-edit-file-info" });
    fileInfo.createSpan({ text: "File: " });
    fileInfo.createEl("strong", { text: this.edit.path });

    // Reason
    if (this.edit.reason) {
      const reasonEl = contentEl.createDiv({ cls: "pa-edit-reason" });
      reasonEl.createSpan({ text: "Reason: " });
      reasonEl.createSpan({ text: this.edit.reason, cls: "pa-edit-reason-text" });
    }

    // Diff preview
    const diffContainer = contentEl.createDiv({ cls: "pa-edit-diff-container" });
    this.renderDiff(diffContainer);

    // Button container
    const buttonContainer = contentEl.createDiv({ cls: "pa-edit-buttons" });

    // Cancel button
    const cancelBtn = buttonContainer.createEl("button", {
      text: "Cancel",
      cls: "pa-edit-cancel-btn",
    });
    cancelBtn.addEventListener("click", () => {
      this.resolve(false);
    });

    // Apply button (primary)
    const applyBtn = buttonContainer.createEl("button", {
      text: "Apply Edit",
      cls: "pa-edit-apply-btn mod-cta",
    });
    applyBtn.addEventListener("click", () => {
      this.resolve(true);
    });

    // Add styles
    this.addStyles();

    // Focus apply button for keyboard confirmation
    applyBtn.focus();
  }

  public onClose(): void {
    // If closed without resolving, treat as cancel
    if (!this.resolved) {
      this.resolve(false);
    }
    this.contentEl.empty();
  }

  private resolve(confirmed: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.onConfirm({ confirmed, edit: this.edit });
    this.close();
  }

  /**
   * Render a simple line-by-line diff
   */
  private renderDiff(container: HTMLElement): void {
    const oldLines = this.edit.originalContent.split("\n");
    const newLines = this.edit.newContent.split("\n");

    // Check if this is a new file
    if (!this.edit.originalContent) {
      container.createDiv({ cls: "pa-diff-header" }).setText("New file");
      const newContent = container.createDiv({ cls: "pa-diff-new-file" });
      newContent.createEl("pre", { text: this.edit.newContent.slice(0, 2000) });
      if (this.edit.newContent.length > 2000) {
        newContent.createDiv({ cls: "pa-diff-truncated", text: "... (truncated)" });
      }
      return;
    }

    // Simple diff visualization
    const diffLines = this.computeSimpleDiff(oldLines, newLines);
    
    // Header with stats
    const stats = this.computeDiffStats(diffLines);
    const header = container.createDiv({ cls: "pa-diff-header" });
    header.createSpan({ text: `+${stats.additions} `, cls: "pa-diff-stat-add" });
    header.createSpan({ text: `-${stats.deletions}`, cls: "pa-diff-stat-del" });

    // Diff content (scrollable)
    const diffContent = container.createDiv({ cls: "pa-diff-content" });
    const pre = diffContent.createEl("pre", { cls: "pa-diff-pre" });

    // Limit displayed lines for very large diffs
    const maxLines = 100;
    const displayLines = diffLines.slice(0, maxLines);

    for (const line of displayLines) {
      const lineEl = pre.createDiv({
        cls: `pa-diff-line pa-diff-${line.type}`,
      });
      lineEl.createSpan({
        cls: "pa-diff-prefix",
        text: line.type === "add" ? "+" : line.type === "del" ? "-" : " ",
      });
      lineEl.createSpan({ cls: "pa-diff-text", text: line.text });
    }

    if (diffLines.length > maxLines) {
      pre.createDiv({
        cls: "pa-diff-truncated",
        text: `... ${diffLines.length - maxLines} more lines`,
      });
    }
  }

  /**
   * Compute a simple line diff (not optimal, but good enough for preview)
   */
  private computeSimpleDiff(
    oldLines: string[],
    newLines: string[]
  ): Array<{ type: "add" | "del" | "same"; text: string }> {
    const result: Array<{ type: "add" | "del" | "same"; text: string }> = [];

    // Use a simple LCS-based approach for small files
    // For large files, just show before/after
    if (oldLines.length + newLines.length > 500) {
      // Too large for detailed diff
      result.push({ type: "same", text: "--- Original ---" });
      oldLines.slice(0, 10).forEach((line) => result.push({ type: "del", text: line }));
      if (oldLines.length > 10) {
        result.push({ type: "same", text: `... ${oldLines.length - 10} more lines ...` });
      }
      result.push({ type: "same", text: "" });
      result.push({ type: "same", text: "--- New ---" });
      newLines.slice(0, 10).forEach((line) => result.push({ type: "add", text: line }));
      if (newLines.length > 10) {
        result.push({ type: "same", text: `... ${newLines.length - 10} more lines ...` });
      }
      return result;
    }

    // Simple diff algorithm - compare lines
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    let i = 0;
    let j = 0;

    while (i < oldLines.length || j < newLines.length) {
      if (i >= oldLines.length) {
        // Rest are additions
        result.push({ type: "add", text: newLines[j] });
        j++;
      } else if (j >= newLines.length) {
        // Rest are deletions
        result.push({ type: "del", text: oldLines[i] });
        i++;
      } else if (oldLines[i] === newLines[j]) {
        // Same line
        result.push({ type: "same", text: oldLines[i] });
        i++;
        j++;
      } else if (!newSet.has(oldLines[i])) {
        // Old line was deleted
        result.push({ type: "del", text: oldLines[i] });
        i++;
      } else if (!oldSet.has(newLines[j])) {
        // New line was added
        result.push({ type: "add", text: newLines[j] });
        j++;
      } else {
        // Lines changed - show both
        result.push({ type: "del", text: oldLines[i] });
        result.push({ type: "add", text: newLines[j] });
        i++;
        j++;
      }
    }

    return result;
  }

  /**
   * Compute diff statistics
   */
  private computeDiffStats(
    diffLines: Array<{ type: "add" | "del" | "same"; text: string }>
  ): { additions: number; deletions: number } {
    let additions = 0;
    let deletions = 0;

    for (const line of diffLines) {
      if (line.type === "add") additions++;
      if (line.type === "del") deletions++;
    }

    return { additions, deletions };
  }

  /**
   * Add modal styles
   */
  private addStyles(): void {
    if (document.getElementById("pa-edit-confirmation-styles")) return;

    const style = document.createElement("style");
    style.id = "pa-edit-confirmation-styles";
    style.textContent = `
      .pa-edit-confirmation {
        max-width: 600px;
      }

      .pa-edit-file-info {
        margin-bottom: 8px;
        font-size: 0.95em;
      }

      .pa-edit-reason {
        margin-bottom: 12px;
        font-size: 0.85em;
        color: var(--text-muted);
      }

      .pa-edit-diff-container {
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        margin-bottom: 16px;
        overflow: hidden;
      }

      .pa-diff-header {
        padding: 8px 12px;
        background: var(--background-secondary);
        border-bottom: 1px solid var(--background-modifier-border);
        font-size: 0.85em;
      }

      .pa-diff-stat-add {
        color: var(--text-success);
      }

      .pa-diff-stat-del {
        color: var(--text-error);
      }

      .pa-diff-content {
        max-height: 300px;
        overflow-y: auto;
      }

      .pa-diff-pre {
        margin: 0;
        padding: 8px;
        font-size: 0.8em;
        font-family: var(--font-monospace);
        line-height: 1.4;
      }

      .pa-diff-new-file pre {
        margin: 0;
        padding: 12px;
        font-size: 0.8em;
        font-family: var(--font-monospace);
        background: var(--background-secondary);
        overflow-x: auto;
      }

      .pa-diff-line {
        display: flex;
        white-space: pre-wrap;
        word-break: break-all;
      }

      .pa-diff-add {
        background: rgba(0, 200, 0, 0.1);
      }

      .pa-diff-del {
        background: rgba(200, 0, 0, 0.1);
      }

      .pa-diff-prefix {
        display: inline-block;
        width: 16px;
        flex-shrink: 0;
        color: var(--text-muted);
        user-select: none;
      }

      .pa-diff-add .pa-diff-prefix {
        color: var(--text-success);
      }

      .pa-diff-del .pa-diff-prefix {
        color: var(--text-error);
      }

      .pa-diff-truncated {
        padding: 8px;
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
      }

      .pa-edit-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .pa-edit-cancel-btn {
        background: var(--background-modifier-hover);
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Show the edit confirmation modal and return a promise
 */
export function showEditConfirmation(
  app: App,
  edit: ProposedEdit
): Promise<ConfirmationResult> {
  return new Promise((resolve) => {
    const modal = new EditConfirmationModal(app, edit, resolve);
    modal.open();
  });
}
