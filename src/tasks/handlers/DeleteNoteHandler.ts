/**
 * Delete Note Handler
 *
 * Handles deleting notes from the vault with backup for undo.
 */

import type { App, TFile } from "obsidian";
import type { TaskStep, UndoAction } from "../types";
import { BaseStepHandler, type StepHandlerResult, type UndoResult } from "./BaseStepHandler";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

/**
 * Handler for delete-note steps
 */
export class DeleteNoteHandler extends BaseStepHandler {
  private app: App;
  private vault: SafeVaultAccess;

  public constructor(app: App, vault: SafeVaultAccess) {
    super(["delete-note"]);
    this.app = app;
    this.vault = vault;
  }

  public async execute(step: TaskStep): Promise<StepHandlerResult> {
    const params = step.params;
    const { path } = params;

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

      // Read content for backup before deleting
      const tFile = file as TFile;
      const content = await this.app.vault.read(tFile);

      // Delete the file
      await this.app.vault.delete(file);

      return {
        success: true,
        path,
        undoAction: {
          type: "recreate",
          path,
          params: {
            content,
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
    if (undoAction.type !== "recreate") {
      return { success: false, error: `Unexpected undo type: ${undoAction.type}` };
    }

    try {
      const { path, params } = undoAction;
      const content = params?.content as string | undefined;

      if (content === undefined) {
        return {
          success: false,
          error: "Cannot recreate file - no content backup available",
        };
      }

      // Check if file already exists (perhaps restored by user)
      const existingFile = this.app.vault.getAbstractFileByPath(path);
      if (existingFile) {
        return {
          success: true, // Consider it already restored
        };
      }

      // Recreate the file
      await this.app.vault.create(path, content);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
