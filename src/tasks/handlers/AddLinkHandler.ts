/**
 * Add Link Handler
 *
 * Handles adding wikilinks to notes.
 */

import type { App, TFile } from "obsidian";
import type { TaskStep, UndoAction, AddLinkParams } from "../types";
import { BaseStepHandler, type StepHandlerResult, type UndoResult } from "./BaseStepHandler";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

/**
 * Handler for add-link steps
 */
export class AddLinkHandler extends BaseStepHandler {
  private app: App;
  private vault: SafeVaultAccess;

  public constructor(app: App, vault: SafeVaultAccess) {
    super(["add-link"]);
    this.app = app;
    this.vault = vault;
  }

  /**
   * Format a wikilink
   */
  private formatLink(target: string, displayText?: string): string {
    // Remove .md extension from target for cleaner links
    const cleanTarget = target.replace(/\.md$/, "");

    if (displayText) {
      return `[[${cleanTarget}|${displayText}]]`;
    }
    return `[[${cleanTarget}]]`;
  }

  public async execute(step: TaskStep): Promise<StepHandlerResult> {
    const params = step.params as AddLinkParams;
    const { path, target, displayText, position = "append", section } = params;

    try {
      // Check if source file exists
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

      const tFile = file as TFile;
      const originalContent = await this.app.vault.read(tFile);
      const link = this.formatLink(target, displayText);

      // Check if link already exists
      if (originalContent.includes(link) || originalContent.includes(`[[${target.replace(/\.md$/, "")}`)) {
        return {
          success: false,
          path,
          error: `Link to ${target} already exists in ${path}`,
        };
      }

      let newContent: string;

      switch (position) {
        case "prepend":
          newContent = link + "\n" + originalContent;
          break;

        case "section":
          if (!section) {
            return {
              success: false,
              path,
              error: "Section name required when position is 'section'",
            };
          }
          newContent = this.insertAfterSection(originalContent, section, link);
          break;

        case "append":
        default:
          // Ensure there's a newline before the link
          newContent = originalContent.trimEnd() + "\n" + link + "\n";
          break;
      }

      // Apply the edit
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
          type: "remove-link",
          path,
          params: {
            link,
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

  /**
   * Insert content after a section heading
   */
  private insertAfterSection(content: string, sectionName: string, textToInsert: string): string {
    const lines = content.split("\n");
    const sectionRegex = new RegExp(`^#+\\s+${this.escapeRegex(sectionName)}\\s*$`, "i");

    for (let i = 0; i < lines.length; i++) {
      if (sectionRegex.test(lines[i])) {
        // Insert after the heading
        lines.splice(i + 1, 0, textToInsert);
        return lines.join("\n");
      }
    }

    // Section not found, append at end
    return content.trimEnd() + "\n\n## " + sectionName + "\n" + textToInsert + "\n";
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  public async undo(undoAction: UndoAction): Promise<UndoResult> {
    if (undoAction.type !== "remove-link") {
      return { success: false, error: `Unexpected undo type: ${undoAction.type}` };
    }

    try {
      const { path, params } = undoAction;
      const backupPath = params?.backupPath as string | undefined;
      const originalContent = params?.originalContent as string | undefined;

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
