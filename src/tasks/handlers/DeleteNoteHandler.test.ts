/**
 * DeleteNoteHandler Tests
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteNoteHandler } from "./DeleteNoteHandler";
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
    "notes/to-delete.md": "# Content to Delete\n\nThis will be deleted.",
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
      delete: vi.fn((file: TAbstractFile): Promise<void> => {
        fileContents.delete(file.path);
        return Promise.resolve();
      }),
      create: vi.fn((path: string, content: string): Promise<TFile> => {
        fileContents.set(path, content);
        return Promise.resolve({ path, extension: "md" } as TFile);
      }),
    },
  } as unknown as App;
}

// Mock SafeVaultAccess
function createMockVault(overrides?: {
  allowedPaths?: string[];
  denyAll?: boolean;
}): SafeVaultAccess {
  const allowedPaths = overrides?.allowedPaths || ["notes/", "daily/"];
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
    type: "delete-note",
    description: "Delete a note",
    status: "pending",
    params: {
      path: "notes/to-delete.md",
    },
    ...overrides,
  };
}

describe("DeleteNoteHandler", () => {
  let app: App;
  let vault: SafeVaultAccess;
  let handler: DeleteNoteHandler;

  beforeEach(() => {
    app = createMockApp();
    vault = createMockVault();
    handler = new DeleteNoteHandler(app, vault);
  });

  describe("canHandle", () => {
    it("should handle delete-note steps", () => {
      expect(handler.canHandle("delete-note")).toBe(true);
    });

    it("should not handle other step types", () => {
      expect(handler.canHandle("create-note")).toBe(false);
      expect(handler.canHandle("modify-note")).toBe(false);
    });
  });

  describe("execute", () => {
    it("should delete an existing file", async () => {
      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(true);
      expect(result.path).toBe("notes/to-delete.md");
      expect(app.vault.delete).toHaveBeenCalled();
    });

    it("should return undo action with file content", async () => {
      const step = createStep();
      const result = await handler.execute(step);

      expect(result.undoAction).toBeDefined();
      expect(result.undoAction?.type).toBe("recreate");
      expect(result.undoAction?.params?.content).toBe(
        "# Content to Delete\n\nThis will be deleted."
      );
    });

    it("should fail if file does not exist", async () => {
      const step = createStep({
        params: { path: "notes/missing.md" },
      });
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
      expect(app.vault.delete).not.toHaveBeenCalled();
    });

    it("should fail if path is not allowed", async () => {
      vault = createMockVault({ allowedPaths: ["allowed/"] });
      handler = new DeleteNoteHandler(app, vault);

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });

    it("should handle deletion errors", async () => {
      (app.vault.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cannot delete")
      );

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot delete");
    });

    it("should handle read errors during backup", async () => {
      (app.vault.read as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cannot read")
      );

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot read");
    });
  });

  describe("undo", () => {
    it("should recreate the deleted file", async () => {
      // First delete the file
      const step = createStep();
      const deleteResult = await handler.execute(step);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.undoAction).toBeDefined();

      // Reset the mock to simulate file is now gone
      (app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const undoResult = await handler.undo(deleteResult.undoAction!);

      expect(undoResult.success).toBe(true);
      expect(app.vault.create).toHaveBeenCalledWith(
        "notes/to-delete.md",
        "# Content to Delete\n\nThis will be deleted."
      );
    });

    it("should succeed if file already exists (already restored)", async () => {
      const undoAction = {
        type: "recreate" as const,
        path: "notes/to-delete.md",
        params: { content: "content" },
      };

      // File still exists in mock
      const result = await handler.undo(undoAction);

      expect(result.success).toBe(true);
      expect(app.vault.create).not.toHaveBeenCalled();
    });

    it("should fail if no content backup available", async () => {
      (app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const undoAction = {
        type: "recreate" as const,
        path: "notes/to-delete.md",
        params: {},
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("no content backup");
    });

    it("should fail for unexpected undo type", async () => {
      const undoAction = { type: "delete" as const, path: "test.md" };
      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unexpected undo type");
    });

    it("should handle creation errors during undo", async () => {
      (app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (app.vault.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Cannot create")
      );

      const undoAction = {
        type: "recreate" as const,
        path: "notes/to-delete.md",
        params: { content: "content" },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot create");
    });
  });
});
