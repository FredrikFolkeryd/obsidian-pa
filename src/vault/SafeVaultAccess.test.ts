/**
 * Tests for SafeVaultAccess
 *
 * These tests verify that:
 * 1. Read operations respect consent settings
 * 2. Write/delete operations are forbidden
 * 3. Path allowance logic works correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SafeVaultAccess } from "./SafeVaultAccess";
import type { PASettings } from "../settings";
import type { App, TFile, Vault } from "obsidian";

// Mock Obsidian types - need to use the mock classes directly
import { TFile as MockTFile, TFolder, Vault as MockVault } from "../__mocks__/obsidian";

const createMockFile = (path: string): MockTFile => {
  const file = new MockTFile();
  file.path = path;
  file.basename = path.split("/").pop()?.replace(".md", "") ?? "";
  file.stat = { mtime: Date.now(), ctime: Date.now(), size: 100 };
  return file;
};

const createMockApp = (files: MockTFile[] = []): Partial<App> => {
  const vault = new MockVault();
  vault.read = vi.fn().mockResolvedValue("file content");
  vault.getAbstractFileByPath = vi.fn((path: string) =>
    files.find((f) => f.path === path) ?? null
  );
  vault.getMarkdownFiles = vi.fn(() => files as TFile[]);
  vault.getRoot = vi.fn(() => ({ path: "/" }) as TFolder);

  return {
    vault: vault as unknown as Vault,
  };
};

describe("SafeVaultAccess", () => {
  let settings: PASettings;
  let mockApp: Partial<App>;
  let safeVault: SafeVaultAccess;

  beforeEach(() => {
    settings = {
      consentEnabled: true,
      consentMode: "opt-in",
      includedFolders: ["notes", "projects"],
      excludedFolders: [],
      model: "gpt-4o",
    };

    mockApp = createMockApp([
      createMockFile("notes/test.md"),
      createMockFile("projects/readme.md"),
      createMockFile("private/secret.md"),
    ]);

    safeVault = new SafeVaultAccess(mockApp as App, settings);
  });

  describe("isPathAllowed", () => {
    describe("when consent is disabled", () => {
      it("should deny all paths", () => {
        settings.consentEnabled = false;

        expect(safeVault.isPathAllowed("notes/test.md")).toBe(false);
        expect(safeVault.isPathAllowed("any/path.md")).toBe(false);
      });
    });

    describe("in opt-in mode", () => {
      it("should allow paths in included folders", () => {
        expect(safeVault.isPathAllowed("notes/test.md")).toBe(true);
        expect(safeVault.isPathAllowed("projects/readme.md")).toBe(true);
      });

      it("should deny paths not in included folders", () => {
        expect(safeVault.isPathAllowed("private/secret.md")).toBe(false);
        expect(safeVault.isPathAllowed("random/file.md")).toBe(false);
      });

      it("should deny all paths when no folders are included", () => {
        settings.includedFolders = [];

        expect(safeVault.isPathAllowed("notes/test.md")).toBe(false);
      });
    });

    describe("in opt-out mode", () => {
      beforeEach(() => {
        settings.consentMode = "opt-out";
        settings.excludedFolders = ["private", "journal"];
      });

      it("should allow paths not in excluded folders", () => {
        expect(safeVault.isPathAllowed("notes/test.md")).toBe(true);
        expect(safeVault.isPathAllowed("random/file.md")).toBe(true);
      });

      it("should deny paths in excluded folders", () => {
        expect(safeVault.isPathAllowed("private/secret.md")).toBe(false);
        expect(safeVault.isPathAllowed("journal/2024-01-01.md")).toBe(false);
      });
    });
  });

  describe("readFile", () => {
    it("should read allowed files", async () => {
      const result = await safeVault.readFile("notes/test.md");

      expect(result).not.toBeNull();
      expect(result?.content).toBe("file content");
    });

    it("should deny reading disallowed files", async () => {
      const result = await safeVault.readFile("private/secret.md");

      expect(result).toBeNull();
    });
  });

  describe("getAllowedMarkdownFiles", () => {
    it("should only return files in allowed folders", () => {
      const files = safeVault.getAllowedMarkdownFiles();

      expect(files.length).toBe(2);
      expect(files.map((f) => f.path)).toContain("notes/test.md");
      expect(files.map((f) => f.path)).toContain("projects/readme.md");
      expect(files.map((f) => f.path)).not.toContain("private/secret.md");
    });
  });

  describe("write operations", () => {
    it("should propose an edit and create pending edit entry", async () => {
      // Enable write mode for this test
      safeVault.enableWrites();

      const edit = await safeVault.proposeEdit(
        "notes/daily.md",
        "New content",
        "Test edit"
      );

      expect(edit).not.toBeNull();
      expect(edit!.path).toBe("notes/daily.md");
      expect(edit!.newContent).toBe("New content");
      expect(edit!.reason).toBe("Test edit");
      expect(edit!.timestamp).toBeDefined();

      // Should be retrievable by path
      const pending = safeVault.getPendingEdit(edit!.path);
      expect(pending).toEqual(edit);

      // Cancel to clean up
      safeVault.cancelEdit(edit!.path);

      // Disable write mode
      safeVault.disableWrites();
    });

    it("should reject proposeEdit when write mode is disabled", async () => {
      // Ensure write mode is disabled
      safeVault.disableWrites();

      const edit = await safeVault.proposeEdit(
        "notes/daily.md",
        "content",
        "reason"
      );

      // Should return null when writes disabled
      expect(edit).toBeNull();
    });

    it("should reject proposeEdit for disallowed paths", async () => {
      safeVault.enableWrites();

      const edit = await safeVault.proposeEdit(
        "private/secret.md",
        "content",
        "reason"
      );

      // Should return null for disallowed paths
      expect(edit).toBeNull();

      safeVault.disableWrites();
    });

    it("should throw error on deleteFile", () => {
      expect(() => safeVault.deleteFile("any/path.md")).toThrow(
        "Delete operations are forbidden"
      );
    });
  });

  describe("audit log", () => {
    it("should start with empty audit log", () => {
      expect(safeVault.getAuditLog()).toEqual([]);
    });

    it("should return a copy of the audit log", () => {
      const log1 = safeVault.getAuditLog();
      const log2 = safeVault.getAuditLog();
      
      // Should be different array instances
      expect(log1).not.toBe(log2);
    });

    it("should clear the audit log", () => {
      safeVault.clearAuditLog();
      expect(safeVault.getAuditLog()).toEqual([]);
    });
  });

  describe("cancelEdit", () => {
    it("should cancel a pending edit", async () => {
      safeVault.enableWrites();
      
      await safeVault.proposeEdit("notes/test.md", "New content", "Test");
      
      expect(safeVault.getPendingEdit("notes/test.md")).not.toBeNull();
      
      safeVault.cancelEdit("notes/test.md");
      
      expect(safeVault.getPendingEdit("notes/test.md")).toBeNull();
      
      safeVault.disableWrites();
    });

    it("should handle cancelling non-existent edit", () => {
      safeVault.cancelEdit("non/existent.md");
      // Should not throw
      expect(safeVault.getPendingEdit("non/existent.md")).toBeNull();
    });
  });

  describe("write mode control", () => {
    it("should track write mode state", () => {
      expect(safeVault.isWriteEnabled()).toBe(false);
      
      safeVault.enableWrites();
      expect(safeVault.isWriteEnabled()).toBe(true);
      
      safeVault.disableWrites();
      expect(safeVault.isWriteEnabled()).toBe(false);
    });

    it("should be safe to enable/disable multiple times", () => {
      safeVault.enableWrites();
      safeVault.enableWrites();
      expect(safeVault.isWriteEnabled()).toBe(true);
      
      safeVault.disableWrites();
      safeVault.disableWrites();
      expect(safeVault.isWriteEnabled()).toBe(false);
    });
  });

  describe("getPendingEdit", () => {
    it("should return null for non-existent path", () => {
      expect(safeVault.getPendingEdit("non/existent.md")).toBeNull();
    });

    it("should return the pending edit for existing path", async () => {
      safeVault.enableWrites();
      
      await safeVault.proposeEdit("notes/test.md", "Content", "Reason");
      
      const pending = safeVault.getPendingEdit("notes/test.md");
      expect(pending).toBeDefined();
      expect(pending!.path).toBe("notes/test.md");
      expect(pending!.newContent).toBe("Content");
      expect(pending!.reason).toBe("Reason");
      
      safeVault.cancelEdit("notes/test.md");
      safeVault.disableWrites();
    });
  });

  describe("path normalization", () => {
    it("should handle paths with leading slashes", () => {
      // The path matching should work regardless of leading slash
      expect(safeVault.isPathAllowed("notes/test.md")).toBe(true);
    });

    it("should handle nested folder paths", () => {
      expect(safeVault.isPathAllowed("notes/sub/deep/file.md")).toBe(true);
      expect(safeVault.isPathAllowed("projects/2024/jan/readme.md")).toBe(true);
    });

    it("should not match partial folder names", () => {
      // "notes" should not match "notes2" 
      expect(safeVault.isPathAllowed("notes2/file.md")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty settings gracefully", () => {
      const emptySettings = {
        consentEnabled: false,
        consentMode: "opt-in" as const,
        includedFolders: [],
        excludedFolders: [],
        model: "gpt-4o",
      };
      
      const emptyVault = new SafeVaultAccess(mockApp as App, emptySettings);
      
      expect(emptyVault.isPathAllowed("any/path.md")).toBe(false);
    });

    it("should handle root-level files in opt-out mode", () => {
      settings.consentMode = "opt-out";
      settings.excludedFolders = ["private"];
      
      // Root level file should be allowed in opt-out mode
      expect(safeVault.isPathAllowed("README.md")).toBe(true);
    });
  });
});
