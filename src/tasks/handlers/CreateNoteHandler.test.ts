/**
 * CreateNoteHandler Tests
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateNoteHandler } from "./CreateNoteHandler";
import type { TaskStep, CreateNoteParams } from "../types";
import type { App, TAbstractFile } from "obsidian";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

// Mock App
function createMockApp(overrides?: {
  existingFiles?: string[];
}): App {
  const existingFiles = overrides?.existingFiles || [];
  
  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string) => {
        if (existingFiles.includes(path)) {
          return { path } as TAbstractFile;
        }
        return null;
      }),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
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
    type: "create-note",
    description: "Create a new note",
    status: "pending",
    params: {
      path: "notes/new-note.md",
      content: "# New Note\n\nContent here.",
    },
    ...overrides,
  };
}

describe("CreateNoteHandler", () => {
  let app: App;
  let vault: SafeVaultAccess;
  let handler: CreateNoteHandler;

  beforeEach(() => {
    app = createMockApp();
    vault = createMockVault();
    handler = new CreateNoteHandler(app, vault);
  });

  describe("canHandle", () => {
    it("should handle create-note steps", () => {
      expect(handler.canHandle("create-note")).toBe(true);
    });

    it("should not handle other step types", () => {
      expect(handler.canHandle("modify-note")).toBe(false);
      expect(handler.canHandle("delete-note")).toBe(false);
      expect(handler.canHandle("add-link")).toBe(false);
    });
  });

  describe("execute", () => {
    it("should create a new file successfully", async () => {
      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(true);
      expect(result.path).toBe("notes/new-note.md");
      expect(app.vault.create).toHaveBeenCalledWith(
        "notes/new-note.md",
        "# New Note\n\nContent here."
      );
    });

    it("should return undo action for successful creation", async () => {
      const step = createStep();
      const result = await handler.execute(step);

      expect(result.undoAction).toEqual({
        type: "delete",
        path: "notes/new-note.md",
      });
    });

    it("should fail if file already exists", async () => {
      app = createMockApp({ existingFiles: ["notes/existing.md"] });
      handler = new CreateNoteHandler(app, vault);

      const step = createStep({
        params: { path: "notes/existing.md", content: "" } as CreateNoteParams,
      });
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("File already exists");
      expect(app.vault.create).not.toHaveBeenCalled();
    });

    it("should fail if path is not allowed", async () => {
      vault = createMockVault({ allowedPaths: ["allowed/"] });
      handler = new CreateNoteHandler(app, vault);

      const step = createStep({
        params: { path: "private/secret.md", content: "" } as CreateNoteParams,
      });
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });

    it("should create file with empty content if not provided", async () => {
      const step = createStep({
        params: { path: "notes/empty.md" } as CreateNoteParams,
      });
      const result = await handler.execute(step);

      expect(result.success).toBe(true);
      expect(app.vault.create).toHaveBeenCalledWith("notes/empty.md", "");
    });

    it("should handle vault creation errors", async () => {
      (app.vault.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Disk full")
      );

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Disk full");
    });

    it("should handle non-Error exceptions", async () => {
      (app.vault.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        "string error"
      );

      const step = createStep();
      const result = await handler.execute(step);

      expect(result.success).toBe(false);
      expect(result.error).toBe("string error");
    });
  });

  describe("undo", () => {
    it("should delete the created file", async () => {
      // First create the file
      const step = createStep();
      const createResult = await handler.execute(step);
      expect(createResult.undoAction).toBeDefined();

      // Setup mock for undo - file now exists
      app = createMockApp({ existingFiles: ["notes/new-note.md"] });
      handler = new CreateNoteHandler(app, vault);

      const undoResult = await handler.undo(createResult.undoAction!);

      expect(undoResult.success).toBe(true);
      expect(app.vault.delete).toHaveBeenCalled();
    });

    it("should succeed if file doesn't exist (already deleted)", async () => {
      const undoAction = { type: "delete" as const, path: "notes/gone.md" };
      const result = await handler.undo(undoAction);

      expect(result.success).toBe(true);
      expect(app.vault.delete).not.toHaveBeenCalled();
    });

    it("should fail for unexpected undo type", async () => {
      const undoAction = { type: "restore" as const, path: "test.md" };
      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unexpected undo type");
    });

    it("should handle deletion errors", async () => {
      app = createMockApp({ existingFiles: ["notes/locked.md"] });
      (app.vault.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("File is locked")
      );
      handler = new CreateNoteHandler(app, vault);

      const undoAction = { type: "delete" as const, path: "notes/locked.md" };
      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe("File is locked");
    });
  });
});
