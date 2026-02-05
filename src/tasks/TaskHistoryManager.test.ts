/**
 * TaskHistoryManager Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TaskHistoryManager,
  formatHistoryEntry,
  getHistoryStats,
  type TaskHistoryEntry,
  type TaskHistoryData,
} from "./TaskHistoryManager";
import type { TaskPlan } from "./types";

function createMockPlan(overrides: Partial<TaskPlan> = {}): TaskPlan {
  return {
    id: `plan-${Date.now()}`,
    name: "Test Plan",
    description: "Test plan",
    status: "completed",
    steps: [
      {
        id: "step-1",
        type: "create-note",
        description: "Create test note",
        status: "completed",
        params: { path: "test.md", content: "Hello" },
      },
    ],
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("TaskHistoryManager", () => {
  let manager: TaskHistoryManager;

  beforeEach(() => {
    manager = new TaskHistoryManager();
  });

  describe("constructor", () => {
    it("should create with default config", () => {
      const m = new TaskHistoryManager();
      expect(m.getCount()).toBe(0);
    });

    it("should accept custom config", () => {
      const m = new TaskHistoryManager({ maxEntries: 50 });
      expect(m.getCount()).toBe(0);
    });
  });

  describe("load", () => {
    it("should load valid history data", () => {
      const data: TaskHistoryData = {
        version: 1,
        entries: [
          {
            id: "hist-1",
            plan: createMockPlan(),
            executedAt: Date.now(),
            status: "completed",
            canRollback: true,
          },
        ],
      };

      manager.load(data);
      expect(manager.getCount()).toBe(1);
    });

    it("should handle null data", () => {
      manager.load(null);
      expect(manager.getCount()).toBe(0);
    });

    it("should handle undefined data", () => {
      manager.load(undefined as unknown as TaskHistoryData);
      expect(manager.getCount()).toBe(0);
    });

    it("should handle invalid data", () => {
      manager.load("invalid" as unknown as TaskHistoryData);
      expect(manager.getCount()).toBe(0);
    });

    it("should handle unknown version", () => {
      const data = {
        version: 999,
        entries: [],
      };
      manager.load(data);
      expect(manager.getCount()).toBe(0);
    });

    it("should handle missing entries array", () => {
      const data = {
        version: 1,
        entries: null as unknown as TaskHistoryEntry[],
      };
      manager.load(data);
      expect(manager.getCount()).toBe(0);
    });
  });

  describe("export", () => {
    it("should export empty history", () => {
      const data = manager.export();
      expect(data.version).toBe(1);
      expect(data.entries).toEqual([]);
    });

    it("should export with entries", () => {
      manager.addEntry(createMockPlan(), "completed");
      const data = manager.export();
      expect(data.entries).toHaveLength(1);
    });
  });

  describe("addEntry", () => {
    it("should add completed entry", () => {
      const plan = createMockPlan();
      const entry = manager.addEntry(plan, "completed");

      expect(entry.status).toBe("completed");
      expect(entry.plan).toBe(plan);
      expect(entry.canRollback).toBe(true);
      expect(manager.getCount()).toBe(1);
    });

    it("should add failed entry with error", () => {
      const plan = createMockPlan();
      const entry = manager.addEntry(plan, "failed", "Something went wrong");

      expect(entry.status).toBe("failed");
      expect(entry.error).toBe("Something went wrong");
      expect(entry.canRollback).toBe(false);
    });

    it("should add entry to front of list", () => {
      const plan1 = createMockPlan({ id: "plan-1" });
      const plan2 = createMockPlan({ id: "plan-2" });

      manager.addEntry(plan1, "completed");
      manager.addEntry(plan2, "completed");

      const entries = manager.getEntries();
      expect(entries[0].plan.id).toBe("plan-2");
      expect(entries[1].plan.id).toBe("plan-1");
    });

    it("should mark as dirty", () => {
      expect(manager.isDirty()).toBe(false);
      manager.addEntry(createMockPlan(), "completed");
      expect(manager.isDirty()).toBe(true);
    });

    it("should generate unique IDs", () => {
      const entry1 = manager.addEntry(createMockPlan(), "completed");
      const entry2 = manager.addEntry(createMockPlan(), "completed");
      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe("markRolledBack", () => {
    it("should mark entry as rolled back", () => {
      const entry = manager.addEntry(createMockPlan(), "completed");
      expect(entry.canRollback).toBe(true);

      const result = manager.markRolledBack(entry.id);
      expect(result).toBe(true);

      const updated = manager.getEntry(entry.id);
      expect(updated?.status).toBe("rolled-back");
      expect(updated?.canRollback).toBe(false);
    });

    it("should return false for non-existent entry", () => {
      const result = manager.markRolledBack("non-existent");
      expect(result).toBe(false);
    });

    it("should mark as dirty", () => {
      const entry = manager.addEntry(createMockPlan(), "completed");
      manager.markClean();

      manager.markRolledBack(entry.id);
      expect(manager.isDirty()).toBe(true);
    });
  });

  describe("getEntries", () => {
    it("should return copy of entries", () => {
      manager.addEntry(createMockPlan(), "completed");
      const entries = manager.getEntries();
      entries.push({} as TaskHistoryEntry);

      expect(manager.getCount()).toBe(1);
    });
  });

  describe("getEntriesByStatus", () => {
    it("should filter by completed", () => {
      manager.addEntry(createMockPlan(), "completed");
      manager.addEntry(createMockPlan(), "failed");
      manager.addEntry(createMockPlan(), "completed");

      const completed = manager.getEntriesByStatus("completed");
      expect(completed).toHaveLength(2);
    });

    it("should filter by failed", () => {
      manager.addEntry(createMockPlan(), "completed");
      manager.addEntry(createMockPlan(), "failed");

      const failed = manager.getEntriesByStatus("failed");
      expect(failed).toHaveLength(1);
    });
  });

  describe("getEntriesByDateRange", () => {
    it("should filter by date range", () => {
      const now = Date.now();
      const data: TaskHistoryData = {
        version: 1,
        entries: [
          {
            id: "hist-1",
            plan: createMockPlan(),
            executedAt: now - 1000,
            status: "completed",
            canRollback: true,
          },
          {
            id: "hist-2",
            plan: createMockPlan(),
            executedAt: now - 5000,
            status: "completed",
            canRollback: true,
          },
        ],
      };
      manager.load(data);

      const results = manager.getEntriesByDateRange(now - 3000, now);
      expect(results).toHaveLength(1);
    });
  });

  describe("getEntriesForFile", () => {
    it("should find entries affecting a file path", () => {
      const plan = createMockPlan({
        steps: [
          {
            id: "s1",
            type: "modify-note",
            description: "Edit file",
            status: "completed",
            params: { path: "notes/daily.md", content: "Updated" },
          },
        ],
      });
      manager.addEntry(plan, "completed");
      manager.addEntry(createMockPlan(), "completed");

      const results = manager.getEntriesForFile("notes/daily.md");
      expect(results).toHaveLength(1);
    });

    it("should find entries affecting destination path", () => {
      const plan = createMockPlan({
        steps: [
          {
            id: "s1",
            type: "move-note",
            description: "Move file",
            status: "completed",
            params: { path: "old.md", newPath: "archive/old.md" },
          },
        ],
      });
      manager.addEntry(plan, "completed");

      const results = manager.getEntriesForFile("archive/old.md");
      expect(results).toHaveLength(1);
    });
  });

  describe("getEntry", () => {
    it("should return entry by ID", () => {
      const entry = manager.addEntry(createMockPlan(), "completed");
      const found = manager.getEntry(entry.id);
      expect(found).toBe(entry);
    });

    it("should return null for non-existent ID", () => {
      const found = manager.getEntry("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("getRollbackableEntries", () => {
    it("should return only rollbackable entries", () => {
      manager.addEntry(createMockPlan(), "completed");
      manager.addEntry(createMockPlan(), "failed");
      manager.addEntry(createMockPlan(), "completed");

      const rollbackable = manager.getRollbackableEntries();
      expect(rollbackable).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      manager.addEntry(createMockPlan(), "completed");
      manager.addEntry(createMockPlan(), "completed");
      expect(manager.getCount()).toBe(2);

      manager.clear();
      expect(manager.getCount()).toBe(0);
    });

    it("should mark as dirty", () => {
      manager.addEntry(createMockPlan(), "completed");
      manager.markClean();

      manager.clear();
      expect(manager.isDirty()).toBe(true);
    });
  });

  describe("pruning", () => {
    it("should limit entries to maxEntries", () => {
      const m = new TaskHistoryManager({ maxEntries: 3, maxAgeDays: 30 });

      for (let i = 0; i < 5; i++) {
        m.addEntry(createMockPlan({ id: `plan-${i}` }), "completed");
      }

      expect(m.getCount()).toBe(3);
    });

    it("should remove old entries on load", () => {
      const m = new TaskHistoryManager({ maxEntries: 100, maxAgeDays: 1 });
      const now = Date.now();
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

      const data: TaskHistoryData = {
        version: 1,
        entries: [
          {
            id: "hist-new",
            plan: createMockPlan(),
            executedAt: now,
            status: "completed",
            canRollback: true,
          },
          {
            id: "hist-old",
            plan: createMockPlan(),
            executedAt: twoDaysAgo,
            status: "completed",
            canRollback: true,
          },
        ],
      };

      m.load(data);
      expect(m.getCount()).toBe(1);
    });
  });

  describe("isDirty / markClean", () => {
    it("should track dirty state", () => {
      expect(manager.isDirty()).toBe(false);

      manager.addEntry(createMockPlan(), "completed");
      expect(manager.isDirty()).toBe(true);

      manager.markClean();
      expect(manager.isDirty()).toBe(false);
    });
  });
});

describe("formatHistoryEntry", () => {
  it("should format completed entry", () => {
    const entry: TaskHistoryEntry = {
      id: "hist-1",
      plan: createMockPlan({ description: "Test task" }),
      executedAt: Date.now(),
      status: "completed",
      canRollback: true,
    };

    const result = formatHistoryEntry(entry);
    expect(result).toContain("✅");
    expect(result).toContain("Test task");
    expect(result).toContain("1 step");
  });

  it("should format failed entry", () => {
    const entry: TaskHistoryEntry = {
      id: "hist-1",
      plan: createMockPlan(),
      executedAt: Date.now(),
      status: "failed",
      error: "Error",
      canRollback: false,
    };

    const result = formatHistoryEntry(entry);
    expect(result).toContain("❌");
  });

  it("should format rolled-back entry", () => {
    const entry: TaskHistoryEntry = {
      id: "hist-1",
      plan: createMockPlan(),
      executedAt: Date.now(),
      status: "rolled-back",
      canRollback: false,
    };

    const result = formatHistoryEntry(entry);
    expect(result).toContain("↩️");
  });

  it("should pluralize steps correctly", () => {
    const singleStep: TaskHistoryEntry = {
      id: "hist-1",
      plan: createMockPlan(),
      executedAt: Date.now(),
      status: "completed",
      canRollback: true,
    };

    const multiStep: TaskHistoryEntry = {
      id: "hist-2",
      plan: createMockPlan({
        steps: [
          { id: "s1", type: "create-note", description: "", status: "completed", params: { path: "a.md", content: "" } },
          { id: "s2", type: "add-tag", description: "", status: "completed", params: { path: "a.md", tag: "x" } },
        ],
      }),
      executedAt: Date.now(),
      status: "completed",
      canRollback: true,
    };

    expect(formatHistoryEntry(singleStep)).toContain("1 step)");
    expect(formatHistoryEntry(multiStep)).toContain("2 steps)");
  });
});

describe("getHistoryStats", () => {
  it("should calculate stats correctly", () => {
    const entries: TaskHistoryEntry[] = [
      { id: "1", plan: createMockPlan(), executedAt: Date.now(), status: "completed", canRollback: true },
      { id: "2", plan: createMockPlan(), executedAt: Date.now(), status: "completed", canRollback: true },
      { id: "3", plan: createMockPlan(), executedAt: Date.now(), status: "failed", canRollback: false },
      { id: "4", plan: createMockPlan(), executedAt: Date.now(), status: "rolled-back", canRollback: false },
    ];

    const stats = getHistoryStats(entries);
    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.rolledBack).toBe(1);
    expect(stats.rollbackable).toBe(2);
  });

  it("should handle empty array", () => {
    const stats = getHistoryStats([]);
    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
  });
});
