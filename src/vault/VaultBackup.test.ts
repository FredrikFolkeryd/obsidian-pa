/**
 * Tests for VaultBackup
 *
 * These tests verify that:
 * 1. Backup creation works correctly
 * 2. Backup restoration works correctly
 * 3. Backup cleanup respects age and count limits
 * 4. Backup paths are generated correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VaultBackup } from "./VaultBackup";
import type { App, TAbstractFile, TFile, TFolder, Vault } from "obsidian";

// Mock Obsidian types
import { TFile as MockTFile, TFolder as MockTFolder, Vault as MockVault } from "../__mocks__/obsidian";

const createMockFile = (path: string, mtime?: number): TFile => {
  const file = new MockTFile();
  file.path = path;
  file.basename = path.split("/").pop()?.replace(".md", "") ?? "";
  file.stat = { mtime: mtime ?? Date.now(), ctime: Date.now(), size: 100 };
  file.parent = null;
  return file as unknown as TFile;
};

// Helper type to enable setting children on mock folders
interface MockFolderWithChildren extends TFolder {
  children: TAbstractFile[];
}

const createMockFolder = (path: string): MockFolderWithChildren => {
  const folder = new MockTFolder();
  folder.path = path;
  folder.children = [];
  return folder as unknown as MockFolderWithChildren;
};

// Use 'unknown[]' internally to avoid mock vs real type conflicts
const createMockApp = (files: unknown[] = [], folders: unknown[] = []): Partial<App> => {
  const vault = new MockVault();
  const typedFiles = files as MockTFile[];
  const typedFolders = folders as MockTFolder[];

  vault.read = vi.fn().mockResolvedValue("file content");
  vault.create = vi.fn().mockResolvedValue(createMockFile("backup.md"));
  vault.modify = vi.fn().mockResolvedValue(undefined);
  vault.delete = vi.fn().mockResolvedValue(undefined);
  vault.createFolder = vi.fn().mockResolvedValue(undefined);

  vault.getAbstractFileByPath = vi.fn().mockImplementation((path: string) => {
    const file = typedFiles.find((f) => f.path === path);
    if (file) return file;
    const folder = typedFolders.find((f) => f.path === path);
    return folder ?? null;
  });

  vault.getMarkdownFiles = vi.fn(() => typedFiles) as typeof vault.getMarkdownFiles;

  return {
    vault: vault as unknown as Vault,
  };
};

describe("VaultBackup", () => {
  let mockApp: Partial<App>;
  let backup: VaultBackup;

  beforeEach(() => {
    mockApp = createMockApp();
    backup = new VaultBackup(mockApp as App);
  });

  describe("createBackup", () => {
    it("should create a backup of an existing file", async () => {
      const sourceFile = createMockFile("notes/daily.md");
      mockApp = createMockApp([sourceFile]);
      backup = new VaultBackup(mockApp as App);

      // Simulate file read
      (mockApp.vault!.read as ReturnType<typeof vi.fn>).mockResolvedValue("Original content");

      const result = await backup.createBackup(sourceFile, "test backup");

      expect(result).not.toBeNull();
      expect(result!.originalPath).toBe("notes/daily.md");
      expect(result!.timestamp).toBeDefined();
      expect(result!.backupPath).toContain(".pa-backups/notes/daily-");
    });

    it("should create backup folder if it doesn't exist", async () => {
      const sourceFile = createMockFile("notes/daily.md");
      mockApp = createMockApp([sourceFile]);
      backup = new VaultBackup(mockApp as App);

      (mockApp.vault!.read as ReturnType<typeof vi.fn>).mockResolvedValue("content");

      await backup.createBackup(sourceFile, "folder creation test");

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockApp.vault!.createFolder).toHaveBeenCalled();
    });

    it("should return null if file read fails", async () => {
      const sourceFile = createMockFile("notes/daily.md");
      mockApp = createMockApp([sourceFile]);
      backup = new VaultBackup(mockApp as App);

      (mockApp.vault!.read as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Read failed")
      );

      const result = await backup.createBackup(sourceFile, "fail test");

      expect(result).toBeNull();
    });
  });

  describe("getBackupsForFile", () => {
    it("should return empty array when no backups exist", () => {
      mockApp = createMockApp();
      backup = new VaultBackup(mockApp as App);

      const backups = backup.getBackupsForFile("notes/daily.md");

      expect(backups).toEqual([]);
    });

    it("should return backups sorted by timestamp (newest first)", () => {
      const now = Date.now();
      const oldBackup = createMockFile(
        `.pa-backups/notes/daily-${now - 10000}.md`,
        now - 10000
      );
      const newBackup = createMockFile(
        `.pa-backups/notes/daily-${now}.md`,
        now
      );

      const backupFolder = createMockFolder(".pa-backups");
      const notesFolder = createMockFolder(".pa-backups/notes");
      notesFolder.children = [oldBackup, newBackup];
      backupFolder.children = [notesFolder];

      mockApp = createMockApp([oldBackup, newBackup], [backupFolder, notesFolder]);
      backup = new VaultBackup(mockApp as App);

      const backups = backup.getBackupsForFile("notes/daily.md");

      expect(backups.length).toBe(2);
      expect(backups[0].timestamp).toBeGreaterThan(backups[1].timestamp);
    });
  });

  describe("restoreFromBackup", () => {
    it("should restore file content from backup", async () => {
      const now = Date.now();
      const backupFile = createMockFile(
        `.pa-backups/notes/daily-${now}.md`,
        now
      );
      const originalFile = createMockFile("notes/daily.md");

      // Set up proper folder structure
      const backupFolder = createMockFolder(".pa-backups");
      const notesFolder = createMockFolder(".pa-backups/notes");
      notesFolder.children = [backupFile];
      backupFolder.children = [notesFolder];

      mockApp = createMockApp([backupFile, originalFile], [backupFolder, notesFolder]);
      backup = new VaultBackup(mockApp as App);

      (mockApp.vault!.read as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Backup content"
      );

      const result = await backup.restoreFromBackup("notes/daily.md");

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe(backupFile.path);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockApp.vault!.modify).toHaveBeenCalledWith(
        originalFile,
        "Backup content"
      );
    });

    it("should return false when no backups exist", async () => {
      mockApp = createMockApp();
      backup = new VaultBackup(mockApp as App);

      const result = await backup.restoreFromBackup("notes/daily.md");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No backups found");
    });

    it("should create original file if it doesn't exist", async () => {
      const now = Date.now();
      const backupFile = createMockFile(
        `.pa-backups/notes/daily-${now}.md`,
        now
      );
      const backupFolder = createMockFolder(".pa-backups");
      const notesFolder = createMockFolder(".pa-backups/notes");
      notesFolder.children = [backupFile];
      backupFolder.children = [notesFolder];

      mockApp = createMockApp([backupFile], [backupFolder, notesFolder]);
      backup = new VaultBackup(mockApp as App);

      (mockApp.vault!.read as ReturnType<typeof vi.fn>).mockResolvedValue(
        "Backup content"
      );

      const result = await backup.restoreFromBackup("notes/daily.md");

      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockApp.vault!.create).toHaveBeenCalledWith(
        "notes/daily.md",
        "Backup content"
      );
    });
  });

  describe("cleanupOldBackups", () => {
    it("should trigger cleanup for expired backups", () => {
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const oldTimestamp = now - maxAge - 1000; // 1 second older than max

      const oldBackup = createMockFile(
        `.pa-backups/notes/daily-${oldTimestamp}.md`,
        oldTimestamp
      );
      const newBackup = createMockFile(
        `.pa-backups/notes/daily-${now}.md`,
        now
      );

      const backupFolder = createMockFolder(".pa-backups");
      const notesFolder = createMockFolder(".pa-backups/notes");
      notesFolder.children = [oldBackup, newBackup];
      backupFolder.children = [notesFolder];

      mockApp = createMockApp([oldBackup, newBackup], [backupFolder, notesFolder]);
      backup = new VaultBackup(mockApp as App);

      // Should not throw
      expect(() => backup.cleanupOldBackups("notes/daily.md")).not.toThrow();
    });
  });

  describe("runGlobalCleanup", () => {
    it("should return 0 when backup folder doesn't exist", () => {
      mockApp = createMockApp();
      backup = new VaultBackup(mockApp as App);

      const result = backup.runGlobalCleanup();

      expect(result).toBe(0);
    });

    it("should process unique paths only", () => {
      const now = Date.now();
      const backup1 = createMockFile(
        `.pa-backups/notes/daily-${now}.md`,
        now
      );
      const backup2 = createMockFile(
        `.pa-backups/notes/daily-${now - 1000}.md`,
        now - 1000
      );
      const backup3 = createMockFile(
        `.pa-backups/projects/readme-${now}.md`,
        now
      );

      const backupFolder = createMockFolder(".pa-backups");
      const notesFolder = createMockFolder(".pa-backups/notes");
      const projectsFolder = createMockFolder(".pa-backups/projects");
      notesFolder.children = [backup1, backup2];
      projectsFolder.children = [backup3];
      backupFolder.children = [notesFolder, projectsFolder];

      mockApp = createMockApp(
        [backup1, backup2, backup3],
        [backupFolder, notesFolder, projectsFolder]
      );
      backup = new VaultBackup(mockApp as App);

      // Should process 2 unique paths
      const result = backup.runGlobalCleanup();

      expect(result).toBe(2);
    });
  });

  describe("generateBackupPath", () => {
    it("should generate correct backup path format", async () => {
      const sourceFile = createMockFile("notes/daily.md");
      mockApp = createMockApp([sourceFile]);
      backup = new VaultBackup(mockApp as App);

      (mockApp.vault!.read as ReturnType<typeof vi.fn>).mockResolvedValue("content");

      const result = await backup.createBackup(sourceFile, "path format test");

      expect(result!.backupPath).toMatch(
        /^\.pa-backups\/notes\/daily-\d+\.md$/
      );
    });

    it("should handle nested paths correctly", async () => {
      const sourceFile = createMockFile("notes/2024/daily.md");
      mockApp = createMockApp([sourceFile]);
      backup = new VaultBackup(mockApp as App);

      (mockApp.vault!.read as ReturnType<typeof vi.fn>).mockResolvedValue("content");

      const result = await backup.createBackup(sourceFile, "nested path test");

      expect(result!.backupPath).toMatch(
        /^\.pa-backups\/notes\/2024\/daily-\d+\.md$/
      );
    });

    it("should create intermediate directories for deeply nested paths", async () => {
      const sourceFile = createMockFile("notes/2024/jan/daily.md");
      mockApp = createMockApp([sourceFile]);
      backup = new VaultBackup(mockApp as App);

      (mockApp.vault!.read as ReturnType<typeof vi.fn>).mockResolvedValue("content");

      const result = await backup.createBackup(sourceFile, "deeply nested path test");

      expect(result).not.toBeNull();
      expect(result!.backupPath).toMatch(
        /^\.pa-backups\/notes\/2024\/jan\/daily-\d+\.md$/
      );

      // Each path segment should have been checked/created incrementally
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const createFolderMock = mockApp.vault!.createFolder as ReturnType<typeof vi.fn>;
      const createdPaths = createFolderMock.mock.calls.map((c: unknown[]) => c[0]);

      // All intermediate segments must have been attempted
      expect(createdPaths).toContain(".pa-backups");
      expect(createdPaths).toContain(".pa-backups/notes");
      expect(createdPaths).toContain(".pa-backups/notes/2024");
      expect(createdPaths).toContain(".pa-backups/notes/2024/jan");
    });
  });
});
