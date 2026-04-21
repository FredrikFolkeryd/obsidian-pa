/**
 * AddTagHandler Tests
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddTagHandler } from "./AddTagHandler";
import type { TaskStep } from "../types";
import type { App, TFile, TAbstractFile } from "obsidian";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

// Mock file content store
const fileContents = new Map<string, string>();

// Mock App
function createMockApp(overrides?: {
  existingFiles?: Record<string, string>;
}): App {
  const existingFiles = overrides?.existingFiles || {
    "notes/test.md": "# Test Note\n\nContent here.",
  };

  fileContents.clear();
  Object.entries(existingFiles).forEach(([path, content]) => {
    fileContents.set(path, content);
  });

  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string): TAbstractFile | null => {
        if (fileContents.has(path)) {
          return { path, extension: "md" } as TFile;
        }
        return null;
      }),
      read: vi.fn((file: TFile): Promise<string> => {
        return Promise.resolve(fileContents.get(file.path) || "");
      }),
      modify: vi.fn((file: TFile, content: string): Promise<void> => {
        fileContents.set(file.path, content);
        return Promise.resolve();
      }),
    },
  } as unknown as App;
}

// Mock SafeVaultAccess
function createMockVault(overrides?: {
  allowedPaths?: string[];
  denyAll?: boolean;
  applyEditResult?: { success: boolean; error?: string; backupPath?: string };
  revertResult?: { success: boolean; error?: string };
}): SafeVaultAccess {
  const allowedPaths = overrides?.allowedPaths || ["notes/", "daily/"];
  const denyAll = overrides?.denyAll || false;
  const applyEditResult = overrides?.applyEditResult || {
    success: true,
    backupPath: ".backups/test.md.bak",
  };
  const revertResult = overrides?.revertResult || { success: true };

  return {
    isPathAllowed: vi.fn((path: string) => {
      if (denyAll) return false;
      return allowedPaths.some((allowed) => path.startsWith(allowed));
    }),
    proposeEdit: vi.fn(),
    applyEdit: vi.fn().mockResolvedValue(applyEditResult),
    revertEdit: vi.fn().mockResolvedValue(revertResult),
  } as unknown as SafeVaultAccess;
}

// Helper to create a TaskStep
function createStep(overrides?: Partial<TaskStep>): TaskStep {
  return {
    id: "step-1",
    type: "add-tag",
    description: "Add a tag to note",
    status: "pending",
    params: {
      path: "notes/test.md",
      tag: "project",
    },
    ...overrides,
  };
}

describe("AddTagHandler", () => {
  let app: App;
  let vault: SafeVaultAccess;
  let handler: AddTagHandler;

  beforeEach(() => {
    app = createMockApp();
    vault = createMockVault();
    handler = new AddTagHandler(app, vault);
  });

  describe("canHandle", () => {
    it("should handle add-tag steps", () => {
      expect(handler.canHandle("add-tag")).toBe(true);
    });

    it("should not handle other step types", () => {
      expect(handler.canHandle("create-note")).toBe(false);
      expect(handler.canHandle("add-link")).toBe(false);
    });
  });

  describe("execute", () => {
    describe("adding frontmatter to file without it", () => {
      it("should create frontmatter with tag for file without frontmatter", async () => {
        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(true);
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "---\ntags:\n  - project\n---\n\n# Test Note\n\nContent here.",
          expect.any(String)
        );
      });
    });

    describe("adding to existing frontmatter", () => {
      it("should add tag to empty tags field", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/test.md": "---\ntitle: Test\ntags:\n---\n\n# Content",
          },
        });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "---\ntitle: Test\ntags:\n  - project\n---\n\n# Content",
          expect.any(String)
        );
      });

      it("should add tag to existing list-style tags", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/test.md": "---\ntags:\n  - existing\n---\n\n# Content",
          },
        });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          expect.stringContaining("- existing"),
          expect.any(String)
        );
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          expect.stringContaining("- project"),
          expect.any(String)
        );
      });

      it("should add tag to inline-style tags", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/test.md": "---\ntags: [existing]\n---\n\n# Content",
          },
        });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "---\ntags: [existing, project]\n---\n\n# Content",
          expect.any(String)
        );
      });

      it("should add tags field if frontmatter exists but no tags", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/test.md": "---\ntitle: Test\n---\n\n# Content",
          },
        });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          expect.stringContaining("tags:\n  - project"),
          expect.any(String)
        );
      });
    });

    describe("tag normalization", () => {
      it("should strip # prefix from tag", async () => {
        const step = createStep({
          params: { path: "notes/test.md", tag: "#project" },
        });
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          expect.stringContaining("- project"),
          expect.any(String)
        );
        expect(vault.proposeEdit).not.toHaveBeenCalledWith(
          "notes/test.md",
          expect.stringContaining("- #project"),
          expect.any(String)
        );
      });
    });

    describe("duplicate detection", () => {
      it("should fail if tag already exists in frontmatter list", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/test.md": "---\ntags:\n  - project\n---\n\n# Content",
          },
        });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already exists");
      });

      it("should fail if tag exists in inline frontmatter", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/test.md": "---\ntags: [project, other]\n---\n\n# Content",
          },
        });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already exists");
      });

      it("should fail if inline tag exists in content", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/test.md": "# Content\n\n#project is here",
          },
        });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already exists");
      });
    });

    describe("error handling", () => {
      it("should fail if file does not exist", async () => {
        const step = createStep({
          params: { path: "notes/missing.md", tag: "project" },
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("File not found");
      });

      it("should fail if path is not allowed", async () => {
        vault = createMockVault({ allowedPaths: ["allowed/"] });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Access denied");
      });

      it("should fail if applyEdit fails", async () => {
        vault = createMockVault({
          applyEditResult: { success: false, error: "Write error" },
        });
        handler = new AddTagHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Write error");
      });
    });

    describe("undo action", () => {
      it("should return undo action with original content", async () => {
        const step = createStep();
        const result = await handler.execute(step);

        expect(result.undoAction).toBeDefined();
        expect(result.undoAction?.type).toBe("remove-tag");
        expect(result.undoAction?.params?.originalContent).toBe(
          "# Test Note\n\nContent here."
        );
        expect(result.undoAction?.params?.tag).toBe("project");
      });
    });
  });

  describe("undo", () => {
    it("should restore from backup when available", async () => {
      const undoAction = {
        type: "remove-tag" as const,
        path: "notes/test.md",
        params: {
          tag: "project",
          originalContent: "# Original",
          backupPath: ".backups/test.md.bak",
        },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(true);
      expect(vault.revertEdit).toHaveBeenCalledWith("notes/test.md");
    });

    it("should fall back to original content if backup fails", async () => {
      vault = createMockVault({
        revertResult: { success: false },
      });
      handler = new AddTagHandler(app, vault);

      const undoAction = {
        type: "remove-tag" as const,
        path: "notes/test.md",
        params: {
          tag: "project",
          originalContent: "# Original Content",
          backupPath: ".backups/test.md.bak",
        },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(true);
      expect(app.vault.modify).toHaveBeenCalled();
    });

    it("should fail for unexpected undo type", async () => {
      const undoAction = { type: "delete" as const, path: "test.md" };
      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unexpected undo type");
    });

    it("should fail if no backup or original content", async () => {
      vault = createMockVault({ revertResult: { success: false } });
      handler = new AddTagHandler(app, vault);

      const undoAction = {
        type: "remove-tag" as const,
        path: "notes/test.md",
        params: { tag: "project" },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not restore");
    });
  });
});
