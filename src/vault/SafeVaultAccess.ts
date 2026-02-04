/**
 * Safe Vault Access Wrapper
 *
 * Provides read-only vault access by default with explicit safety guards
 * to prevent accidental content destruction.
 *
 * Phase 1.1: Write operations with safety guardrails:
 * - Automatic backup before modification
 * - User confirmation required
 * - Audit logging for all changes
 *
 * CRITICAL: This wrapper enforces the "MUST NOT destroy content" requirement.
 */

import { App, TFile, TFolder, Vault } from "obsidian";
import type { PASettings } from "../settings";
import { VaultBackup, type BackupMetadata } from "./VaultBackup";

/**
 * Result of a vault read operation
 */
export interface VaultReadResult {
  path: string;
  content: string;
  mtime: number;
}

/**
 * Proposed edit awaiting user confirmation
 */
export interface ProposedEdit {
  path: string;
  originalContent: string;
  newContent: string;
  timestamp: number;
  reason: string;
}

/**
 * Result of a write operation
 */
export interface WriteResult {
  success: boolean;
  path: string;
  backupPath?: string;
  error?: string;
}

/**
 * Audit log entry for write operations
 */
export interface WriteAuditEntry {
  timestamp: number;
  operation: "create" | "modify" | "revert";
  path: string;
  reason: string;
  backupPath?: string;
  success: boolean;
  error?: string;
}

/**
 * Safe vault wrapper with read-only default and guarded writes
 */
export class SafeVaultAccess {
  private app: App;
  private settings: PASettings;
  private backup: VaultBackup;
  private pendingEdits: Map<string, ProposedEdit> = new Map();
  private auditLog: WriteAuditEntry[] = [];
  private writeEnabled = false;

  public constructor(app: App, settings: PASettings) {
    this.app = app;
    this.settings = settings;
    this.backup = new VaultBackup(app);
  }

  /**
   * Enable write operations (must be explicitly enabled)
   * This is a safety mechanism to prevent accidental writes.
   */
  public enableWrites(): void {
    this.writeEnabled = true;
  }

  /**
   * Disable write operations
   */
  public disableWrites(): void {
    this.writeEnabled = false;
    this.pendingEdits.clear();
  }

  /**
   * Check if writes are enabled
   */
  public isWriteEnabled(): boolean {
    return this.writeEnabled;
  }

  /**
   * Get the backup manager for task handlers
   */
  public getBackup(): VaultBackup {
    return this.backup;
  }

  /**
   * Get the audit log of all write operations
   */
  public getAuditLog(): WriteAuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Clear the audit log
   */
  public clearAuditLog(): void {
    this.auditLog = [];
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
  // WRITE OPERATIONS - Phase 1.1 with safety guardrails
  // =========================================================================

  /**
   * Propose an edit to a file (requires user confirmation before applying)
   *
   * @param path - The file path to edit
   * @param newContent - The proposed new content
   * @param reason - Why the edit is being proposed (for audit log)
   * @returns The proposed edit for preview, or null if not allowed
   */
  public async proposeEdit(
    path: string,
    newContent: string,
    reason: string
  ): Promise<ProposedEdit | null> {
    if (!this.writeEnabled) {
      console.warn("[SafeVault] Write operations are disabled");
      return null;
    }

    if (!this.isPathAllowed(path)) {
      console.warn(`[SafeVault] Write access denied to file: ${path}`);
      return null;
    }

    // Get current content
    const file = this.app.vault.getAbstractFileByPath(path);
    let originalContent = "";

    if (file instanceof TFile) {
      try {
        originalContent = await this.app.vault.read(file);
      } catch (error) {
        console.error(`[SafeVault] Error reading file for edit: ${path}`, error);
        return null;
      }
    }

    const proposed: ProposedEdit = {
      path,
      originalContent,
      newContent,
      timestamp: Date.now(),
      reason,
    };

    this.pendingEdits.set(path, proposed);
    return proposed;
  }

  /**
   * Get a pending edit for a path
   */
  public getPendingEdit(path: string): ProposedEdit | null {
    return this.pendingEdits.get(path) ?? null;
  }

  /**
   * Get all pending edits
   */
  public getAllPendingEdits(): ProposedEdit[] {
    return Array.from(this.pendingEdits.values());
  }

  /**
   * Cancel a pending edit
   */
  public cancelEdit(path: string): boolean {
    return this.pendingEdits.delete(path);
  }

  /**
   * Apply a pending edit after user confirmation
   *
   * @param path - The file path to apply the edit to
   * @returns The result of the write operation
   */
  public async applyEdit(path: string): Promise<WriteResult> {
    const pending = this.pendingEdits.get(path);
    if (!pending) {
      return {
        success: false,
        path,
        error: "No pending edit for this path",
      };
    }

    if (!this.writeEnabled) {
      return {
        success: false,
        path,
        error: "Write operations are disabled",
      };
    }

    const file = this.app.vault.getAbstractFileByPath(path);
    let backupMeta: BackupMetadata | null = null;

    try {
      if (file instanceof TFile) {
        // Create backup before modifying
        backupMeta = await this.backup.createBackup(file, pending.reason);
        if (!backupMeta) {
          // Don't proceed without backup
          const error = "Failed to create backup - aborting edit for safety";
          this.logAudit("modify", path, pending.reason, false, error);
          return { success: false, path, error };
        }

        // Apply the edit
        await this.app.vault.modify(file, pending.newContent);
        this.logAudit("modify", path, pending.reason, true, undefined, backupMeta.backupPath);
      } else {
        // Create new file
        await this.app.vault.create(path, pending.newContent);
        this.logAudit("create", path, pending.reason, true);
      }

      // Remove from pending
      this.pendingEdits.delete(path);

      return {
        success: true,
        path,
        backupPath: backupMeta?.backupPath,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logAudit(
        file instanceof TFile ? "modify" : "create",
        path,
        pending.reason,
        false,
        errorMsg,
        backupMeta?.backupPath
      );
      return {
        success: false,
        path,
        error: errorMsg,
        backupPath: backupMeta?.backupPath,
      };
    }
  }

  /**
   * Revert a file to its most recent backup
   *
   * @param path - The file path to revert
   * @returns The result of the revert operation
   */
  public async revertEdit(path: string): Promise<WriteResult> {
    if (!this.writeEnabled) {
      return {
        success: false,
        path,
        error: "Write operations are disabled",
      };
    }

    const success = await this.backup.restoreFromBackup(path);
    this.logAudit("revert", path, "User requested revert", success);

    return {
      success,
      path,
      error: success ? undefined : "Failed to restore from backup",
    };
  }

  /**
   * Log an audit entry for a write operation
   */
  private logAudit(
    operation: WriteAuditEntry["operation"],
    path: string,
    reason: string,
    success: boolean,
    error?: string,
    backupPath?: string
  ): void {
    this.auditLog.push({
      timestamp: Date.now(),
      operation,
      path,
      reason,
      backupPath,
      success,
      error,
    });

    // Keep audit log bounded (last 100 entries)
    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(-100);
    }
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
