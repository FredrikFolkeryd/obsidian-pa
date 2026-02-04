/**
 * Create Note Handler
 *
 * Handles creating new notes in the vault.
 */

import type { App } from "obsidian";
import type { TaskStep, UndoAction, CreateNoteParams } from "../types";
import { BaseStepHandler, type StepHandlerResult, type UndoResult } from "./BaseStepHandler";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

/**
 * Handler for create-note steps
 */
export class CreateNoteHandler extends BaseStepHandler {
  private app: App;
  private vault: SafeVaultAccess;

  public constructor(app: App, vault: SafeVaultAccess) {
    super(["create-note"]);
    this.app = app;
    this.vault = vault;
  }

  public async execute(step: TaskStep): Promise<StepHandlerResult> {
    const params = step.params as CreateNoteParams;
    const { path, content } = params;

    try {
      // Check if file already exists
      const existingFile = this.app.vault.getAbstractFileByPath(path);
      if (existingFile) {
        return {
          success: false,
          path,
          error: `File already exists: ${path}`,
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

      // Create the file
      await this.app.vault.create(path, content || "");

      return {
        success: true,
        path,
        undoAction: {
          type: "delete",
          path,
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
    if (undoAction.type !== "delete") {
      return { success: false, error: `Unexpected undo type: ${undoAction.type}` };
    }

    try {
      const file = this.app.vault.getAbstractFileByPath(undoAction.path);
      if (!file) {
        // File doesn't exist, consider undo successful
        return { success: true };
      }

      await this.app.vault.delete(file);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
