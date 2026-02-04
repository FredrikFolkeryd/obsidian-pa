/**
 * Task Executor Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskExecutor } from "./TaskExecutor";
import type {
  TaskPlan,
  TaskStep,
  TaskEvent,
  CreateNoteParams,
} from "./types";
import type { StepHandler, StepHandlerResult } from "./handlers/BaseStepHandler";

// Mock step handler
function createMockHandler(
  result: StepHandlerResult = { success: true, path: "test.md" }
): StepHandler {
  return {
    canHandle: vi.fn().mockReturnValue(true),
    execute: vi.fn().mockResolvedValue(result),
    undo: vi.fn().mockResolvedValue({ success: true }),
  };
}

// Helper to create test plans
function createTestPlan(overrides?: Partial<TaskPlan>): TaskPlan {
  return {
    id: "task-test-1",
    name: "Test Plan",
    description: "A test plan",
    steps: [
      {
        id: "step-1",
        type: "create-note",
        description: "Create a note",
        params: { path: "test.md", content: "Hello" } as CreateNoteParams,
        status: "pending",
      },
    ],
    status: "pending",
    createdAt: Date.now(),
    ...overrides,
  };
}

function createTestStep(overrides?: Partial<TaskStep>): TaskStep {
  return {
    id: "step-test",
    type: "create-note",
    description: "Test step",
    params: { path: "test.md" } as CreateNoteParams,
    status: "pending",
    ...overrides,
  };
}

describe("TaskExecutor", () => {
  let executor: TaskExecutor;
  let mockHandler: StepHandler;
  let events: TaskEvent[];

  beforeEach(() => {
    mockHandler = createMockHandler();
    executor = new TaskExecutor({
      handlers: new Map([["create-note", mockHandler]]),
    });
    events = [];
    executor.on((event: TaskEvent) => events.push(event));
  });

  describe("approve", () => {
    it("should approve a pending plan", () => {
      const plan = createTestPlan();
      const approved = executor.approve(plan);

      expect(approved.status).toBe("approved");
      expect(approved.approvedAt).toBeDefined();
      expect(approved.approvedAt).toBeGreaterThan(0);
    });

    it("should throw if plan is not pending", () => {
      const plan = createTestPlan({ status: "running" });
      expect(() => executor.approve(plan)).toThrow(/pending/);
    });

    it("should emit plan-approved event", () => {
      const plan = createTestPlan();
      executor.approve(plan);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("plan-approved");
      expect(events[0].planId).toBe(plan.id);
    });
  });

  describe("execute", () => {
    it("should execute an approved plan", async () => {
      const plan = createTestPlan({ status: "approved", approvedAt: Date.now() });
      const result = await executor.execute(plan);

      expect(result.status).toBe("completed");
      expect(result.completedAt).toBeDefined();
      expect(result.steps[0].status).toBe("completed");
    });

    it("should throw if plan is not approved", async () => {
      const plan = createTestPlan({ status: "pending" });
      await expect(executor.execute(plan)).rejects.toThrow(/approved/);
    });

    it("should execute steps in order", async () => {
      const steps = [
        createTestStep({ id: "step-1", params: { path: "a.md" } as CreateNoteParams }),
        createTestStep({ id: "step-2", params: { path: "b.md" } as CreateNoteParams }),
        createTestStep({ id: "step-3", params: { path: "c.md" } as CreateNoteParams }),
      ];
      const plan = createTestPlan({
        status: "approved",
        approvedAt: Date.now(),
        steps,
      });

      await executor.execute(plan);

      const executeCalls = (mockHandler.execute as ReturnType<typeof vi.fn>).mock.calls;
      expect(executeCalls).toHaveLength(3);
      expect(executeCalls[0][0].id).toBe("step-1");
      expect(executeCalls[1][0].id).toBe("step-2");
      expect(executeCalls[2][0].id).toBe("step-3");
    });

    it("should stop on first failure", async () => {
      const failingHandler = createMockHandler({
        success: false,
        error: "File already exists",
      });
      executor = new TaskExecutor({
        handlers: new Map([["create-note", failingHandler]]),
      });

      const steps = [
        createTestStep({ id: "step-1" }),
        createTestStep({ id: "step-2" }),
      ];
      const plan = createTestPlan({
        status: "approved",
        approvedAt: Date.now(),
        steps,
      });

      const result = await executor.execute(plan);

      expect(result.status).toBe("failed");
      expect(result.steps[0].status).toBe("failed");
      expect(result.steps[1].status).toBe("skipped");
      expect((failingHandler.execute as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    });

    it("should emit progress events", async () => {
      const plan = createTestPlan({ status: "approved", approvedAt: Date.now() });
      events = [];
      executor.on((event: TaskEvent) => events.push(event));

      await executor.execute(plan);

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain("execution-started");
      expect(eventTypes).toContain("step-started");
      expect(eventTypes).toContain("step-completed");
      expect(eventTypes).toContain("execution-completed");
    });

    it("should emit step-failed on failure", async () => {
      const failingHandler = createMockHandler({
        success: false,
        error: "Oops",
      });
      executor = new TaskExecutor({
        handlers: new Map([["create-note", failingHandler]]),
      });
      events = [];
      executor.on((event: TaskEvent) => events.push(event));

      const plan = createTestPlan({ status: "approved", approvedAt: Date.now() });
      await executor.execute(plan);

      const failedEvent = events.find((e) => e.type === "step-failed");
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.error).toBe("Oops");
    });

    it("should throw if no handler for step type", async () => {
      executor = new TaskExecutor({ handlers: new Map() });
      const plan = createTestPlan({ status: "approved", approvedAt: Date.now() });

      await expect(executor.execute(plan)).rejects.toThrow(/handler/i);
    });

    it("should set startedAt and completedAt timestamps", async () => {
      const before = Date.now();
      const plan = createTestPlan({ status: "approved", approvedAt: Date.now() });

      const result = await executor.execute(plan);
      const after = Date.now();

      expect(result.startedAt).toBeGreaterThanOrEqual(before);
      expect(result.startedAt).toBeLessThanOrEqual(after);
      expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt!);
      expect(result.completedAt).toBeLessThanOrEqual(after);
    });

    it("should store undo actions from handlers", async () => {
      const handlerWithUndo = createMockHandler({
        success: true,
        path: "test.md",
        undoAction: { type: "delete", path: "test.md" },
      });
      executor = new TaskExecutor({
        handlers: new Map([["create-note", handlerWithUndo]]),
      });

      const plan = createTestPlan({ status: "approved", approvedAt: Date.now() });
      const result = await executor.execute(plan);

      expect(result.steps[0].undoAction).toEqual({ type: "delete", path: "test.md" });
    });
  });

  describe("rollback", () => {
    it("should rollback completed steps in reverse order", async () => {
      const undoMock = vi.fn().mockResolvedValue({ success: true });
      const handlerWithUndo: StepHandler = {
        canHandle: () => true,
        execute: vi.fn().mockResolvedValue({
          success: true,
          undoAction: { type: "delete", path: "test.md" },
        }),
        undo: undoMock,
      };
      executor = new TaskExecutor({
        handlers: new Map([["create-note", handlerWithUndo]]),
      });

      const steps = [
        createTestStep({ id: "step-1", status: "completed", undoAction: { type: "delete", path: "a.md" } }),
        createTestStep({ id: "step-2", status: "completed", undoAction: { type: "delete", path: "b.md" } }),
        createTestStep({ id: "step-3", status: "completed", undoAction: { type: "delete", path: "c.md" } }),
      ];
      const plan = createTestPlan({
        status: "completed",
        steps,
      });

      await executor.rollback(plan);

      expect(undoMock.mock.calls).toHaveLength(3);
      // Should be in reverse order
      expect(undoMock.mock.calls[0][0].path).toBe("c.md");
      expect(undoMock.mock.calls[1][0].path).toBe("b.md");
      expect(undoMock.mock.calls[2][0].path).toBe("a.md");
    });

    it("should emit rollback events", async () => {
      const handlerWithUndo: StepHandler = {
        canHandle: () => true,
        execute: vi.fn(),
        undo: vi.fn().mockResolvedValue({ success: true }),
      };
      executor = new TaskExecutor({
        handlers: new Map([["create-note", handlerWithUndo]]),
      });
      events = [];
      executor.on((event: TaskEvent) => events.push(event));

      const plan = createTestPlan({
        status: "completed",
        steps: [createTestStep({ status: "completed", undoAction: { type: "delete", path: "test.md" } })],
      });

      await executor.rollback(plan);

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain("rollback-started");
      expect(eventTypes).toContain("rollback-completed");
    });

    it("should mark plan as rolled-back", async () => {
      const handlerWithUndo: StepHandler = {
        canHandle: () => true,
        execute: vi.fn(),
        undo: vi.fn().mockResolvedValue({ success: true }),
      };
      executor = new TaskExecutor({
        handlers: new Map([["create-note", handlerWithUndo]]),
      });

      const plan = createTestPlan({
        status: "completed",
        steps: [createTestStep({ status: "completed", undoAction: { type: "delete", path: "test.md" } })],
      });

      const result = await executor.rollback(plan);

      expect(result.status).toBe("rolled-back");
      expect(result.steps[0].status).toBe("rolled-back");
    });

    it("should skip steps without undo actions", async () => {
      const undoMock = vi.fn().mockResolvedValue({ success: true });
      const handlerWithUndo: StepHandler = {
        canHandle: () => true,
        execute: vi.fn(),
        undo: undoMock,
      };
      executor = new TaskExecutor({
        handlers: new Map([["create-note", handlerWithUndo]]),
      });

      const steps = [
        createTestStep({ id: "step-1", status: "completed", undoAction: { type: "delete", path: "a.md" } }),
        createTestStep({ id: "step-2", status: "completed" }), // No undo action
        createTestStep({ id: "step-3", status: "completed", undoAction: { type: "delete", path: "c.md" } }),
      ];
      const plan = createTestPlan({ status: "completed", steps });

      await executor.rollback(plan);

      expect(undoMock.mock.calls).toHaveLength(2);
    });

    it("should continue rollback even if one undo fails", async () => {
      const undoMock = vi.fn()
        .mockResolvedValueOnce({ success: false, error: "Failed" })
        .mockResolvedValueOnce({ success: true });
      const handlerWithUndo: StepHandler = {
        canHandle: () => true,
        execute: vi.fn(),
        undo: undoMock,
      };
      executor = new TaskExecutor({
        handlers: new Map([["create-note", handlerWithUndo]]),
      });

      const steps = [
        createTestStep({ id: "step-1", status: "completed", undoAction: { type: "delete", path: "a.md" } }),
        createTestStep({ id: "step-2", status: "completed", undoAction: { type: "delete", path: "b.md" } }),
      ];
      const plan = createTestPlan({ status: "completed", steps });

      const result = await executor.rollback(plan);

      // Should still attempt both
      expect(undoMock.mock.calls).toHaveLength(2);
      // Overall status should indicate partial failure
      expect(result.error).toContain("partial");
    });
  });

  describe("cancel", () => {
    it("should mark running plan as cancelled", () => {
      const plan = createTestPlan({ status: "running" });
      const result = executor.cancel(plan);

      expect(result.status).toBe("cancelled");
    });

    it("should emit task-cancelled event", () => {
      events = [];
      executor.on((event: TaskEvent) => events.push(event));

      const plan = createTestPlan({ status: "running" });
      executor.cancel(plan);

      expect(events.some((e) => e.type === "task-cancelled")).toBe(true);
    });
  });

  describe("event handling", () => {
    it("should support multiple listeners", () => {
      const listener1: TaskEvent[] = [];
      const listener2: TaskEvent[] = [];

      executor.on((e: TaskEvent) => listener1.push(e));
      executor.on((e: TaskEvent) => listener2.push(e));

      const plan = createTestPlan();
      executor.approve(plan);

      expect(listener1).toHaveLength(1);
      expect(listener2).toHaveLength(1);
    });

    it("should support removing listeners", () => {
      const listener: TaskEvent[] = [];
      const handler = (e: TaskEvent): number => listener.push(e);

      executor.on(handler);
      executor.off(handler);

      const plan = createTestPlan();
      executor.approve(plan);

      expect(listener).toHaveLength(0);
    });
  });
});
