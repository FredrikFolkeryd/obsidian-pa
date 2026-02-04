/**
 * ModifyNoteHandler Tests
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModifyNoteHandler } from "./ModifyNoteHandler";
import type { TaskStep, ModifyNoteParams } from "../types";
import type { App, TFile, TAbstractFile } from "obsidian";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

// Mock file content store
const fileContents = new Map<string, string>();

// Mock App
function createMockApp(overrides?: {
  existingFiles?: Record<string, string>;
}): App {
  const existingFiles = overrides?.existingFiles || {
    "notes/test.md": "# Original Content\n\nSome text here.",
  };

  // Store contents
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
    type: "modify-note",
    description: "Modify a note",
    status: "pending",
    params: {
      path: "notes/test.md",
      content: "# New Content",
    } as ModifyNoteParams,
    ...overrides,
  };
}

describe("ModifyNoteHandler", () => {
  let app: App;
  let vault: SafeVaultAccess;
  let handler: ModifyNoteHandler;

  beforeEach(() => {
    app = createMockApp();
    vault = createMockVault();
    handler = new ModifyNoteHandler(app, vault);
  });

  describe("canHandle", () => {
    it("should handle modify-note steps", () => {
      expect(handler.canHandle("modify-note")).toBe(true);
    });

    it("should not handle other step types", () => {
      expect(handler.canHandle("create-note")).toBe(false);
      expect(handler.canHandle("delete-note")).toBe(false);
    });
  });

  describe("execute", () => {
    describe("full content replacement", () => {
      it("should replace entire file content", async () => {
        const step = createStep({
          params: {
            path: "notes/test.md",
            content: "# Completely New Content",
          } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(true);
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "# Completely New Content",
          "Modify a note"
        );
        expect(vault.applyEdit).toHaveBeenCalledWith("notes/test.md");
      });

      it("should return undo action with original content", async () => {
        const step = createStep();
        const result = await handler.execute(step);

        expect(result.undoAction).toBeDefined();
        expect(result.undoAction?.type).toBe("restore");
        expect(result.undoAction?.params?.originalContent).toBe(
          "# Original Content\n\nSome text here."
        );
      });
    });

    describe("search and replace", () => {
      it("should replace matching text", async () => {
        const step = createStep({
          params: {
            path: "notes/test.md",
            search: "Original",
            replace: "Updated",
          } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(true);
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "# Updated Content\n\nSome text here.",
          "Modify a note"
        );
      });

      it("should remove text when replace is empty", async () => {
        const step = createStep({
          params: {
            path: "notes/test.md",
            search: "Original ",
            replace: "",
          } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(true);
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "# Content\n\nSome text here.",
          "Modify a note"
        );
      });

      it("should delete text when replace is undefined", async () => {
        const step = createStep({
          params: {
            path: "notes/test.md",
            search: "# Original Content\n\n",
          } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(true);
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "Some text here.",
          "Modify a note"
        );
      });
    });

    describe("append", () => {
      it("should append content to end of file", async () => {
        const step = createStep({
          params: {
            path: "notes/test.md",
            append: "\n\n## New Section",
          } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(true);
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "# Original Content\n\nSome text here.\n\n## New Section",
          "Modify a note"
        );
      });
    });

    describe("prepend", () => {
      it("should prepend content to start of file", async () => {
        const step = createStep({
          params: {
            path: "notes/test.md",
            prepend: "---\ntags: [test]\n---\n\n",
          } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(true);
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/test.md",
          "---\ntags: [test]\n---\n\n# Original Content\n\nSome text here.",
          "Modify a note"
        );
      });
    });

    describe("error handling", () => {
      it("should fail if file does not exist", async () => {
        const step = createStep({
          params: { path: "notes/missing.md", content: "new" } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("File not found");
      });

      it("should fail if path is not allowed", async () => {
        vault = createMockVault({ allowedPaths: ["allowed/"] });
        handler = new ModifyNoteHandler(app, vault);

        const step = createStep({
          params: { path: "notes/test.md", content: "new" } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Access denied");
      });

      it("should fail if no modification is specified", async () => {
        const step = createStep({
          params: { path: "notes/test.md" } as ModifyNoteParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("No modification specified");
      });

      it("should fail if applyEdit fails", async () => {
        vault = createMockVault({
          applyEditResult: { success: false, error: "Backup failed" },
        });
        handler = new ModifyNoteHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Backup failed");
      });

      it("should handle exceptions", async () => {
        (app.vault.read as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Read error")
        );

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Read error");
      });
    });
  });

  describe("undo", () => {
    it("should restore from backup when available", async () => {
      const undoAction = {
        type: "restore" as const,
        path: "notes/test.md",
        params: {
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
        revertResult: { success: false, error: "Backup not found" },
      });
      handler = new ModifyNoteHandler(app, vault);

      const undoAction = {
        type: "restore" as const,
        path: "notes/test.md",
        params: {
          originalContent: "# Original Content",
          backupPath: ".backups/test.md.bak",
        },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(true);
      expect(app.vault.modify).toHaveBeenCalled();
    });

    it("should fail if no backup or original content", async () => {
      vault = createMockVault({ revertResult: { success: false } });
      handler = new ModifyNoteHandler(app, vault);

      const undoAction = {
        type: "restore" as const,
        path: "notes/test.md",
        params: {},
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not restore");
    });

    it("should fail for unexpected undo type", async () => {
      const undoAction = { type: "delete" as const, path: "test.md" };
      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unexpected undo type");
    });

    it("should handle restoration errors", async () => {
      vault = createMockVault({ revertResult: { success: false } });
      (app.vault.modify as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Write failed")
      );
      handler = new ModifyNoteHandler(app, vault);

      const undoAction = {
        type: "restore" as const,
        path: "notes/test.md",
        params: {
          originalContent: "# Original",
        },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Write failed");
    });
  });
});
