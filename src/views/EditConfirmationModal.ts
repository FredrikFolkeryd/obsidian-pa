/**
 * Edit Confirmation Modal
 *
 * Displays a diff preview of proposed changes and asks for user confirmation
 * before applying AI-suggested edits to vault files.
 */

import { App, Modal, ButtonComponent, Setting } from "obsidian";
import type { ProposedEdit, WriteResult } from "../vault/SafeVaultAccess";

/**
 * Result of the modal interaction
 */
export type ConfirmationResult = "apply" | "cancel" | "revert";

/**
 * Callback for when user confirms or cancels the edit
 */
export type ConfirmationCallback = (
  result: ConfirmationResult,
  edit: ProposedEdit
) => Promise<WriteResult | null>;

/**
 * Modal that shows a diff preview and confirmation buttons
 */
export class EditConfirmationModal extends Modal {
  private edit: ProposedEdit;
  private callback: ConfirmationCallback;
  private result: ConfirmationResult = "cancel";

  public constructor(
    app: App,
    edit: ProposedEdit,
    callback: ConfirmationCallback
  ) {
    super(app);
    this.edit = edit;
    this.callback = callback;
  }

  public onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pa-edit-confirmation-modal");

    // Header
    contentEl.createEl("h2", { text: "Confirm Edit" });

    // File path
    new Setting(contentEl)
      .setName("File")
      .setDesc(this.edit.path);

    // Reason for edit
    new Setting(contentEl)
      .setName("Reason")
      .setDesc(this.edit.reason);

    // Diff container
    const diffContainer = contentEl.createDiv({ cls: "pa-diff-container" });
    diffContainer.createEl("h3", { text: "Changes" });

    // Create a simple diff view
    const diffEl = diffContainer.createDiv({ cls: "pa-diff-view" });
    this.renderDiff(diffEl);

    // Action buttons
    const buttonContainer = contentEl.createDiv({ cls: "pa-modal-buttons" });

    new ButtonComponent(buttonContainer)
      .setButtonText("Cancel")
      .onClick(() => {
        this.result = "cancel";
        this.close();
      });

    new ButtonComponent(buttonContainer)
      .setButtonText("Apply Changes")
      .setCta()
      .onClick(async () => {
        this.result = "apply";
        await this.executeAction();
        this.close();
      });
  }

  public onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Render a simple line-by-line diff
   */
  private renderDiff(container: HTMLElement): void {
    const originalLines = this.edit.originalContent.split("\n");
    const newLines = this.edit.newContent.split("\n");

    // Simple line-based diff
    const maxLines = Math.max(originalLines.length, newLines.length);

    // If content is short, show side-by-side
    if (maxLines <= 50) {
      this.renderShortDiff(container, originalLines, newLines);
    } else {
      // For longer content, show summary
      this.renderLongDiff(container, originalLines, newLines);
    }
  }

  /**
   * Render a short diff with removed/added lines
   */
  private renderShortDiff(
    container: HTMLElement,
    originalLines: string[],
    newLines: string[]
  ): void {
    // Find differences using LCS-based approach (simplified)
    const changes = this.computeSimpleDiff(originalLines, newLines);

    for (const change of changes) {
      const lineEl = container.createDiv({ cls: `pa-diff-line pa-diff-${change.type}` });

      const prefixSpan = lineEl.createSpan({ cls: "pa-diff-prefix" });
      const contentSpan = lineEl.createSpan({ cls: "pa-diff-content" });

      switch (change.type) {
        case "unchanged":
          prefixSpan.setText("  ");
          contentSpan.setText(change.content);
          break;
        case "removed":
          prefixSpan.setText("- ");
          contentSpan.setText(change.content);
          break;
        case "added":
          prefixSpan.setText("+ ");
          contentSpan.setText(change.content);
          break;
      }
    }
  }

  /**
   * Render a summary for long diffs
   */
  private renderLongDiff(
    container: HTMLElement,
    originalLines: string[],
    newLines: string[]
  ): void {
    const summary = container.createDiv({ cls: "pa-diff-summary" });
    summary.createEl("p", {
      text: `Original: ${originalLines.length} lines`,
    });
    summary.createEl("p", {
      text: `Modified: ${newLines.length} lines`,
    });
    summary.createEl("p", {
      text: `Difference: ${Math.abs(newLines.length - originalLines.length)} lines ${newLines.length > originalLines.length ? "added" : "removed"}`,
    });

    // Show first 10 and last 10 changes
    const changes = this.computeSimpleDiff(originalLines, newLines);
    const significantChanges = changes.filter((c) => c.type !== "unchanged");

    if (significantChanges.length > 0) {
      summary.createEl("p", {
        text: `${significantChanges.length} line(s) changed`,
      });
    }

    // Show preview of changes
    const previewLabel = container.createEl("h4", { text: "Preview (first 20 changes)" });
    previewLabel.style.marginTop = "1em";

    const previewContainer = container.createDiv({ cls: "pa-diff-preview" });
    const previewChanges = significantChanges.slice(0, 20);

    for (const change of previewChanges) {
      const lineEl = previewContainer.createDiv({ cls: `pa-diff-line pa-diff-${change.type}` });
      const prefixSpan = lineEl.createSpan({ cls: "pa-diff-prefix" });
      const contentSpan = lineEl.createSpan({ cls: "pa-diff-content" });

      prefixSpan.setText(change.type === "removed" ? "- " : "+ ");
      contentSpan.setText(change.content.substring(0, 80) + (change.content.length > 80 ? "..." : ""));
    }

    if (significantChanges.length > 20) {
      previewContainer.createEl("p", {
        text: `... and ${significantChanges.length - 20} more changes`,
        cls: "pa-diff-more",
      });
    }
  }

  /**
   * Compute a simple diff between two arrays of lines
   */
  private computeSimpleDiff(
    original: string[],
    modified: string[]
  ): Array<{ type: "unchanged" | "removed" | "added"; content: string }> {
    const result: Array<{ type: "unchanged" | "removed" | "added"; content: string }> = [];

    // Use a simple line-by-line comparison
    // For a real implementation, consider using a proper diff algorithm (LCS)
    const originalSet = new Set(original);
    const modifiedSet = new Set(modified);

    let oi = 0;
    let mi = 0;

    while (oi < original.length || mi < modified.length) {
      if (oi >= original.length) {
        // Only modified lines left
        result.push({ type: "added", content: modified[mi] });
        mi++;
      } else if (mi >= modified.length) {
        // Only original lines left
        result.push({ type: "removed", content: original[oi] });
        oi++;
      } else if (original[oi] === modified[mi]) {
        // Lines match
        result.push({ type: "unchanged", content: original[oi] });
        oi++;
        mi++;
      } else if (!modifiedSet.has(original[oi])) {
        // Original line not in modified
        result.push({ type: "removed", content: original[oi] });
        oi++;
      } else if (!originalSet.has(modified[mi])) {
        // Modified line not in original
        result.push({ type: "added", content: modified[mi] });
        mi++;
      } else {
        // Both exist elsewhere, treat as replacement
        result.push({ type: "removed", content: original[oi] });
        result.push({ type: "added", content: modified[mi] });
        oi++;
        mi++;
      }
    }

    return result;
  }

  /**
   * Execute the callback with the chosen action
   */
  private async executeAction(): Promise<void> {
    await this.callback(this.result, this.edit);
  }

  /**
   * Get the result after modal is closed
   */
  public getResult(): ConfirmationResult {
    return this.result;
  }
}

/**
 * Helper function to show confirmation modal and wait for result
 */
export function showEditConfirmation(
  app: App,
  edit: ProposedEdit,
  onApply: () => Promise<WriteResult | null>
): Promise<WriteResult | null> {
  return new Promise((resolve) => {
    const modal = new EditConfirmationModal(app, edit, async (result) => {
      if (result === "apply") {
        const writeResult = await onApply();
        resolve(writeResult);
        return writeResult;
      }
      resolve(null);
      return null;
    });
    modal.open();
  });
}
