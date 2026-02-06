/**
 * Edit History Modal
 *
 * Shows a list of recent AI-initiated edits with the ability to:
 * - View edit details (file, timestamp, reason)
 * - Revert any specific edit
 * - Clear edit history
 */

import { Modal, App } from "obsidian";
import type { WriteAuditEntry, SafeVaultAccess } from "../vault/SafeVaultAccess";
import { formatRelativeTime } from "../chat/helpers";

/**
 * Result from the edit history modal
 */
export interface EditHistoryResult {
  action: "close" | "revert" | "clear";
  revertPath?: string;
}

/**
 * Modal for viewing and managing edit history
 */
export class EditHistoryModal extends Modal {
  private safeVault: SafeVaultAccess;
  private onResult: (result: EditHistoryResult) => void;
  private resolved = false;

  public constructor(
    app: App,
    safeVault: SafeVaultAccess,
    onResult: (result: EditHistoryResult) => void
  ) {
    super(app);
    this.safeVault = safeVault;
    this.onResult = onResult;
  }

  public onOpen(): void {
    const { contentEl, titleEl } = this;

    titleEl.setText("Edit History");
    contentEl.addClass("pa-edit-history");

    const auditLog = this.safeVault.getAuditLog();
    const edits = [...auditLog]
      .filter((e) => e.operation !== "revert" && e.success)
      .reverse(); // Most recent first

    if (edits.length === 0) {
      this.renderEmptyState(contentEl);
    } else {
      this.renderEditList(contentEl, edits);
    }

    // Footer buttons
    const footer = contentEl.createDiv({ cls: "pa-edit-history-footer" });

    if (edits.length > 0) {
      const clearBtn = footer.createEl("button", {
        text: "Clear History",
        cls: "pa-edit-history-clear-btn",
      });
      clearBtn.addEventListener("click", () => {
        this.resolve({ action: "clear" });
      });
    }

    const closeBtn = footer.createEl("button", {
      text: "Close",
      cls: "pa-edit-history-close-btn",
    });
    closeBtn.addEventListener("click", () => {
      this.resolve({ action: "close" });
    });

    this.addStyles();
  }

  public onClose(): void {
    if (!this.resolved) {
      this.resolve({ action: "close" });
    }
    this.contentEl.empty();
  }

  private resolve(result: EditHistoryResult): void {
    if (this.resolved) return;
    this.resolved = true;
    this.onResult(result);
    this.close();
  }

  private renderEmptyState(container: HTMLElement): void {
    const empty = container.createDiv({ cls: "pa-edit-history-empty" });
    empty.createEl("p", { text: "No edits recorded yet." });
    empty.createEl("p", {
      text: "When you apply AI-suggested edits, they will appear here.",
      cls: "pa-edit-history-hint",
    });
  }

  private renderEditList(
    container: HTMLElement,
    edits: WriteAuditEntry[]
  ): void {
    const list = container.createDiv({ cls: "pa-edit-history-list" });

    // Show summary
    const summary = container.createDiv({ cls: "pa-edit-history-summary" });
    summary.setText(`${edits.length} edit${edits.length === 1 ? "" : "s"} recorded`);

    edits.forEach((edit, index) => {
      const item = list.createDiv({ cls: "pa-edit-history-item" });

      // Header with file path and time
      const header = item.createDiv({ cls: "pa-edit-history-item-header" });
      const pathEl = header.createSpan({ cls: "pa-edit-history-path" });
      pathEl.setText(edit.path);

      const timeEl = header.createSpan({ cls: "pa-edit-history-time" });
      timeEl.setText(this.formatTime(edit.timestamp));

      // Operation badge
      const badge = header.createSpan({
        cls: `pa-edit-history-badge pa-edit-history-badge-${edit.operation}`,
      });
      badge.setText(edit.operation);

      // Reason
      if (edit.reason) {
        const reason = item.createDiv({ cls: "pa-edit-history-reason" });
        reason.setText(edit.reason);
      }

      // Backup info
      if (edit.backupPath) {
        const backup = item.createDiv({ cls: "pa-edit-history-backup" });
        backup.createSpan({ text: "Backup: " });
        backup.createSpan({
          text: edit.backupPath.split("/").pop() || edit.backupPath,
          cls: "pa-edit-history-backup-path",
        });
      }

      // Revert button (only for most recent non-reverted edits)
      if (index === 0) {
        const revertBtn = item.createEl("button", {
          text: "↩ Revert",
          cls: "pa-edit-history-revert-btn",
        });
        revertBtn.addEventListener("click", () => {
          this.resolve({ action: "revert", revertPath: edit.path });
        });
      }
    });
  }

  private formatTime(timestamp: number): string {
    return formatRelativeTime(timestamp);
  }

  private addStyles(): void {
    if (document.getElementById("pa-edit-history-styles")) return;

    const style = document.createElement("style");
    style.id = "pa-edit-history-styles";
    style.textContent = `
      .pa-edit-history {
        max-width: 500px;
      }

      .pa-edit-history-empty {
        text-align: center;
        padding: 24px;
        color: var(--text-muted);
      }

      .pa-edit-history-hint {
        font-size: 0.85em;
        color: var(--text-faint);
      }

      .pa-edit-history-summary {
        font-size: 0.85em;
        color: var(--text-muted);
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .pa-edit-history-list {
        max-height: 350px;
        overflow-y: auto;
      }

      .pa-edit-history-item {
        padding: 12px;
        margin-bottom: 8px;
        background: var(--background-secondary);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
      }

      .pa-edit-history-item:hover {
        border-color: var(--interactive-accent);
      }

      .pa-edit-history-item-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .pa-edit-history-path {
        font-family: var(--font-monospace);
        font-size: 0.9em;
        font-weight: 500;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .pa-edit-history-time {
        font-size: 0.8em;
        color: var(--text-muted);
      }

      .pa-edit-history-badge {
        font-size: 0.7em;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        font-weight: 600;
      }

      .pa-edit-history-badge-create {
        background: rgba(0, 180, 0, 0.2);
        color: var(--text-success);
      }

      .pa-edit-history-badge-modify {
        background: rgba(0, 120, 255, 0.2);
        color: var(--text-accent);
      }

      .pa-edit-history-badge-revert {
        background: rgba(255, 180, 0, 0.2);
        color: var(--text-warning);
      }

      .pa-edit-history-reason {
        font-size: 0.85em;
        color: var(--text-muted);
        margin: 4px 0;
      }

      .pa-edit-history-backup {
        font-size: 0.75em;
        color: var(--text-faint);
        margin-top: 4px;
      }

      .pa-edit-history-backup-path {
        font-family: var(--font-monospace);
      }

      .pa-edit-history-revert-btn {
        margin-top: 8px;
        font-size: 0.85em;
        background: var(--background-modifier-hover);
      }

      .pa-edit-history-revert-btn:hover {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .pa-edit-history-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--background-modifier-border);
      }

      .pa-edit-history-clear-btn {
        background: var(--background-modifier-error);
        color: var(--text-error);
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Show the edit history modal and return a promise
 */
export function showEditHistory(
  app: App,
  safeVault: SafeVaultAccess
): Promise<EditHistoryResult> {
  return new Promise((resolve) => {
    const modal = new EditHistoryModal(app, safeVault, resolve);
    modal.open();
  });
}
