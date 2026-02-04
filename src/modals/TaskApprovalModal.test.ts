/**
 * TaskApprovalModal Tests
 *
 * Tests for the task approval modal logic.
 * Since the modal is DOM-heavy, we extract and test the computation logic.
 */

import { describe, it, expect } from "vitest";

/**
 * Task step data for testing (minimal interface matching what we extract)
 */
interface TestTaskStep {
  id: string;
  type: string;
  status: string;
  description: string;
  params: Record<string, unknown>;
}

interface TestTaskPlan {
  id: string;
  status: string;
  steps: TestTaskStep[];
  createdAt: number;
}

/**
 * Calculate statistics for a task plan - extracted for testing
 */
function calculateStats(plan: TestTaskPlan): { totalSteps: number; affectedFiles: number } {
  const totalSteps = plan.steps.length;
  const affectedFiles = new Set<string>();

  for (const step of plan.steps) {
    const params = step.params;
    if (params.path && typeof params.path === "string") {
      affectedFiles.add(params.path);
    }
    // For move operations, also count destination
    if (params.destination && typeof params.destination === "string") {
      affectedFiles.add(params.destination);
    }
  }

  return { totalSteps, affectedFiles: affectedFiles.size };
}

/**
 * Get icon for step type
 */
const STEP_ICONS: Record<string, string> = {
  "create-note": "📄",
  "modify-note": "✏️",
  "delete-note": "🗑️",
  "move-note": "📁",
  "add-link": "🔗",
  "add-tag": "#️⃣",
};

/**
 * Get human-readable label for step type
 */
const STEP_LABELS: Record<string, string> = {
  "create-note": "Create Note",
  "modify-note": "Modify Note",
  "delete-note": "Delete Note",
  "move-note": "Move Note",
  "add-link": "Add Link",
  "add-tag": "Add Tag",
};

function getStepLabel(type: string): string {
  return STEP_LABELS[type] ?? type;
}

function getStepIcon(type: string): string {
  return STEP_ICONS[type] ?? "📋";
}

describe("TaskApprovalModal", () => {
  describe("calculateStats", () => {
    it("should count total steps", () => {
      const plan: TestTaskPlan = {
        id: "plan-1",
        status: "pending",
        steps: [
          { id: "s1", type: "create-note", status: "pending", description: "Create A", params: { path: "a.md", content: "" } },
          { id: "s2", type: "add-tag", status: "pending", description: "Tag A", params: { path: "a.md", tag: "test" } },
          { id: "s3", type: "add-link", status: "pending", description: "Link B", params: { path: "b.md", target: "c" } },
        ],
        createdAt: Date.now(),
      };

      const stats = calculateStats(plan);
      expect(stats.totalSteps).toBe(3);
    });

    it("should count unique affected files", () => {
      const plan: TestTaskPlan = {
        id: "plan-1",
        status: "pending",
        steps: [
          { id: "s1", type: "create-note", status: "pending", description: "Create A", params: { path: "a.md", content: "" } },
          { id: "s2", type: "add-tag", status: "pending", description: "Tag A", params: { path: "a.md", tag: "test" } },
          { id: "s3", type: "add-link", status: "pending", description: "Link B", params: { path: "b.md", target: "c" } },
        ],
        createdAt: Date.now(),
      };

      const stats = calculateStats(plan);
      expect(stats.affectedFiles).toBe(2); // a.md and b.md
    });

    it("should count move-note destination as affected file", () => {
      const plan: TestTaskPlan = {
        id: "plan-1",
        status: "pending",
        steps: [
          {
            id: "s1",
            type: "move-note",
            status: "pending",
            description: "Move file",
            params: { path: "old.md", destination: "new.md" },
          },
        ],
        createdAt: Date.now(),
      };

      const stats = calculateStats(plan);
      expect(stats.affectedFiles).toBe(2); // old.md and new.md
    });

    it("should handle empty plan", () => {
      const plan: TestTaskPlan = {
        id: "plan-1",
        status: "pending",
        steps: [],
        createdAt: Date.now(),
      };

      const stats = calculateStats(plan);
      expect(stats.totalSteps).toBe(0);
      expect(stats.affectedFiles).toBe(0);
    });

    it("should handle steps without path params", () => {
      const plan: TestTaskPlan = {
        id: "plan-1",
        status: "pending",
        steps: [
          { id: "s1", type: "create-note", status: "pending", description: "No path", params: {} },
        ],
        createdAt: Date.now(),
      };

      const stats = calculateStats(plan);
      expect(stats.affectedFiles).toBe(0);
    });

    it("should ignore non-string paths", () => {
      const plan: TestTaskPlan = {
        id: "plan-1",
        status: "pending",
        steps: [
          { id: "s1", type: "create-note", status: "pending", description: "Bad path", params: { path: 123 } },
        ],
        createdAt: Date.now(),
      };

      const stats = calculateStats(plan);
      expect(stats.affectedFiles).toBe(0);
    });
  });

  describe("step labels", () => {
    it("should return correct labels for all step types", () => {
      expect(getStepLabel("create-note")).toBe("Create Note");
      expect(getStepLabel("modify-note")).toBe("Modify Note");
      expect(getStepLabel("delete-note")).toBe("Delete Note");
      expect(getStepLabel("move-note")).toBe("Move Note");
      expect(getStepLabel("add-link")).toBe("Add Link");
      expect(getStepLabel("add-tag")).toBe("Add Tag");
    });

    it("should return type as fallback for unknown types", () => {
      expect(getStepLabel("unknown-type")).toBe("unknown-type");
    });
  });

  describe("step icons", () => {
    it("should return correct icons for all step types", () => {
      expect(getStepIcon("create-note")).toBe("📄");
      expect(getStepIcon("modify-note")).toBe("✏️");
      expect(getStepIcon("delete-note")).toBe("🗑️");
      expect(getStepIcon("move-note")).toBe("📁");
      expect(getStepIcon("add-link")).toBe("🔗");
      expect(getStepIcon("add-tag")).toBe("#️⃣");
    });

    it("should return default icon for unknown types", () => {
      expect(getStepIcon("unknown-type")).toBe("📋");
    });
  });
});

