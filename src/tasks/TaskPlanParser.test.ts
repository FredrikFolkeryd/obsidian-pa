/**
 * Task Plan Parser Tests
 *
 * Tests for parsing AI responses into TaskPlan structures.
 */

import { describe, it, expect } from "vitest";
import {
  parseTaskPlan,
  extractTaskPlanXml,
  validateTaskPlan,
  sanitizePath,
  ParseError,
} from "./TaskPlanParser";
import type { TaskPlan, TaskStep } from "./types";

describe("TaskPlanParser", () => {
  describe("extractTaskPlanXml", () => {
    it("should extract task-plan XML from response", () => {
      const response = `
Here's a plan to organize your notes:

<task-plan name="Organize notes">
  <step type="create-note" path="inbox/new.md">Create inbox note</step>
</task-plan>

Let me know if you'd like me to proceed.
      `;

      const xml = extractTaskPlanXml(response);
      expect(xml).toContain('<task-plan name="Organize notes">');
      expect(xml).toContain("</task-plan>");
    });

    it("should return null if no task-plan found", () => {
      const response = "Just a regular response without any task plan.";
      expect(extractTaskPlanXml(response)).toBeNull();
    });

    it("should handle multiple task-plans (return first)", () => {
      const response = `
<task-plan name="First">
  <step type="create-note" path="a.md">First</step>
</task-plan>

<task-plan name="Second">
  <step type="create-note" path="b.md">Second</step>
</task-plan>
      `;

      const xml = extractTaskPlanXml(response);
      expect(xml).toContain('name="First"');
    });

    it("should handle malformed XML gracefully", () => {
      const response = "<task-plan>unclosed";
      expect(extractTaskPlanXml(response)).toBeNull();
    });
  });

  describe("parseTaskPlan", () => {
    it("should parse valid single-step plan", () => {
      const xml = `
<task-plan name="Create meeting note" description="Set up a new meeting note">
  <step type="create-note" path="meetings/2026-02-04.md">
    Create meeting note for today
  </step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);

      expect(plan.name).toBe("Create meeting note");
      expect(plan.description).toBe("Set up a new meeting note");
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].type).toBe("create-note");
      expect(plan.steps[0].params).toEqual({ path: "meetings/2026-02-04.md" });
      expect(plan.steps[0].description).toBe("Create meeting note for today");
      expect(plan.status).toBe("pending");
    });

    it("should parse multi-step plan", () => {
      const xml = `
<task-plan name="Organize project">
  <step type="create-note" path="projects/alpha/overview.md">
    Create project overview
  </step>
  <step type="add-link" path="projects/index.md" target="projects/alpha/overview.md">
    Link from projects index
  </step>
  <step type="add-tag" path="projects/alpha/overview.md" tag="project">
    Add project tag
  </step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);

      expect(plan.steps).toHaveLength(3);
      expect(plan.steps[0].type).toBe("create-note");
      expect(plan.steps[1].type).toBe("add-link");
      expect(plan.steps[1].params).toEqual({
        path: "projects/index.md",
        target: "projects/alpha/overview.md",
      });
      expect(plan.steps[2].type).toBe("add-tag");
      expect(plan.steps[2].params).toEqual({
        path: "projects/alpha/overview.md",
        tag: "project",
      });
    });

    it("should parse modify-note with content", () => {
      const xml = `
<task-plan name="Update note">
  <step type="modify-note" path="notes/daily.md">
    <content>
# Daily Note

Updated content here.
    </content>
    Update daily note content
  </step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);

      expect(plan.steps[0].type).toBe("modify-note");
      const params = plan.steps[0].params as { path: string; content: string };
      expect(params.path).toBe("notes/daily.md");
      expect(params.content).toContain("# Daily Note");
    });

    it("should parse modify-note with search/replace", () => {
      const xml = `
<task-plan name="Fix typo">
  <step type="modify-note" path="notes/doc.md" search="teh" replace="the">
    Fix typo
  </step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);
      const params = plan.steps[0].params as {
        path: string;
        search: string;
        replace: string;
      };
      expect(params.search).toBe("teh");
      expect(params.replace).toBe("the");
    });

    it("should parse move-note step", () => {
      const xml = `
<task-plan name="Reorganize">
  <step type="move-note" path="inbox/note.md" newPath="archive/note.md">
    Move to archive
  </step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);
      const params = plan.steps[0].params as { path: string; newPath: string };
      expect(params.path).toBe("inbox/note.md");
      expect(params.newPath).toBe("archive/note.md");
    });

    it("should parse delete-note step", () => {
      const xml = `
<task-plan name="Cleanup">
  <step type="delete-note" path="temp/scratch.md">
    Remove temporary note
  </step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);
      expect(plan.steps[0].type).toBe("delete-note");
      expect(plan.steps[0].params).toEqual({ path: "temp/scratch.md" });
    });

    it("should throw ParseError for malformed XML", () => {
      const xml = "<task-plan><step></task-plan>";
      expect(() => parseTaskPlan(xml)).toThrow(ParseError);
    });

    it("should throw ParseError for missing name attribute", () => {
      const xml = `
<task-plan>
  <step type="create-note" path="a.md">Create</step>
</task-plan>
      `;
      expect(() => parseTaskPlan(xml)).toThrow(ParseError);
      expect(() => parseTaskPlan(xml)).toThrow(/name/);
    });

    it("should throw ParseError for unknown step type", () => {
      const xml = `
<task-plan name="Test">
  <step type="unknown-type" path="a.md">Unknown</step>
</task-plan>
      `;
      expect(() => parseTaskPlan(xml)).toThrow(ParseError);
      expect(() => parseTaskPlan(xml)).toThrow(/unknown-type/);
    });

    it("should throw ParseError for missing required path", () => {
      const xml = `
<task-plan name="Test">
  <step type="create-note">Missing path</step>
</task-plan>
      `;
      expect(() => parseTaskPlan(xml)).toThrow(ParseError);
      expect(() => parseTaskPlan(xml)).toThrow(/path/);
    });

    it("should generate unique IDs for plan and steps", () => {
      const xml = `
<task-plan name="Test">
  <step type="create-note" path="a.md">First</step>
  <step type="create-note" path="b.md">Second</step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);

      expect(plan.id).toMatch(/^task-/);
      expect(plan.steps[0].id).toMatch(/^step-/);
      expect(plan.steps[1].id).toMatch(/^step-/);
      expect(plan.steps[0].id).not.toBe(plan.steps[1].id);
    });

    it("should set createdAt timestamp", () => {
      const before = Date.now();
      const xml = `
<task-plan name="Test">
  <step type="create-note" path="a.md">Create</step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);
      const after = Date.now();

      expect(plan.createdAt).toBeGreaterThanOrEqual(before);
      expect(plan.createdAt).toBeLessThanOrEqual(after);
    });

    it("should trim whitespace from descriptions", () => {
      const xml = `
<task-plan name="Test">
  <step type="create-note" path="a.md">
    
    Create a new note   
    
  </step>
</task-plan>
      `;

      const plan = parseTaskPlan(xml);
      expect(plan.steps[0].description).toBe("Create a new note");
    });

    it("should handle empty task plan", () => {
      const xml = `<task-plan name="Empty"></task-plan>`;
      expect(() => parseTaskPlan(xml)).toThrow(ParseError);
      expect(() => parseTaskPlan(xml)).toThrow(/at least one step/);
    });
  });

  describe("sanitizePath", () => {
    it("should reject path traversal attempts", () => {
      expect(() => sanitizePath("../secret.md")).toThrow(ParseError);
      expect(() => sanitizePath("notes/../../../etc/passwd")).toThrow(
        ParseError
      );
      expect(() => sanitizePath("..\\secret.md")).toThrow(ParseError);
    });

    it("should reject absolute paths", () => {
      expect(() => sanitizePath("/etc/passwd")).toThrow(ParseError);
      expect(() => sanitizePath("C:\\Windows\\System32")).toThrow(ParseError);
    });

    it("should accept valid relative paths", () => {
      expect(sanitizePath("notes/daily.md")).toBe("notes/daily.md");
      expect(sanitizePath("inbox/new-note.md")).toBe("inbox/new-note.md");
      expect(sanitizePath("Projects/Alpha/README.md")).toBe(
        "Projects/Alpha/README.md"
      );
    });

    it("should normalize path separators", () => {
      expect(sanitizePath("notes\\daily.md")).toBe("notes/daily.md");
    });

    it("should trim whitespace", () => {
      expect(sanitizePath("  notes/daily.md  ")).toBe("notes/daily.md");
    });

    it("should reject empty paths", () => {
      expect(() => sanitizePath("")).toThrow(ParseError);
      expect(() => sanitizePath("   ")).toThrow(ParseError);
    });
  });

  describe("validateTaskPlan", () => {
    const createValidStep = (overrides?: Partial<TaskStep>): TaskStep => ({
      id: "step-1",
      type: "create-note",
      description: "Test step",
      params: { path: "test.md" },
      status: "pending",
      ...overrides,
    });

    const createValidPlan = (overrides?: Partial<TaskPlan>): TaskPlan => ({
      id: "task-1",
      name: "Test Plan",
      description: "Test description",
      steps: [createValidStep()],
      status: "pending",
      createdAt: Date.now(),
      ...overrides,
    });

    it("should validate a correct plan", () => {
      const plan = createValidPlan();
      const result = validateTaskPlan(plan);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject plan with too many steps", () => {
      const steps = Array.from({ length: 25 }, (_, i) =>
        createValidStep({ id: `step-${i}`, params: { path: `file${i}.md` } })
      );
      const plan = createValidPlan({ steps });
      const result = validateTaskPlan(plan, { maxSteps: 20 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Task plan exceeds maximum of 20 steps");
    });

    it("should reject plan with oversized content", () => {
      const largeContent = "x".repeat(200 * 1024); // 200KB
      const plan = createValidPlan({
        steps: [
          createValidStep({
            type: "modify-note",
            params: { path: "test.md", content: largeContent },
          }),
        ],
      });
      const result = validateTaskPlan(plan, { maxContentSize: 100 * 1024 });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("exceeds maximum content size");
    });

    it("should warn about delete operations", () => {
      const plan = createValidPlan({
        steps: [
          createValidStep({
            type: "delete-note",
            params: { path: "important.md" },
          }),
        ],
      });
      const result = validateTaskPlan(plan);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "Plan includes delete operation for: important.md"
      );
    });

    it("should warn about move operations", () => {
      const plan = createValidPlan({
        steps: [
          createValidStep({
            type: "move-note",
            params: { path: "a.md", newPath: "b.md" },
          }),
        ],
      });
      const result = validateTaskPlan(plan);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes("move operation"))).toBe(
        true
      );
    });

    it("should reject duplicate file operations in same plan", () => {
      const plan = createValidPlan({
        steps: [
          createValidStep({ id: "step-1", params: { path: "same.md" } }),
          createValidStep({
            id: "step-2",
            type: "modify-note",
            params: { path: "same.md", content: "new" },
          }),
        ],
      });
      const result = validateTaskPlan(plan);

      // This could be a warning or error depending on design choice
      // For now, we'll allow it but warn
      expect(result.warnings.some((w: string) => w.includes("same.md"))).toBe(true);
    });
  });
});
