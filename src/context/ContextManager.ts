/**
 * Context Manager
 *
 * Manages context file selection and provides smart suggestions.
 * Coordinates between the context picker UI and the chat system.
 */

import { App, TFile, getLinkpath } from "obsidian";
import type { PASettings } from "../settings";
import type { ContextItem } from "./ContextPickerModal";
import { estimateTokens } from "./TokenBudget";

/**
 * Context file with content
 */
export interface ContextFile {
  path: string;
  basename: string;
  content: string;
  tokens: number;
}

/**
 * Suggestion reason for context
 */
export type SuggestionReason =
  | "linked-from-active"
  | "links-to-active"
  | "recent"
  | "same-folder"
  | "same-tag";

/**
 * A context suggestion
 */
export interface ContextSuggestion {
  file: TFile;
  reason: SuggestionReason;
  score: number;
}

/**
 * Manages context selection and provides suggestions
 */
export class ContextManager {
  private app: App;
  private settings: PASettings;

  // Currently selected context items
  private selectedItems: Map<string, ContextItem> = new Map();

  // Loaded context files with content
  private loadedFiles: Map<string, ContextFile> = new Map();

  public constructor(app: App, settings: PASettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Get all currently selected context items
   */
  public getSelectedItems(): ContextItem[] {
    return Array.from(this.selectedItems.values());
  }

  /**
   * Get loaded context files with content
   */
  public getLoadedFiles(): ContextFile[] {
    return Array.from(this.loadedFiles.values());
  }

  /**
   * Set selected items from picker
   */
  public async setSelectedItems(items: ContextItem[]): Promise<void> {
    this.selectedItems.clear();
    this.loadedFiles.clear();

    for (const item of items) {
      this.selectedItems.set(item.path, item);
      await this.loadFile(item.path);
    }
  }

  /**
   * Add a file to context
   */
  public async addFile(file: TFile): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    const tokens = estimateTokens(content);

    const item: ContextItem = {
      type: "file",
      path: file.path,
      name: file.basename,
      tokens,
    };

    this.selectedItems.set(file.path, item);
    this.loadedFiles.set(file.path, {
      path: file.path,
      basename: file.basename,
      content,
      tokens,
    });
  }

  /**
   * Remove a file from context
   */
  public removeFile(path: string): void {
    this.selectedItems.delete(path);
    this.loadedFiles.delete(path);
  }

  /**
   * Clear all context
   */
  public clearContext(): void {
    this.selectedItems.clear();
    this.loadedFiles.clear();
  }

  /**
   * Check if context has any files
   */
  public hasContext(): boolean {
    return this.selectedItems.size > 0;
  }

  /**
   * Get total token usage
   */
  public getTotalTokens(): number {
    let total = 0;
    for (const file of this.loadedFiles.values()) {
      total += file.tokens;
    }
    return total;
  }

  /**
   * Load a file's content
   */
  private async loadFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;

    const content = await this.app.vault.cachedRead(file);
    const tokens = estimateTokens(content);

    this.loadedFiles.set(path, {
      path: file.path,
      basename: file.basename,
      content,
      tokens,
    });
  }

  /**
   * Get smart context suggestions based on the active file
   *
   * @param activeFile - Currently active file
   * @param maxSuggestions - Maximum suggestions to return
   * @returns Ranked suggestions
   */
  public getSuggestions(
    activeFile: TFile | null,
    maxSuggestions = 10
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];
    const seen = new Set<string>();

    // Skip already-selected files
    for (const path of this.selectedItems.keys()) {
      seen.add(path);
    }

    // 1. Files linked from active file (highest priority)
    if (activeFile) {
      seen.add(activeFile.path);

      const cache = this.app.metadataCache.getFileCache(activeFile);
      if (cache?.links) {
        for (const link of cache.links) {
          const linkedPath = getLinkpath(link.link);
          const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
            linkedPath,
            activeFile.path
          );
          if (linkedFile instanceof TFile && !seen.has(linkedFile.path)) {
            if (this.isPathAllowed(linkedFile.path)) {
              suggestions.push({
                file: linkedFile,
                reason: "linked-from-active",
                score: 100,
              });
              seen.add(linkedFile.path);
            }
          }
        }
      }

      // 2. Files that link TO the active file (backlinks)
      const backlinks = this.getBacklinks(activeFile);
      for (const file of backlinks) {
        if (!seen.has(file.path) && this.isPathAllowed(file.path)) {
          suggestions.push({
            file,
            reason: "links-to-active",
            score: 80,
          });
          seen.add(file.path);
        }
      }

      // 3. Files in the same folder
      const sameFolder = this.getFilesInSameFolder(activeFile);
      for (const file of sameFolder) {
        if (!seen.has(file.path) && this.isPathAllowed(file.path)) {
          suggestions.push({
            file,
            reason: "same-folder",
            score: 50,
          });
          seen.add(file.path);
        }
      }

      // 4. Files with same tags (only if tags are strings)
      const frontmatterTags = cache?.frontmatter?.tags as string | string[] | undefined;
      if (frontmatterTags && typeof frontmatterTags !== "object" || Array.isArray(frontmatterTags)) {
        const tags: string[] = Array.isArray(frontmatterTags)
          ? frontmatterTags
          : frontmatterTags ? [frontmatterTags] : [];
        const taggedFiles = this.getFilesWithTags(tags);
        for (const file of taggedFiles) {
          if (!seen.has(file.path) && this.isPathAllowed(file.path)) {
            suggestions.push({
              file,
              reason: "same-tag",
              score: 40,
            });
            seen.add(file.path);
          }
        }
      }
    }

    // 5. Recently modified files (fallback)
    const recentFiles = this.getRecentFiles(20);
    for (const file of recentFiles) {
      if (!seen.has(file.path) && this.isPathAllowed(file.path)) {
        suggestions.push({
          file,
          reason: "recent",
          score: 30,
        });
        seen.add(file.path);
      }
    }

    // Sort by score and return top N
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);
  }

  /**
   * Get files that link to the given file (backlinks)
   */
  private getBacklinks(file: TFile): TFile[] {
    const backlinks: TFile[] = [];
    const resolvedLinks = this.app.metadataCache.resolvedLinks;

    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      if (links[file.path]) {
        const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
        if (sourceFile instanceof TFile) {
          backlinks.push(sourceFile);
        }
      }
    }

    return backlinks;
  }

  /**
   * Get files in the same folder
   */
  private getFilesInSameFolder(file: TFile): TFile[] {
    const folder = file.parent;
    if (!folder) return [];

    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.parent?.path === folder.path && f.path !== file.path);
  }

  /**
   * Get files with any of the given tags
   */
  private getFilesWithTags(tags: string[]): TFile[] {
    const tagSet = new Set(tags.map((t) => t.toLowerCase().replace(/^#/, "")));
    const files: TFile[] = [];

    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fileTags = cache?.frontmatter?.tags as string | string[] | undefined;
      if (fileTags) {
        const fileTagList: string[] = Array.isArray(fileTags) 
          ? fileTags
          : [fileTags];
        for (const tag of fileTagList) {
          if (typeof tag === "string" && tagSet.has(tag.toLowerCase().replace(/^#/, ""))) {
            files.push(file);
            break;
          }
        }
      }
    }

    return files;
  }

  /**
   * Get recently modified files
   */
  private getRecentFiles(count: number): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, count);
  }

  /**
   * Check if a path is allowed based on consent settings
   */
  private isPathAllowed(path: string): boolean {
    if (!this.settings.consentEnabled) return false;

    const { consentMode, includedFolders, excludedFolders } = this.settings;

    if (consentMode === "opt-in") {
      if (includedFolders.length === 0) return false;
      return includedFolders.some(
        (folder) => path.startsWith(folder + "/") || path === folder || folder === "/"
      );
    } else {
      return !excludedFolders.some(
        (folder) => path.startsWith(folder + "/") || path === folder
      );
    }
  }
}
