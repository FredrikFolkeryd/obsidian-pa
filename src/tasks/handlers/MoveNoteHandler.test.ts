/**
 * MoveNoteHandler Tests
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MoveNoteHandler } from "./MoveNoteHandler";
import type { TaskStep, MoveNoteParams } from "../types";
import type { App, TFile, TAbstractFile, FileManager } from "obsidian";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

// Track files for the mock
const existingFiles = new Map<string, { path: string }>();

// Mock App
function createMockApp(overrides?: {
  files?: string[];
}): App {
  const files = overrides?.files || ["notes/source.md"];

  existingFiles.clear();
  files.forEach((path) => {
    existingFiles.set(path, { path });
  });

  const mockRenameFile = vi.fn((file: TFile, newPath: string): Promise<void> => {
    const oldPath = file.path;
    existingFiles.delete(oldPath);
    existingFiles.set(newPath, { path: newPath });
    return Promise.resolve();
  });

  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string): TAbstractFile | null => {
        const file = existingFiles.get(path);
        if (file) {
          return { ...file, extension: "md" } as TFile;
        }
        return null;
      }),
    },
    fileManager: {
      renameFile: mockRenameFile,
    } as unknown as FileManager,
  } as unknown as App;
}

// Mock SafeVaultAccess
function createMockVault(overrides?: {
  allowedPaths?: string[];
  denyAll?: boolean;
}): SafeVaultAccess {
  const allowedPaths = overrides?.allowedPaths || ["notes/", "archive/"];
  const denyAll = overrides?.denyAll || false;

  return {
    isPathAllowed: vi.fn((path: string) => {
      if (denyAll) return false;
      return allowedPaths.some((allowed) => path.startsWith(allowed));
    }),
  } as unknown as SafeVaultAccess;
}

// Helper to create a TaskStep
function createStep(overrides?: Partial<TaskStep>): TaskStep {
  return {
    id: "step-1",
    type: "move-note",
    description: "Move a note",
    status: "pending",
    params: {
      path: "notes/source.md",
      newPath: "archive/source.md",
      updateLinks: true,
    },
    ...overrides,
  };
}

describe("MoveNoteHandler", () => {
  let app: App;
  let vault: SafeVaultAccess;
  let handler: MoveNoteHandler;

  beforeEach(() => {
    app = createMockApp();
    vault = createMockVault();
    handler = new MoveNoteHandler(app, vault);
  });

  describe("canHandle", () => {
    it("should handle move-note steps", () => {
      expect(handler.canHandle("move-note")).toBe(true);
    });

    it("should not handle other step types", () => {
      expect(handler.canHandle("create-note")).toBe(false);
      expect(handler.canHandle("delete-note")).toBe(false);
    });
  });

  describe("execute", () => {
    it("should move a file to new location", async () => {
      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(true);
      expect(result.path).toBe("archive/source.md");
      expect(app.fileManager.renameFile).toHaveBeenCalled();
    });

    it("should return undo action with original path", async () => {
      const step = createStep();
      const result = await handler.execute(step);

      expect(result.undoAction).toBeDefined();
      expect(result.undoAction?.type).toBe("move-back");
      expect(result.undoAction?.params?.originalPath).toBe("notes/source.md");
    });

    it("should track if links were updated", async () => {
      const step = createStep({
        params: {
          path: "notes/source.md",
          newPath: "archive/source.md",
          updateLinks: true,
        } as MoveNoteParams,
      });
      const result = await handler.execute(step);

      expect(result.success).toBe(true);
      expect(result.metadata?.linksUpdated).toBe(true);
    });

    it("should fail if source file does not exist", async () => {
      const step = createStep({
        params: {
          path: "notes/missing.md",
          newPath: "archive/missing.md",
        } as MoveNoteParams,
      });
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Source file not found");
    });

    it("should fail if destination already exists", async () => {
      app = createMockApp({ files: ["notes/source.md", "archive/source.md"] });
      handler = new MoveNoteHandler(app, vault);

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Destination already exists");
    });

    it("should fail if source path is not allowed", async () => {
      vault = createMockVault({ allowedPaths: ["archive/"] });
      handler = new MoveNoteHandler(app, vault);

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied to source path");
    });

    it("should fail if destination path is not allowed", async () => {
      vault = createMockVault({ allowedPaths: ["notes/"] });
      handler = new MoveNoteHandler(app, vault);

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied to destination path");
    });

    it("should handle rename errors", async () => {
      (app.fileManager.renameFile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cannot rename")
      );

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot rename");
    });
  });

  describe("undo", () => {
    it("should move file back to original location", async () => {
      // First move the file
      const step = createStep();
      const moveResult = await handler.execute(step);
      expect(moveResult.success).toBe(true);

      // Now undo
      const undoResult = await handler.undo(moveResult.undoAction!);

      expect(undoResult.success).toBe(true);
      // File should be back at original location
      expect(existingFiles.has("notes/source.md")).toBe(true);
    });

    it("should fail if original path not recorded", async () => {
      const undoAction = {
        type: "move-back" as const,
        path: "archive/source.md",
        params: {},
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("original path not recorded");
    });

    it("should fail if file no longer exists at moved location", async () => {
      // Simulate file was deleted after move
      existingFiles.clear();

      const undoAction = {
        type: "move-back" as const,
        path: "archive/source.md",
        params: { originalPath: "notes/source.md" },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("no longer exists");
    });

    it("should fail if original path is now occupied", async () => {
      // Move the file first
      const step = createStep();
      await handler.execute(step);

      // Simulate something else now exists at original path
      existingFiles.set("notes/source.md", { path: "notes/source.md" });

      const undoAction = {
        type: "move-back" as const,
        path: "archive/source.md",
        params: { originalPath: "notes/source.md" },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("original path is now occupied");
    });

    it("should fail for unexpected undo type", async () => {
      const undoAction = { type: "delete" as const, path: "test.md" };
      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unexpected undo type");
    });

    it("should handle rename errors during undo", async () => {
      // First move the file
      const step = createStep();
      await handler.execute(step);

      // Now make rename fail
      (app.fileManager.renameFile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cannot rename")
      );

      const undoAction = {
        type: "move-back" as const,
        path: "archive/source.md",
        params: { originalPath: "notes/source.md" },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot rename");
    });
  });
});
