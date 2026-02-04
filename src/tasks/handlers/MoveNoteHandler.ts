/**
 * Move Note Handler
 *
 * Handles moving/renaming notes in the vault.
 */

import type { App, TFile } from "obsidian";
import type { TaskStep, UndoAction, MoveNoteParams } from "../types";
import { BaseStepHandler, type StepHandlerResult, type UndoResult } from "./BaseStepHandler";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

/**
 * Handler for move-note steps
 */
export class MoveNoteHandler extends BaseStepHandler {
  private app: App;
  private vault: SafeVaultAccess;

  public constructor(app: App, vault: SafeVaultAccess) {
    super(["move-note"]);
    this.app = app;
    this.vault = vault;
  }

  public async execute(step: TaskStep): Promise<StepHandlerResult> {
    const params = step.params as MoveNoteParams;
    const { path, newPath, updateLinks = true } = params;

    try {
      // Check if source file exists
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file || !(file as TFile).extension) {
        return {
          success: false,
          path,
          error: `Source file not found: ${path}`,
        };
      }

      // Check if destination already exists
      const destFile = this.app.vault.getAbstractFileByPath(newPath);
      if (destFile) {
        return {
          success: false,
          path,
          error: `Destination already exists: ${newPath}`,
        };
      }

      // Check consent for both paths
      if (!this.vault.isPathAllowed(path)) {
        return {
          success: false,
          path,
          error: `Access denied to source path: ${path}`,
        };
      }

      if (!this.vault.isPathAllowed(newPath)) {
        return {
          success: false,
          path,
          error: `Access denied to destination path: ${newPath}`,
        };
      }

      // Perform the move/rename
      const tFile = file as TFile;
      await this.app.fileManager.renameFile(tFile, newPath);

      // Update links if requested (Obsidian handles this automatically with renameFile,
      // but we track it for documentation purposes)
      const linksUpdated = updateLinks;

      return {
        success: true,
        path: newPath,
        metadata: {
          originalPath: path,
          linksUpdated,
        },
        undoAction: {
          type: "move-back",
          path: newPath,
          params: {
            originalPath: path,
            updateLinks,
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
    if (undoAction.type !== "move-back") {
      return { success: false, error: `Unexpected undo type: ${undoAction.type}` };
    }

    try {
      const { path, params } = undoAction;
      const originalPath = params?.originalPath as string | undefined;

      if (!originalPath) {
        return {
          success: false,
          error: "Cannot undo move - original path not recorded",
        };
      }

      // Check if moved file still exists at new location
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file) {
        // File has been deleted or moved again, can't undo
        return {
          success: false,
          error: `File no longer exists at: ${path}`,
        };
      }

      // Check if original location is now occupied
      const originalFile = this.app.vault.getAbstractFileByPath(originalPath);
      if (originalFile) {
        return {
          success: false,
          error: `Cannot move back - original path is now occupied: ${originalPath}`,
        };
      }

      // Move back to original location
      const tFile = file as TFile;
      await this.app.fileManager.renameFile(tFile, originalPath);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
