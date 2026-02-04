/**
 * Modify Note Handler
 *
 * Handles modifying existing notes in the vault.
 */

import type { App, TFile } from "obsidian";
import type { TaskStep, UndoAction, ModifyNoteParams } from "../types";
import { BaseStepHandler, type StepHandlerResult, type UndoResult } from "./BaseStepHandler";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

/**
 * Handler for modify-note steps
 */
export class ModifyNoteHandler extends BaseStepHandler {
  private app: App;
  private vault: SafeVaultAccess;

  public constructor(app: App, vault: SafeVaultAccess) {
    super(["modify-note"]);
    this.app = app;
    this.vault = vault;
  }

  public async execute(step: TaskStep): Promise<StepHandlerResult> {
    const params = step.params as ModifyNoteParams;
    const { path, content, search, replace, append, prepend } = params;

    try {
      // Check if file exists
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file || !(file as TFile).extension) {
        return {
          success: false,
          path,
          error: `File not found: ${path}`,
        };
      }

      // Check consent
      if (!this.vault.isPathAllowed(path)) {
        return {
          success: false,
          path,
          error: `Access denied to path: ${path}`,
        };
      }

      // Get current content for backup
      const tFile = file as TFile;
      const originalContent = await this.app.vault.read(tFile);

      // Determine new content
      let newContent: string;

      if (content !== undefined) {
        // Full replacement
        newContent = content;
      } else if (search !== undefined) {
        // Search and replace
        newContent = originalContent.replace(search, replace || "");
      } else if (append !== undefined) {
        // Append
        newContent = originalContent + append;
      } else if (prepend !== undefined) {
        // Prepend
        newContent = prepend + originalContent;
      } else {
        return {
          success: false,
          path,
          error: "No modification specified (content, search/replace, append, or prepend)",
        };
      }

      // Use SafeVaultAccess to propose and apply the edit (handles backup)
      void this.vault.proposeEdit(path, newContent, step.description);
      const result = await this.vault.applyEdit(path);

      if (!result.success) {
        return {
          success: false,
          path,
          error: result.error || "Failed to apply edit",
        };
      }

      return {
        success: true,
        path,
        backupPath: result.backupPath,
        undoAction: {
          type: "restore",
          path,
          params: {
            originalContent,
            backupPath: result.backupPath,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        path,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async undo(undoAction: UndoAction): Promise<UndoResult> {
    if (undoAction.type !== "restore") {
      return { success: false, error: `Unexpected undo type: ${undoAction.type}` };
    }

    try {
      const { path, params } = undoAction;
      const originalContent = params?.originalContent as string | undefined;
      const backupPath = params?.backupPath as string | undefined;

      // Try to restore from backup first
      if (backupPath) {
        const result = await this.vault.revertEdit(path);
        if (result.success) {
          return { success: true };
        }
      }

      // Fall back to writing original content
      if (originalContent !== undefined) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file) {
          await this.app.vault.modify(file as TFile, originalContent);
          return { success: true };
        }
      }

      return {
        success: false,
        error: "Could not restore file - no backup or original content available",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
