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
  ) as typeof vault.getAbstractFileByPath;
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
    it("should throw error on writeFile", () => {
      expect(() => safeVault.writeFile("any/path.md", "content")).toThrow(
        "Write operations are not available in Phase 1.0.0"
      );
    });

    it("should throw error on modifyFile", () => {
      expect(() => safeVault.modifyFile("any/path.md", (c) => c)).toThrow(
        "Modify operations are not available in Phase 1.0.0"
      );
    });

    it("should throw error on deleteFile", () => {
      expect(() => safeVault.deleteFile("any/path.md")).toThrow(
        "Delete operations are forbidden"
      );
    });
  });
});
