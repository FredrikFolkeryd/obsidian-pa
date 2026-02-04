/**
 * Add Tag Handler
 *
 * Handles adding tags to note frontmatter.
 */

import type { App, TFile } from "obsidian";
import type { TaskStep, UndoAction, AddTagParams } from "../types";
import { BaseStepHandler, type StepHandlerResult, type UndoResult } from "./BaseStepHandler";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

/**
 * Handler for add-tag steps
 */
export class AddTagHandler extends BaseStepHandler {
  private app: App;
  private vault: SafeVaultAccess;

  public constructor(app: App, vault: SafeVaultAccess) {
    super(["add-tag"]);
    this.app = app;
    this.vault = vault;
  }

  public async execute(step: TaskStep): Promise<StepHandlerResult> {
    const params = step.params as AddTagParams;
    const { path, tag } = params;

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

      const tFile = file as TFile;
      const originalContent = await this.app.vault.read(tFile);

      // Normalize tag (remove # if present)
      const normalizedTag = tag.replace(/^#/, "");

      // Check if tag already exists
      if (this.hasTag(originalContent, normalizedTag)) {
        return {
          success: false,
          path,
          error: `Tag '${normalizedTag}' already exists in ${path}`,
        };
      }

      // Add the tag
      const newContent = this.addTagToContent(originalContent, normalizedTag);

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
          type: "remove-tag",
          path,
          params: {
            tag: normalizedTag,
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
   * Check if a tag exists in content (in frontmatter or inline)
   */
  private hasTag(content: string, tag: string): boolean {
    // Check frontmatter tags
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      // Check for tags array
      if (frontmatter.includes(`- ${tag}`)) {
        return true;
      }
      // Check for tags line
      const tagsLineMatch = frontmatter.match(/^tags:\s*\[([^\]]*)\]/m);
      if (tagsLineMatch && tagsLineMatch[1].includes(tag)) {
        return true;
      }
    }

    // Check for inline tag
    const inlineTagRegex = new RegExp(`#${this.escapeRegex(tag)}(?:\\s|$)`, "m");
    return inlineTagRegex.test(content);
  }

  /**
   * Add a tag to content (preferring frontmatter if present)
   */
  private addTagToContent(content: string, tag: string): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      // Has frontmatter - add to tags array
      const frontmatter = frontmatterMatch[1];
      let newFrontmatter: string;

      if (frontmatter.includes("tags:")) {
        // Tags field exists - add to it
        if (frontmatter.match(/^tags:\s*\[/m)) {
          // Array format: tags: [a, b]
          newFrontmatter = frontmatter.replace(
            /^(tags:\s*\[)([^\]]*?)(\])/m,
            (_match: string, prefix: string, existing: string, suffix: string) => {
              const tags = existing.trim() ? existing + ", " + tag : tag;
              return prefix + tags + suffix;
            }
          );
        } else if (frontmatter.match(/^tags:\s*$/m)) {
          // Empty tags field - add as list
          newFrontmatter = frontmatter.replace(
            /^tags:\s*$/m,
            `tags:\n${" ".repeat(2)}- ${tag}`
          );
        } else {
          // List format: tags:\n  - a
          newFrontmatter = frontmatter.replace(
            /^(tags:.*?)(\n(?:\s{2}- .*\n)*)/m,
            `$1$2${" ".repeat(2)}- ${tag}\n`
          );
        }
      } else {
        // No tags field - add one
        newFrontmatter = frontmatter + `\ntags:\n  - ${tag}`;
      }

      return content.replace(
        /^---\n[\s\S]*?\n---/,
        `---\n${newFrontmatter}\n---`
      );
    } else {
      // No frontmatter - add one
      return `---\ntags:\n  - ${tag}\n---\n\n${content}`;
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  public async undo(undoAction: UndoAction): Promise<UndoResult> {
    if (undoAction.type !== "remove-tag") {
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
