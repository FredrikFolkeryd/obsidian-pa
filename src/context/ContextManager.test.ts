/**
 * Tests for ContextManager
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextManager } from "./ContextManager";
import type { App, TFile, TFolder, CachedMetadata } from "obsidian";
import type { PASettings } from "../settings";

// Mock TFile
function createMockFile(path: string, content = "test content"): TFile {
  const parts = path.split("/");
  const basename = parts[parts.length - 1].replace(".md", "");
  return {
    path,
    basename,
    extension: "md",
    name: parts[parts.length - 1],
    stat: { mtime: Date.now(), ctime: Date.now(), size: content.length },
    vault: {} as never,
    parent: { path: parts.slice(0, -1).join("/") || "/" } as TFolder,
  } as TFile;
}

// Mock App
function createMockApp(files: TFile[], caches: Map<string, CachedMetadata> = new Map()): App {
  const mockVault = {
    getMarkdownFiles: vi.fn(() => files),
    cachedRead: vi.fn((_file: TFile) => Promise.resolve(`Content of ${_file.path}`)),
    getAbstractFileByPath: vi.fn((path: string) => files.find(f => f.path === path)),
  };

  const mockMetadataCache = {
    getFileCache: vi.fn((file: TFile) => caches.get(file.path) || null),
    getFirstLinkpathDest: vi.fn((linkpath: string, _sourcePath: string) => {
      const targetPath = linkpath.endsWith(".md") ? linkpath : `${linkpath}.md`;
      return files.find(f => f.path === targetPath || f.basename === linkpath);
    }),
    resolvedLinks: {} as Record<string, Record<string, number>>,
  };

  return {
    vault: mockVault,
    metadataCache: mockMetadataCache,
  } as unknown as App;
}

// Mock settings
function createMockSettings(overrides: Partial<PASettings> = {}): PASettings {
  return {
    provider: "github-models",
    model: "gpt-4o",
    authMethod: "1password",
    credentialReference: "",
    githubToken: "",
    consentEnabled: true,
    consentMode: "opt-out",
    includedFolders: [],
    excludedFolders: [],
    chatOnlyMode: false,
    usageDate: "",
    usageRequests: 0,
    conversationHistory: [],
    maxHistoryMessages: 100,
    ...overrides,
  };
}

describe("ContextManager", () => {
  let app: App;
  let settings: PASettings;
  let manager: ContextManager;

  beforeEach(() => {
    const files = [
      createMockFile("notes/daily.md"),
      createMockFile("notes/weekly.md"),
      createMockFile("projects/project-a.md"),
      createMockFile("archive/old.md"),
    ];
    app = createMockApp(files);
    settings = createMockSettings();
    manager = new ContextManager(app, settings);
  });

  describe("getSelectedItems", () => {
    it("should return empty array initially", () => {
      expect(manager.getSelectedItems()).toEqual([]);
    });

    it("should return added items", async () => {
      const file = createMockFile("notes/test.md");
      await manager.addFile(file);
      
      const items = manager.getSelectedItems();
      expect(items).toHaveLength(1);
      expect(items[0].path).toBe("notes/test.md");
    });
  });

  describe("addFile", () => {
    it("should add a file to selection", async () => {
      const file = createMockFile("notes/test.md");
      await manager.addFile(file);
      
      expect(manager.getSelectedItems()).toHaveLength(1);
    });

    it("should calculate token count", async () => {
      const file = createMockFile("notes/test.md");
      await manager.addFile(file);
      
      const items = manager.getSelectedItems();
      expect(items[0].tokens).toBeGreaterThan(0);
    });

    it("should not add duplicates", async () => {
      const file = createMockFile("notes/test.md");
      await manager.addFile(file);
      await manager.addFile(file);
      
      expect(manager.getSelectedItems()).toHaveLength(1);
    });
  });

  describe("removeFile", () => {
    it("should remove a file from selection", async () => {
      const file = createMockFile("notes/test.md");
      await manager.addFile(file);
      manager.removeFile(file.path);
      
      expect(manager.getSelectedItems()).toHaveLength(0);
    });

    it("should handle removing non-existent file", () => {
      expect(() => manager.removeFile("nonexistent.md")).not.toThrow();
    });
  });

  describe("clearContext", () => {
    it("should clear all selected items", async () => {
      const file1 = createMockFile("notes/test1.md");
      const file2 = createMockFile("notes/test2.md");
      await manager.addFile(file1);
      await manager.addFile(file2);
      
      manager.clearContext();
      
      expect(manager.getSelectedItems()).toHaveLength(0);
    });
  });

  describe("getTotalTokens", () => {
    it("should return 0 when no items selected", () => {
      expect(manager.getTotalTokens()).toBe(0);
    });

    it("should return sum of token counts", async () => {
      const file1 = createMockFile("notes/test1.md");
      const file2 = createMockFile("notes/test2.md");
      await manager.addFile(file1);
      await manager.addFile(file2);
      
      expect(manager.getTotalTokens()).toBeGreaterThan(0);
    });
  });

  describe("setSelectedItems", () => {
    it("should replace all selections", async () => {
      const file1 = createMockFile("notes/old.md");
      await manager.addFile(file1);
      
      await manager.setSelectedItems([
        { type: "file", path: "new.md", name: "new", tokens: 100 },
      ]);
      
      const items = manager.getSelectedItems();
      expect(items).toHaveLength(1);
      expect(items[0].path).toBe("new.md");
    });
  });

  describe("setSelectedItemsDirect", () => {
    it("should synchronously set selected items", () => {
      const items = [
        { type: "file" as const, path: "notes/a.md", name: "a", tokens: 50 },
        { type: "file" as const, path: "notes/b.md", name: "b", tokens: 75 },
      ];
      manager.setSelectedItemsDirect(items);
      
      const selected = manager.getSelectedItems();
      expect(selected).toHaveLength(2);
      expect(selected.map(i => i.path)).toEqual(["notes/a.md", "notes/b.md"]);
    });

    it("should replace any existing selections atomically", async () => {
      const file1 = createMockFile("notes/old.md");
      await manager.addFile(file1);
      expect(manager.getSelectedItems()).toHaveLength(1);

      const newItems = [
        { type: "file" as const, path: "notes/new1.md", name: "new1", tokens: 100 },
        { type: "file" as const, path: "notes/new2.md", name: "new2", tokens: 200 },
      ];
      manager.setSelectedItemsDirect(newItems);
      
      const selected = manager.getSelectedItems();
      expect(selected).toHaveLength(2);
      expect(selected.find(i => i.path === "notes/old.md")).toBeUndefined();
    });

    it("should preserve token counts from picker", () => {
      const items = [
        { type: "file" as const, path: "notes/a.md", name: "a", tokens: 42 },
      ];
      manager.setSelectedItemsDirect(items);
      
      expect(manager.getTotalTokens()).toBe(42);
    });

    it("should work with empty array to clear context", () => {
      const items = [
        { type: "file" as const, path: "notes/a.md", name: "a", tokens: 50 },
      ];
      manager.setSelectedItemsDirect(items);
      expect(manager.getSelectedItems()).toHaveLength(1);
      
      manager.setSelectedItemsDirect([]);
      expect(manager.getSelectedItems()).toHaveLength(0);
      expect(manager.getTotalTokens()).toBe(0);
    });
  });

  describe("getSuggestions", () => {
    it("should return recent files when no active file", () => {
      const suggestions = manager.getSuggestions(null);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].reason).toBe("recent");
    });

    it("should prioritize linked files", () => {
      const activeFile = createMockFile("notes/active.md");
      const linkedFile = createMockFile("notes/linked.md");
      
      // Set up cache with links
      const caches = new Map<string, CachedMetadata>();
      caches.set("notes/active.md", {
        links: [{ link: "linked", original: "linked", position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 6, offset: 6 } } }],
      } as CachedMetadata);
      
      const files = [activeFile, linkedFile];
      app = createMockApp(files, caches);
      manager = new ContextManager(app, settings);
      
      const suggestions = manager.getSuggestions(activeFile);
      const linkedSuggestion = suggestions.find(s => s.reason === "linked-from-active");
      
      if (linkedSuggestion) {
        expect(linkedSuggestion.score).toBeGreaterThan(50);
      }
    });

    it("should exclude already-selected files", async () => {
      const file = createMockFile("notes/daily.md");
      await manager.addFile(file);
      
      const suggestions = manager.getSuggestions(null);
      const hasDailyNote = suggestions.some(s => s.file.path === "notes/daily.md");
      expect(hasDailyNote).toBe(false);
    });

    it("should respect consent settings", () => {
      settings = createMockSettings({
        consentMode: "opt-in",
        includedFolders: ["notes"],
      });
      manager = new ContextManager(app, settings);
      
      const suggestions = manager.getSuggestions(null);
      const hasArchive = suggestions.some(s => s.file.path.startsWith("archive/"));
      expect(hasArchive).toBe(false);
    });

    it("should limit number of suggestions", () => {
      const suggestions = manager.getSuggestions(null, 3);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe("consent filtering", () => {
    it("should block all files when consent disabled", () => {
      settings = createMockSettings({ consentEnabled: false });
      manager = new ContextManager(app, settings);
      
      const suggestions = manager.getSuggestions(null);
      expect(suggestions).toHaveLength(0);
    });

    it("should filter by included folders in opt-in mode", () => {
      settings = createMockSettings({
        consentMode: "opt-in",
        includedFolders: ["projects"],
      });
      manager = new ContextManager(app, settings);
      
      const suggestions = manager.getSuggestions(null);
      const allInProjects = suggestions.every(s => s.file.path.startsWith("projects/"));
      expect(allInProjects).toBe(true);
    });

    it("should filter by excluded folders in opt-out mode", () => {
      settings = createMockSettings({
        consentMode: "opt-out",
        excludedFolders: ["archive"],
      });
      manager = new ContextManager(app, settings);
      
      const suggestions = manager.getSuggestions(null);
      const hasArchive = suggestions.some(s => s.file.path.startsWith("archive/"));
      expect(hasArchive).toBe(false);
    });
  });
});
