/**
 * Edit Confirmation Modal
 *
 * Shows a diff preview and confirmation dialog before applying AI-suggested edits.
 * Provides Accept/Cancel buttons with clear visual feedback.
 *
 * Features:
 * - Line numbers in diff view
 * - Unified diff with context
 * - Color-coded additions/deletions
 * - Statistics (lines added/removed)
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
 * A single line in the diff output with line number tracking
 */
interface DiffLine {
  type: "add" | "del" | "same" | "context";
  text: string;
  oldLineNum?: number;
  newLineNum?: number;
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
   * Render a unified diff with line numbers
   */
  private renderDiff(container: HTMLElement): void {
    const oldLines = this.edit.originalContent.split("\n");
    const newLines = this.edit.newContent.split("\n");

    // Check if this is a new file
    if (!this.edit.originalContent) {
      container.createDiv({ cls: "pa-diff-header" }).setText("✨ New file");
      const newContent = container.createDiv({ cls: "pa-diff-new-file" });
      const pre = newContent.createEl("pre");
      const displayContent = this.edit.newContent.slice(0, 2000);
      displayContent.split("\n").forEach((line, i) => {
        const lineEl = pre.createDiv({ cls: "pa-diff-line pa-diff-add" });
        lineEl.createSpan({ cls: "pa-diff-linenum", text: String(i + 1).padStart(4, " ") });
        lineEl.createSpan({ cls: "pa-diff-prefix", text: "+" });
        lineEl.createSpan({ cls: "pa-diff-text", text: line || " " });
      });
      if (this.edit.newContent.length > 2000) {
        newContent.createDiv({ cls: "pa-diff-truncated", text: "... (truncated)" });
      }
      return;
    }

    // Compute unified diff with line numbers
    const diffLines = this.computeUnifiedDiff(oldLines, newLines);
    
    // Header with stats
    const stats = this.computeDiffStats(diffLines);
    const header = container.createDiv({ cls: "pa-diff-header" });
    header.createSpan({ text: `+${stats.additions} `, cls: "pa-diff-stat-add" });
    header.createSpan({ text: `-${stats.deletions} `, cls: "pa-diff-stat-del" });
    header.createSpan({ text: `(${stats.same} unchanged)`, cls: "pa-diff-stat-same" });

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
      
      // Line numbers (old:new format)
      const oldNum = line.oldLineNum !== undefined ? String(line.oldLineNum).padStart(4, " ") : "    ";
      const newNum = line.newLineNum !== undefined ? String(line.newLineNum).padStart(4, " ") : "    ";
      lineEl.createSpan({ cls: "pa-diff-linenum", text: oldNum });
      lineEl.createSpan({ cls: "pa-diff-linenum-sep", text: "│" });
      lineEl.createSpan({ cls: "pa-diff-linenum", text: newNum });
      
      // Prefix (+/-/space)
      const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
      lineEl.createSpan({ cls: "pa-diff-prefix", text: prefix });
      
      // Text content (preserve empty lines)
      lineEl.createSpan({ cls: "pa-diff-text", text: line.text || " " });
    }

    if (diffLines.length > maxLines) {
      pre.createDiv({
        cls: "pa-diff-truncated",
        text: `... ${diffLines.length - maxLines} more lines`,
      });
    }
  }

  /**
   * Compute a unified diff with line numbers using Myers-like algorithm
   */
  private computeUnifiedDiff(oldLines: string[], newLines: string[]): DiffLine[] {
    const result: DiffLine[] = [];

    // For very large files, use a simpler comparison
    if (oldLines.length + newLines.length > 500) {
      return this.computeLargeDiff(oldLines, newLines);
    }

    // Build a map of old lines for quick lookup
    const oldLineMap = new Map<string, number[]>();
    oldLines.forEach((line, i) => {
      const indices = oldLineMap.get(line) || [];
      indices.push(i);
      oldLineMap.set(line, indices);
    });

    // Use Longest Common Subsequence for accurate diff
    const lcs = this.computeLCS(oldLines, newLines);
    
    let oldIdx = 0;
    let newIdx = 0;
    let lcsIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      // Check if current lines match LCS
      const lcsMatch = lcsIdx < lcs.length ? lcs[lcsIdx] : null;
      
      if (lcsMatch && oldIdx === lcsMatch.oldIdx && newIdx === lcsMatch.newIdx) {
        // This line is in both - unchanged
        result.push({
          type: "same",
          text: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else if (lcsMatch && oldIdx < lcsMatch.oldIdx && newIdx < lcsMatch.newIdx) {
        // Both need to catch up - show deletion then addition
        result.push({
          type: "del",
          text: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
        });
        oldIdx++;
      } else if (lcsMatch && oldIdx < lcsMatch.oldIdx) {
        // Old needs to catch up - deletion
        result.push({
          type: "del",
          text: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
        });
        oldIdx++;
      } else if (lcsMatch && newIdx < lcsMatch.newIdx) {
        // New needs to catch up - addition
        result.push({
          type: "add",
          text: newLines[newIdx],
          newLineNum: newIdx + 1,
        });
        newIdx++;
      } else if (oldIdx < oldLines.length) {
        // No more LCS matches, remaining old lines are deletions
        result.push({
          type: "del",
          text: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
        });
        oldIdx++;
      } else if (newIdx < newLines.length) {
        // No more LCS matches, remaining new lines are additions
        result.push({
          type: "add",
          text: newLines[newIdx],
          newLineNum: newIdx + 1,
        });
        newIdx++;
      }
    }

    return result;
  }

  /**
   * Compute Longest Common Subsequence between old and new lines
   */
  private computeLCS(
    oldLines: string[],
    newLines: string[]
  ): Array<{ oldIdx: number; newIdx: number }> {
    const m = oldLines.length;
    const n = newLines.length;
    
    // Build LCS table
    const dp: number[][] = [];
    for (let row = 0; row <= m; row++) {
      dp.push(new Array<number>(n + 1).fill(0));
    }
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find LCS
    const lcs: Array<{ oldIdx: number; newIdx: number }> = [];
    let i = m;
    let j = n;
    
    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs.unshift({ oldIdx: i - 1, newIdx: j - 1 });
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    
    return lcs;
  }

  /**
   * Simplified diff for large files - shows changed regions
   */
  private computeLargeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
    const result: DiffLine[] = [];
    const contextLines = 3;
    
    // Find changed line ranges
    const changes: Array<{ oldStart: number; oldEnd: number; newStart: number; newEnd: number }> = [];
    let oldIdx = 0;
    let newIdx = 0;
    
    while (oldIdx < oldLines.length && newIdx < newLines.length) {
      if (oldLines[oldIdx] === newLines[newIdx]) {
        oldIdx++;
        newIdx++;
      } else {
        // Found a difference - find extent
        const changeStart = { old: oldIdx, new: newIdx };
        while (oldIdx < oldLines.length && newIdx < newLines.length && oldLines[oldIdx] !== newLines[newIdx]) {
          oldIdx++;
          newIdx++;
        }
        changes.push({ 
          oldStart: changeStart.old, 
          oldEnd: oldIdx, 
          newStart: changeStart.new, 
          newEnd: newIdx 
        });
      }
    }
    
    // Handle remaining lines
    if (oldIdx < oldLines.length || newIdx < newLines.length) {
      changes.push({
        oldStart: oldIdx,
        oldEnd: oldLines.length,
        newStart: newIdx,
        newEnd: newLines.length,
      });
    }
    
    // Show summary for large files
    result.push({
      type: "context",
      text: `--- Large file: ${oldLines.length} → ${newLines.length} lines, ${changes.length} change(s) ---`,
    });
    
    // Show first few changes with context
    const maxChanges = 5;
    for (let c = 0; c < Math.min(changes.length, maxChanges); c++) {
      const change = changes[c];
      
      // Context before
      for (let i = Math.max(0, change.oldStart - contextLines); i < change.oldStart; i++) {
        result.push({ type: "same", text: oldLines[i], oldLineNum: i + 1, newLineNum: i + 1 });
      }
      
      // Deletions
      for (let i = change.oldStart; i < change.oldEnd; i++) {
        result.push({ type: "del", text: oldLines[i], oldLineNum: i + 1 });
      }
      
      // Additions
      for (let i = change.newStart; i < change.newEnd; i++) {
        result.push({ type: "add", text: newLines[i], newLineNum: i + 1 });
      }
      
      // Context after
      const contextEnd = Math.min(oldLines.length, change.oldEnd + contextLines);
      for (let i = change.oldEnd; i < contextEnd; i++) {
        result.push({ type: "same", text: oldLines[i], oldLineNum: i + 1, newLineNum: i + 1 });
      }
      
      if (c < Math.min(changes.length, maxChanges) - 1) {
        result.push({ type: "context", text: "..." });
      }
    }
    
    if (changes.length > maxChanges) {
      result.push({ type: "context", text: `... and ${changes.length - maxChanges} more change(s)` });
    }
    
    return result;
  }

  /**
   * Compute diff statistics
   */
  private computeDiffStats(
    diffLines: DiffLine[]
  ): { additions: number; deletions: number; same: number } {
    let additions = 0;
    let deletions = 0;
    let same = 0;

    for (const line of diffLines) {
      if (line.type === "add") additions++;
      else if (line.type === "del") deletions++;
      else if (line.type === "same") same++;
    }

    return { additions, deletions, same };
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
        max-width: 700px;
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
        font-weight: 500;
      }

      .pa-diff-stat-del {
        color: var(--text-error);
        font-weight: 500;
      }

      .pa-diff-stat-same {
        color: var(--text-muted);
      }

      .pa-diff-content {
        max-height: 350px;
        overflow-y: auto;
      }

      .pa-diff-pre {
        margin: 0;
        padding: 0;
        font-size: 0.8em;
        font-family: var(--font-monospace);
        line-height: 1.5;
      }

      .pa-diff-new-file pre {
        margin: 0;
        padding: 0;
        font-size: 0.8em;
        font-family: var(--font-monospace);
        background: var(--background-secondary);
        overflow-x: auto;
      }

      .pa-diff-line {
        display: flex;
        white-space: pre;
        padding: 0 8px 0 0;
        min-height: 1.5em;
      }

      .pa-diff-line:hover {
        background: var(--background-modifier-hover);
      }

      .pa-diff-add {
        background: rgba(0, 180, 0, 0.12);
      }

      .pa-diff-del {
        background: rgba(200, 0, 0, 0.12);
      }

      .pa-diff-context {
        background: var(--background-secondary);
        font-style: italic;
        color: var(--text-muted);
      }

      .pa-diff-linenum {
        display: inline-block;
        width: 40px;
        flex-shrink: 0;
        text-align: right;
        color: var(--text-faint);
        background: var(--background-secondary);
        padding: 0 4px;
        user-select: none;
        font-size: 0.9em;
      }

      .pa-diff-linenum-sep {
        display: inline-block;
        width: 12px;
        flex-shrink: 0;
        text-align: center;
        color: var(--background-modifier-border);
        background: var(--background-secondary);
        user-select: none;
      }

      .pa-diff-prefix {
        display: inline-block;
        width: 20px;
        flex-shrink: 0;
        text-align: center;
        color: var(--text-muted);
        user-select: none;
        font-weight: 600;
      }

      .pa-diff-add .pa-diff-prefix {
        color: var(--text-success);
      }

      .pa-diff-del .pa-diff-prefix {
        color: var(--text-error);
      }

      .pa-diff-text {
        flex: 1;
        overflow-x: auto;
      }

      .pa-diff-truncated {
        padding: 12px;
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
        background: var(--background-secondary);
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
