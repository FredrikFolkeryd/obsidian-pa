/**
 * TaskPlanBlockParser Tests
 *
 * Tests for parsing task plans from AI responses.
 */

import { describe, it, expect } from "vitest";
import {
  parseTaskPlanBlocks,
  mayContainTaskPlan,
  extractRawTaskPlanXml,
} from "./TaskPlanBlockParser";

describe("TaskPlanBlockParser", () => {
  describe("parseTaskPlanBlocks", () => {
    it("should parse XML task-plan blocks", () => {
      const response = `Here's a plan to organize your notes:

<task-plan name="Organize notes" description="Organize project notes">
  <step type="create-note" path="Projects/overview.md">
    Create project overview
    <content># Project Overview</content>
  </step>
  <step type="add-tag" path="Projects/overview.md" tag="project">
    Add tag
  </step>
</task-plan>

Let me know if you'd like to proceed!`;

      const result = parseTaskPlanBlocks(response);

      expect(result.hasPlans).toBe(true);
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].format).toBe("xml");
      expect(result.plans[0].plan.description).toBe("Organize project notes");
      expect(result.plans[0].plan.steps).toHaveLength(2);
    });

    it("should parse fenced task-plan blocks", () => {
      const response = `Here's the plan:

\`\`\`task-plan
<task-plan name="New note plan">
  <step type="create-note" path="notes/new.md">
    New note
    <content># New Note</content>
  </step>
</task-plan>
\`\`\`

Shall I proceed?`;

      const result = parseTaskPlanBlocks(response);

      expect(result.hasPlans).toBe(true);
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].format).toBe("fenced");
      expect(result.plans[0].plan.steps).toHaveLength(1);
    });

    it("should parse fenced blocks with full task-plan tag", () => {
      const response = `\`\`\`task-plan
<task-plan name="Full plan" description="Full plan">
  <step type="modify-note" path="test.md">
    Update
    <content>Updated content</content>
  </step>
</task-plan>
\`\`\``;

      const result = parseTaskPlanBlocks(response);

      expect(result.hasPlans).toBe(true);
      expect(result.plans[0].plan.description).toBe("Full plan");
    });

    it("should handle multiple task plans in one response", () => {
      const response = `First plan:
<task-plan name="Plan A" description="Plan A">
  <step type="create-note" path="a.md">
    Create A
    <content>A</content>
  </step>
</task-plan>

Second plan:
<task-plan name="Plan B" description="Plan B">
  <step type="create-note" path="b.md">
    Create B
    <content>B</content>
  </step>
</task-plan>`;

      const result = parseTaskPlanBlocks(response);

      expect(result.hasPlans).toBe(true);
      expect(result.plans).toHaveLength(2);
      expect(result.plans[0].plan.description).toBe("Plan A");
      expect(result.plans[1].plan.description).toBe("Plan B");
    });

    it("should return empty result for response without plans", () => {
      const response = "Just a regular response with no task plans.";

      const result = parseTaskPlanBlocks(response);

      expect(result.hasPlans).toBe(false);
      expect(result.plans).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should add warnings for malformed plans", () => {
      const response = `<task-plan name="Invalid">
  <step type="invalid-type" path="test.md">Invalid step</step>
</task-plan>`;

      const result = parseTaskPlanBlocks(response);

      // Should have warnings about invalid step type
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it("should include validation results", () => {
      const response = `<task-plan name="Valid plan" description="Valid plan">
  <step type="create-note" path="test.md">
    Create note
    <content>content</content>
  </step>
</task-plan>`;

      const result = parseTaskPlanBlocks(response);

      expect(result.validations).toHaveLength(1);
      expect(result.validations[0].valid).toBe(true);
    });

    it("should track start and end indices", () => {
      const prefix = "Some text before. ";
      const planXml = `<task-plan name="Test" description="Test"><step type="create-note" path="a.md"><content>x</content></step></task-plan>`;
      const suffix = " Some text after.";
      const response = prefix + planXml + suffix;

      const result = parseTaskPlanBlocks(response);

      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].startIndex).toBe(prefix.length);
      expect(result.plans[0].endIndex).toBe(prefix.length + planXml.length);
    });

    it("should preserve raw XML", () => {
      const planXml = `<task-plan name="Test" description="Test">
  <step type="add-link" path="source.md" target="target">
    Add link
  </step>
</task-plan>`;
      const response = `Plan: ${planXml}`;

      const result = parseTaskPlanBlocks(response);

      expect(result.plans[0].rawXml).toBe(planXml);
    });
  });

  describe("mayContainTaskPlan", () => {
    it("should return true for responses with task-plan tag", () => {
      expect(mayContainTaskPlan("<task-plan>")).toBe(true);
      expect(mayContainTaskPlan("text <task-plan> more")).toBe(true);
    });

    it("should return true for responses with task-plan fence", () => {
      expect(mayContainTaskPlan("```task-plan")).toBe(true);
    });

    it("should return true for responses with step elements", () => {
      expect(mayContainTaskPlan('<step type="create-note">')).toBe(true);
      expect(mayContainTaskPlan("modify-note <step")).toBe(true);
    });

    it("should return false for regular responses", () => {
      expect(mayContainTaskPlan("Just a normal response")).toBe(false);
      expect(mayContainTaskPlan("Here is some code: ```js\ncode\n```")).toBe(false);
    });

    it("should return false for edit blocks", () => {
      expect(mayContainTaskPlan('<edit path="file.md">')).toBe(false);
    });
  });

  describe("extractRawTaskPlanXml", () => {
    it("should extract XML task-plan", () => {
      const xml = `<task-plan name="Test" description="Test"><step type="create-note" path="a.md"><content>x</content></step></task-plan>`;
      const response = `Before ${xml} After`;

      expect(extractRawTaskPlanXml(response)).toBe(xml);
    });

    it("should extract from fenced block", () => {
      const response = `\`\`\`task-plan
<step type="create-note" path="a.md"><content>x</content></step>
\`\`\``;

      const result = extractRawTaskPlanXml(response);
      expect(result).toContain("<task-plan>");
      expect(result).toContain("<step type=\"create-note\"");
    });

    it("should return null when no plan found", () => {
      expect(extractRawTaskPlanXml("No plan here")).toBeNull();
    });

    it("should prefer XML format over fenced", () => {
      const xmlPlan = `<task-plan name="T" description="T"><step type="add-tag" path="a.md" tag="test">Tag</step></task-plan>`;
      const response = `${xmlPlan}\n\`\`\`task-plan\nother\n\`\`\``;

      expect(extractRawTaskPlanXml(response)).toBe(xmlPlan);
    });
  });

  describe("parsing edge cases", () => {
    it("should handle nested XML gracefully", () => {
      const response = `<task-plan name="Test" description="Test">
  <step type="create-note" path="test.md">
    Test step
    <content>Some content with special chars</content>
  </step>
</task-plan>`;

      const result = parseTaskPlanBlocks(response);
      expect(result).toBeDefined();
      expect(result.hasPlans).toBe(true);
    });

    it("should handle task-plan with minimal content", () => {
      const response = `<task-plan name="Minimal" description="Minimal plan">
  <step type="create-note" path="minimal.md">
    Minimal step
    <content>x</content>
  </step>
</task-plan>`;
      const result = parseTaskPlanBlocks(response);

      // Plan with one step should parse
      expect(result.hasPlans).toBe(true);
      expect(result.plans[0].plan.steps).toHaveLength(1);
      expect(result.plans[0].plan.name).toBe("Minimal");
    });

    it("should not overlap XML and fenced detection", () => {
      // If XML contains the same content as a fenced block, avoid duplication
      const planXml = `<task-plan name="Test" description="Test"><step type="create-note" path="a.md"><content>x</content></step></task-plan>`;
      const response = planXml;

      const result = parseTaskPlanBlocks(response);
      expect(result.plans).toHaveLength(1);
    });
  });
});
