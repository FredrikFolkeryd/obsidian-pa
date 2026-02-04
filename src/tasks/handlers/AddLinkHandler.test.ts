/**
 * AddLinkHandler Tests
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddLinkHandler } from "./AddLinkHandler";
import type { TaskStep, AddLinkParams } from "../types";
import type { App, TFile, TAbstractFile } from "obsidian";
import type { SafeVaultAccess } from "../../vault/SafeVaultAccess";

// Mock file content store
const fileContents = new Map<string, string>();

// Mock App
function createMockApp(overrides?: {
  existingFiles?: Record<string, string>;
}): App {
  const existingFiles = overrides?.existingFiles || {
    "notes/source.md": "# Source Note\n\nSome content here.",
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
    backupPath: ".backups/source.md.bak",
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
    type: "add-link",
    description: "Add a link to target",
    status: "pending",
    params: {
      path: "notes/source.md",
      target: "notes/target.md",
    } as AddLinkParams,
    ...overrides,
  };
}

describe("AddLinkHandler", () => {
  let app: App;
  let vault: SafeVaultAccess;
  let handler: AddLinkHandler;

  beforeEach(() => {
    app = createMockApp();
    vault = createMockVault();
    handler = new AddLinkHandler(app, vault);
  });

  describe("canHandle", () => {
    it("should handle add-link steps", () => {
      expect(handler.canHandle("add-link")).toBe(true);
    });

    it("should not handle other step types", () => {
      expect(handler.canHandle("create-note")).toBe(false);
      expect(handler.canHandle("modify-note")).toBe(false);
    });
  });

  describe("execute", () => {
    describe("link formatting", () => {
      it("should format wikilink without .md extension", async () => {
        const step = createStep({
          params: {
            path: "notes/source.md",
            target: "notes/target.md",
          } as AddLinkParams,
        });
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/source.md",
          expect.stringContaining("[[notes/target]]"),
          expect.any(String)
        );
      });

      it("should include display text when provided", async () => {
        const step = createStep({
          params: {
            path: "notes/source.md",
            target: "notes/target.md",
            displayText: "My Target Note",
          } as AddLinkParams,
        });
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/source.md",
          expect.stringContaining("[[notes/target|My Target Note]]"),
          expect.any(String)
        );
      });
    });

    describe("position - append (default)", () => {
      it("should append link at end of file by default", async () => {
        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(true);
        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/source.md",
          "# Source Note\n\nSome content here.\n[[notes/target]]\n",
          expect.any(String)
        );
      });
    });

    describe("position - prepend", () => {
      it("should prepend link at start of file", async () => {
        const step = createStep({
          params: {
            path: "notes/source.md",
            target: "notes/target.md",
            position: "prepend",
          } as AddLinkParams,
        });
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/source.md",
          "[[notes/target]]\n# Source Note\n\nSome content here.",
          expect.any(String)
        );
      });
    });

    describe("position - section", () => {
      it("should insert link after section heading", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/source.md": "# Source Note\n\n## Links\n\nExisting content.\n\n## Other",
          },
        });
        handler = new AddLinkHandler(app, vault);

        const step = createStep({
          params: {
            path: "notes/source.md",
            target: "notes/target.md",
            position: "section",
            section: "Links",
          } as AddLinkParams,
        });
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/source.md",
          "# Source Note\n\n## Links\n[[notes/target]]\n\nExisting content.\n\n## Other",
          expect.any(String)
        );
      });

      it("should create section if not found", async () => {
        const step = createStep({
          params: {
            path: "notes/source.md",
            target: "notes/target.md",
            position: "section",
            section: "Related Notes",
          } as AddLinkParams,
        });
        await handler.execute(step);

        expect(vault.proposeEdit).toHaveBeenCalledWith(
          "notes/source.md",
          expect.stringContaining("## Related Notes\n[[notes/target]]\n"),
          expect.any(String)
        );
      });

      it("should fail if section position but no section name", async () => {
        const step = createStep({
          params: {
            path: "notes/source.md",
            target: "notes/target.md",
            position: "section",
          } as AddLinkParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Section name required");
      });
    });

    describe("duplicate detection", () => {
      it("should fail if link already exists", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/source.md": "# Source\n\n[[notes/target]]\n",
          },
        });
        handler = new AddLinkHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already exists");
      });

      it("should fail if similar link exists (different format)", async () => {
        app = createMockApp({
          existingFiles: {
            "notes/source.md": "# Source\n\n[[notes/target|Target Note]]\n",
          },
        });
        handler = new AddLinkHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already exists");
      });
    });

    describe("error handling", () => {
      it("should fail if source file does not exist", async () => {
        const step = createStep({
          params: { path: "notes/missing.md", target: "target.md" } as AddLinkParams,
        });
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("File not found");
      });

      it("should fail if path is not allowed", async () => {
        vault = createMockVault({ allowedPaths: ["allowed/"] });
        handler = new AddLinkHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Access denied");
      });

      it("should fail if applyEdit fails", async () => {
        vault = createMockVault({
          applyEditResult: { success: false, error: "Backup failed" },
        });
        handler = new AddLinkHandler(app, vault);

        const step = createStep();
        const result = await handler.execute(step);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Backup failed");
      });
    });

    describe("undo action", () => {
      it("should return undo action with original content", async () => {
        const step = createStep();
        const result = await handler.execute(step);

        expect(result.undoAction).toBeDefined();
        expect(result.undoAction?.type).toBe("remove-link");
        expect(result.undoAction?.params?.originalContent).toBe(
          "# Source Note\n\nSome content here."
        );
      });
    });
  });

  describe("undo", () => {
    it("should restore from backup when available", async () => {
      const undoAction = {
        type: "remove-link" as const,
        path: "notes/source.md",
        params: {
          link: "[[notes/target]]",
          originalContent: "# Original",
          backupPath: ".backups/source.md.bak",
        },
      };

      const result = await handler.undo(undoAction);

      expect(result.success).toBe(true);
      expect(vault.revertEdit).toHaveBeenCalledWith("notes/source.md");
    });

    it("should fall back to original content if backup fails", async () => {
      vault = createMockVault({
        revertResult: { success: false },
      });
      handler = new AddLinkHandler(app, vault);

      const undoAction = {
        type: "remove-link" as const,
        path: "notes/source.md",
        params: {
          link: "[[notes/target]]",
          originalContent: "# Original Content",
          backupPath: ".backups/source.md.bak",
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
  });
});
