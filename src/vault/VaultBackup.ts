/**
 * Vault Backup System
 *
 * Manages automatic backups for AI-initiated file modifications.
 * Backups are stored in a hidden folder within the vault.
 *
 * SECURITY: Backups ensure no data loss from AI operations.
 */

import { App, TFile, TFolder, normalizePath } from "obsidian";

/**
 * Backup metadata stored with each backup
 */
export interface BackupMetadata {
  originalPath: string;
  backupPath: string;
  timestamp: number;
  reason: string;
}

/**
 * Configuration for the backup system
 */
export interface BackupConfig {
  /** Folder where backups are stored (relative to vault root) */
  backupFolder: string;
  /** Maximum age of backups in days before auto-cleanup */
  maxAgeDays: number;
  /** Maximum number of backups per file */
  maxBackupsPerFile: number;
}

const DEFAULT_CONFIG: BackupConfig = {
  backupFolder: ".pa-backups",
  maxAgeDays: 7,
  maxBackupsPerFile: 10,
};

/**
 * Manages file backups for safe write operations
 */
export class VaultBackup {
  private app: App;
  private config: BackupConfig;

  public constructor(app: App, config: Partial<BackupConfig> = {}) {
    this.app = app;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a backup of a file before modification
   *
   * @param file - The file to backup
   * @param reason - Why the backup was created (for audit log)
   * @returns The backup metadata, or null if backup failed
   */
  public async createBackup(file: TFile, reason: string): Promise<BackupMetadata | null> {
    try {
      // Ensure backup folder exists
      await this.ensureBackupFolder();

      // Read current content
      const content = await this.app.vault.read(file);

      // Generate backup path: .pa-backups/original/path/filename-timestamp.md
      const timestamp = Date.now();
      const backupPath = this.generateBackupPath(file.path, timestamp);

      // Create parent folders if needed
      const parentPath = backupPath.substring(0, backupPath.lastIndexOf("/"));
      await this.ensureFolder(parentPath);

      // Write backup file
      await this.app.vault.create(backupPath, content);

      const metadata: BackupMetadata = {
        originalPath: file.path,
        backupPath,
        timestamp,
        reason,
      };

      // Cleanup old backups for this file
      this.cleanupOldBackups(file.path);

      return metadata;
    } catch (error) {
      console.error("[VaultBackup] Failed to create backup:", error);
      return null;
    }
  }

  /**
   * Restore a file from its most recent backup
   *
   * @param originalPath - The path of the original file
   * @returns True if restore succeeded, false otherwise
   */
  public async restoreFromBackup(originalPath: string): Promise<boolean> {
    try {
      const backups = this.getBackupsForFile(originalPath);
      if (backups.length === 0) {
        console.warn("[VaultBackup] No backups found for:", originalPath);
        return false;
      }

      // Get most recent backup
      const latestBackup = backups[0];
      const backupFile = this.app.vault.getAbstractFileByPath(latestBackup.backupPath);

      if (!(backupFile instanceof TFile)) {
        console.error("[VaultBackup] Backup file not found:", latestBackup.backupPath);
        return false;
      }

      // Read backup content
      const content = await this.app.vault.read(backupFile);

      // Get or create the original file
      const originalFile = this.app.vault.getAbstractFileByPath(originalPath);

      if (originalFile instanceof TFile) {
        // Modify existing file
        await this.app.vault.modify(originalFile, content);
      } else {
        // Recreate file
        await this.app.vault.create(originalPath, content);
      }

      return true;
    } catch (error) {
      console.error("[VaultBackup] Failed to restore from backup:", error);
      return false;
    }
  }

  /**
   * Get all backups for a specific file, sorted by timestamp (newest first)
   */
  public getBackupsForFile(originalPath: string): BackupMetadata[] {
    const backupFolderPath = normalizePath(
      `${this.config.backupFolder}/${originalPath.substring(0, originalPath.lastIndexOf("/"))}`
    );

    const folder = this.app.vault.getAbstractFileByPath(backupFolderPath);
    if (!(folder instanceof TFolder)) {
      return [];
    }

    const backups: BackupMetadata[] = [];
    const originalBasename = originalPath.split("/").pop()?.replace(".md", "") ?? "";

    for (const child of folder.children) {
      if (child instanceof TFile && child.basename.startsWith(originalBasename + "-")) {
        // Parse timestamp from filename
        const match = child.basename.match(/-(\d+)$/);
        if (match) {
          backups.push({
            originalPath,
            backupPath: child.path,
            timestamp: parseInt(match[1], 10),
            reason: "backup",
          });
        }
      }
    }

    // Sort by timestamp descending (newest first)
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clean up old backups based on age and count limits
   * Note: Cleanup is fire-and-forget, errors are logged but not thrown
   */
  public cleanupOldBackups(originalPath: string): void {
    const backups = this.getBackupsForFile(originalPath);
    const now = Date.now();
    const maxAge = this.config.maxAgeDays * 24 * 60 * 60 * 1000;

    for (let i = 0; i < backups.length; i++) {
      const backup = backups[i];
      const age = now - backup.timestamp;

      // Delete if too old or exceeds max count
      if (age > maxAge || i >= this.config.maxBackupsPerFile) {
        const backupFile = this.app.vault.getAbstractFileByPath(backup.backupPath);
        if (backupFile instanceof TFile) {
          // Fire and forget - don't await
          this.app.vault.delete(backupFile).catch((err) => {
            console.warn("[VaultBackup] Failed to delete old backup:", err);
          });
        }
      }
    }
  }

  /**
   * Run cleanup on all backups in the vault
   * Cleanup is fire-and-forget for each file
   */
  public runGlobalCleanup(): number {
    const folder = this.app.vault.getAbstractFileByPath(this.config.backupFolder);
    if (!(folder instanceof TFolder)) {
      return 0;
    }

    const processedPaths = new Set<string>();

    // Collect all backup files
    const backupFiles: TFile[] = [];
    this.collectFiles(folder, backupFiles);

    // Extract unique original paths and cleanup each
    for (const file of backupFiles) {
      const originalPath = this.extractOriginalPath(file.path);
      if (originalPath && !processedPaths.has(originalPath)) {
        processedPaths.add(originalPath);
        this.cleanupOldBackups(originalPath);
      }
    }

    // Return count of unique paths processed (actual deletions are async)
    return processedPaths.size;
  }

  /**
   * Generate a backup path for a file
   */
  private generateBackupPath(originalPath: string, timestamp: number): string {
    const pathWithoutExtension = originalPath.replace(/\.md$/, "");
    return normalizePath(
      `${this.config.backupFolder}/${pathWithoutExtension}-${timestamp}.md`
    );
  }

  /**
   * Extract the original path from a backup path
   */
  private extractOriginalPath(backupPath: string): string | null {
    // Remove backup folder prefix
    const relativePath = backupPath.replace(this.config.backupFolder + "/", "");
    // Remove timestamp suffix
    const match = relativePath.match(/^(.+)-\d+\.md$/);
    return match ? match[1] + ".md" : null;
  }

  /**
   * Ensure the backup folder exists
   */
  private async ensureBackupFolder(): Promise<void> {
    await this.ensureFolder(this.config.backupFolder);
  }

  /**
   * Ensure a folder exists, creating it if necessary
   */
  private async ensureFolder(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (!existing) {
      await this.app.vault.createFolder(normalizedPath);
    }
  }

  /**
   * Recursively collect all files in a folder
   */
  private collectFiles(folder: TFolder, files: TFile[]): void {
    for (const child of folder.children) {
      if (child instanceof TFile) {
        files.push(child);
      } else if (child instanceof TFolder) {
        this.collectFiles(child, files);
      }
    }
  }
}
