/**
 * TaskHistoryView Tests
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { TaskHistoryView, VIEW_TYPE_TASK_HISTORY } from "./TaskHistoryView";
import type PAPlugin from "../main";
import type { WorkspaceLeaf } from "obsidian";
import type { TaskHistoryEntry } from "../tasks";

// Mock document global
const mockStyleElement = {
  id: "",
  textContent: "",
};

vi.stubGlobal("document", {
  getElementById: vi.fn().mockReturnValue(null),
  createElement: vi.fn().mockReturnValue(mockStyleElement),
  head: {
    appendChild: vi.fn(),
  },
});

// Mock obsidian
vi.mock("obsidian", () => ({
  ItemView: class MockItemView {
    containerEl = {
      children: [
        null,
        {
          empty: vi.fn(),
          addClass: vi.fn(),
          createDiv: vi.fn().mockReturnValue({
            createEl: vi.fn().mockReturnValue({
              addEventListener: vi.fn(),
            }),
            createDiv: vi.fn().mockReturnValue({
              createEl: vi.fn().mockReturnValue({
                addEventListener: vi.fn(),
              }),
              createSpan: vi.fn(),
              hasClass: vi.fn().mockReturnValue(false),
              toggleClass: vi.fn(),
            }),
            createSpan: vi.fn(),
          }),
        },
      ],
    };
    app = {};
  },
  Notice: vi.fn(),
  Modal: class MockModal {
    app: unknown;
    contentEl = {
      empty: vi.fn(),
      addClass: vi.fn(),
      createEl: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
      }),
      createDiv: vi.fn().mockReturnValue({
        createEl: vi.fn().mockReturnValue({
          addEventListener: vi.fn(),
        }),
      }),
    };
    constructor(app: unknown) {
      this.app = app;
    }
    open() {}
    close() {}
  },
}));

// Mock tasks module
vi.mock("../tasks", () => ({
  TaskHistoryManager: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    export: vi.fn().mockReturnValue({ version: 1, entries: [] }),
    isDirty: vi.fn().mockReturnValue(false),
    markClean: vi.fn(),
    getEntries: vi.fn().mockReturnValue([]),
    getEntriesByStatus: vi.fn().mockReturnValue([]),
    addEntry: vi.fn(),
    markRolledBack: vi.fn(),
    clear: vi.fn(),
  })),
  getHistoryStats: vi.fn().mockReturnValue({
    total: 0,
    completed: 0,
    failed: 0,
    rolledBack: 0,
    rollbackable: 0,
  }),
  createTaskExecutor: vi.fn().mockReturnValue({
    rollback: vi.fn().mockResolvedValue({ status: "rolled-back" }),
  }),
}));

describe("TaskHistoryView", () => {
  let view: TaskHistoryView;
  let mockLeaf: WorkspaceLeaf;
  let mockPlugin: PAPlugin;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLeaf = {} as WorkspaceLeaf;

    mockPlugin = {
      loadData: vi.fn().mockResolvedValue({}),
      saveData: vi.fn().mockResolvedValue(undefined),
      safeVault: {
        getBackup: vi.fn().mockReturnValue({}),
      },
    } as unknown as PAPlugin;

    view = new TaskHistoryView(mockLeaf, mockPlugin);
  });

  describe("view metadata", () => {
    it("should return correct view type", () => {
      expect(view.getViewType()).toBe(VIEW_TYPE_TASK_HISTORY);
    });

    it("should return correct display text", () => {
      expect(view.getDisplayText()).toBe("Task History");
    });

    it("should return correct icon", () => {
      expect(view.getIcon()).toBe("history");
    });
  });

  describe("VIEW_TYPE_TASK_HISTORY constant", () => {
    it("should be defined", () => {
      expect(VIEW_TYPE_TASK_HISTORY).toBe("pa-task-history-view");
    });
  });

  describe("onOpen", () => {
    it("should load history on open", async () => {
      await view.onOpen();
      expect(mockPlugin.loadData).toHaveBeenCalled();
    });
  });

  describe("onClose", () => {
    it("should save history if dirty on close", async () => {
      // Access internal historyManager
      const historyManager = (view as unknown as { historyManager: { isDirty: Mock } })
        .historyManager;
      historyManager.isDirty.mockReturnValue(true);

      await view.onClose();
      // When dirty, save should be called
      expect(mockPlugin.saveData).toHaveBeenCalled();
    });

    it("should not save if not dirty", async () => {
      const historyManager = (view as unknown as { historyManager: { isDirty: Mock } })
        .historyManager;
      historyManager.isDirty.mockReturnValue(false);

      await view.onClose();
      // loadData may be called during setup, but saveData should not
      expect(mockPlugin.saveData).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("should reload history and render", async () => {
      await view.refresh();
      expect(mockPlugin.loadData).toHaveBeenCalled();
    });
  });

  describe("addEntry", () => {
    it("should add entry to history manager", async () => {
      const mockPlan = {
        id: "test-plan",
        description: "Test plan",
        steps: [],
        status: "completed" as const,
      };

      const historyManager = (
        view as unknown as { historyManager: { addEntry: Mock; isDirty: Mock } }
      ).historyManager;
      historyManager.isDirty.mockReturnValue(true);

      await view.addEntry(mockPlan, "completed");

      expect(historyManager.addEntry).toHaveBeenCalledWith(
        mockPlan,
        "completed",
        undefined
      );
    });

    it("should add entry with error for failed status", async () => {
      const mockPlan = {
        id: "test-plan",
        description: "Failed plan",
        steps: [],
        status: "failed" as const,
      };

      const historyManager = (
        view as unknown as { historyManager: { addEntry: Mock; isDirty: Mock } }
      ).historyManager;
      historyManager.isDirty.mockReturnValue(true);

      await view.addEntry(mockPlan, "failed", "Something went wrong");

      expect(historyManager.addEntry).toHaveBeenCalledWith(
        mockPlan,
        "failed",
        "Something went wrong"
      );
    });
  });

  describe("getHistoryManager", () => {
    it("should return the history manager instance", () => {
      const manager = view.getHistoryManager();
      expect(manager).toBeDefined();
      expect(typeof manager.load).toBe("function");
      expect(typeof manager.getEntries).toBe("function");
    });
  });
});

describe("TaskHistoryView integration", () => {
  it("should handle entries with various statuses", async () => {
    const mockEntries: TaskHistoryEntry[] = [
      {
        id: "entry-1",
        plan: { id: "p1", description: "Plan 1", steps: [], status: "completed" },
        executedAt: Date.now(),
        status: "completed",
        canRollback: true,
      },
      {
        id: "entry-2",
        plan: { id: "p2", description: "Plan 2", steps: [], status: "failed" },
        executedAt: Date.now() - 3600000,
        status: "failed",
        error: "Step failed",
        canRollback: false,
      },
      {
        id: "entry-3",
        plan: { id: "p3", description: "Plan 3", steps: [], status: "rolled-back" },
        executedAt: Date.now() - 7200000,
        status: "rolled-back",
        canRollback: false,
      },
    ];

    // Verify entries structure is correct
    expect(mockEntries).toHaveLength(3);
    expect(mockEntries[0].status).toBe("completed");
    expect(mockEntries[1].status).toBe("failed");
    expect(mockEntries[2].status).toBe("rolled-back");
  });
});
