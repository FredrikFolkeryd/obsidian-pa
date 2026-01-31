/**
 * Safe Vault Access Wrapper
 *
 * Provides read-only vault access by default with explicit safety guards
 * to prevent accidental content destruction.
 *
 * CRITICAL: This wrapper enforces the "MUST NOT destroy content" requirement.
 */

import { App, TFile, TFolder, Vault } from "obsidian";
import type { PASettings } from "../settings";

/**
 * Result of a vault read operation
 */
export interface VaultReadResult {
  path: string;
  content: string;
  mtime: number;
}

/**
 * Safe vault wrapper with read-only default
 */
export class SafeVaultAccess {
  private app: App;
  private settings: PASettings;

  public constructor(app: App, settings: PASettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Get the vault instance (for Obsidian API compatibility)
   */
  public get vault(): Vault {
    return this.app.vault;
  }

  /**
   * Check if a path is allowed based on consent settings
   */
  public isPathAllowed(path: string): boolean {
    if (!this.settings.consentEnabled) {
      return false;
    }

    const { consentMode, includedFolders, excludedFolders } = this.settings;

    if (consentMode === "opt-in") {
      // Only allow if in included folders (or is a root file with empty includes)
      if (includedFolders.length === 0) {
        return false; // No folders included = nothing allowed
      }
      return includedFolders.some(
        (folder) => path.startsWith(folder + "/") || path === folder || folder === "/"
      );
    } else {
      // Allow unless in excluded folders
      return !excludedFolders.some(
        (folder) => path.startsWith(folder + "/") || path === folder
      );
    }
  }

  /**
   * Read a file's content safely
   * Only reads if file is in allowed folders
   */
  public async readFile(path: string): Promise<VaultReadResult | null> {
    if (!this.isPathAllowed(path)) {
      console.warn(`[SafeVault] Access denied to file: ${path}`);
      return null;
    }

    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return null;
    }

    try {
      const content = await this.app.vault.read(file);
      return {
        path: file.path,
        content,
        mtime: file.stat.mtime,
      };
    } catch (error) {
      console.error(`[SafeVault] Error reading file: ${path}`, error);
      return null;
    }
  }

  /**
   * Read multiple files safely
   */
  public async readFiles(paths: string[]): Promise<VaultReadResult[]> {
    const results: VaultReadResult[] = [];

    for (const path of paths) {
      const result = await this.readFile(path);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get all markdown files in allowed folders
   */
  public getAllowedMarkdownFiles(): TFile[] {
    const allFiles = this.app.vault.getMarkdownFiles();
    return allFiles.filter((file) => this.isPathAllowed(file.path));
  }

  /**
   * Get all files in a specific allowed folder
   */
  public getFilesInFolder(folderPath: string): TFile[] {
    if (!this.isPathAllowed(folderPath)) {
      return [];
    }

    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) {
      return [];
    }

    const files: TFile[] = [];
    Vault.recurseChildren(folder, (file) => {
      if (file instanceof TFile && this.isPathAllowed(file.path)) {
        files.push(file);
      }
    });

    return files;
  }

  /**
   * Search files by name pattern (read-only)
   */
  public searchFilesByName(pattern: string): TFile[] {
    const regex = new RegExp(pattern, "i");
    return this.getAllowedMarkdownFiles().filter((file) => regex.test(file.basename));
  }

  /**
   * Get file metadata without content (safe operation)
   */
  public getFileMetadata(path: string): { name: string; path: string; mtime: number } | null {
    // Metadata access is always allowed (doesn't expose content)
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return null;
    }

    return {
      name: file.basename,
      path: file.path,
      mtime: file.stat.mtime,
    };
  }

  /**
   * List all folders (structure only, no content)
   */
  public listFolders(): string[] {
    const folders: string[] = [];
    const rootFolder = this.app.vault.getRoot();

    Vault.recurseChildren(rootFolder, (item) => {
      if (item instanceof TFolder) {
        folders.push(item.path);
      }
    });

    return folders;
  }

  // =========================================================================
  // WRITE OPERATIONS - Intentionally NOT implemented for Phase 1.0.0
  // =========================================================================

  /**
   * Write operations are NOT available in Phase 1.0.0
   *
   * When implemented in future phases, they will require:
   * 1. User confirmation modal
   * 2. Automatic backup creation
   * 3. Transaction logging for rollback
   * 4. Dry-run preview mode
   *
   * @throws Always throws - write operations not yet implemented
   */
  public writeFile(_path: string, _content: string): never {
    throw new Error(
      "Write operations are not available in Phase 1.0.0. " +
        "AI suggestions are read-only and require manual action."
    );
  }

  /**
   * Modify operations are NOT available in Phase 1.0.0
   * @throws Always throws - modify operations not yet implemented
   */
  public modifyFile(_path: string, _transformer: (content: string) => string): never {
    throw new Error(
      "Modify operations are not available in Phase 1.0.0. " +
        "AI suggestions are read-only and require manual action."
    );
  }

  /**
   * Delete operations are NEVER available through this wrapper
   * @throws Always throws - delete operations forbidden
   */
  public deleteFile(_path: string): never {
    throw new Error(
      "Delete operations are forbidden through the AI interface. " +
        "Use Obsidian's native file operations for deletions."
    );
  }
}
