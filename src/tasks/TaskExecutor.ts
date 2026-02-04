/**
 * Task Executor
 *
 * Orchestrates the execution of task plans with step-by-step progress
 * and rollback capabilities.
 */

import type {
  TaskPlan,
  TaskEvent,
  TaskEventType,
  TaskEventListener,
  TaskExecutorConfig,
  TaskStepType,
} from "./types";
import { DEFAULT_EXECUTOR_CONFIG } from "./types";
import type { StepHandler } from "./handlers/BaseStepHandler";

/**
 * Options for creating a TaskExecutor
 */
export interface TaskExecutorOptions {
  /** Map of step type to handler */
  handlers: Map<TaskStepType, StepHandler>;
  /** Optional configuration overrides */
  config?: Partial<TaskExecutorConfig>;
}

/**
 * Task Executor
 *
 * Manages the lifecycle of task plans:
 * 1. Approve - User approves the plan
 * 2. Execute - Steps run sequentially
 * 3. Rollback - Undo completed steps if needed
 */
export class TaskExecutor {
  private handlers: Map<TaskStepType, StepHandler>;
  private config: TaskExecutorConfig;
  private listeners: Set<TaskEventListener> = new Set();

  public constructor(options: TaskExecutorOptions) {
    this.handlers = options.handlers;
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...options.config };
  }

  /**
   * Register an event listener
   */
  public on(listener: TaskEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove an event listener
   */
  public off(listener: TaskEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(type: TaskEventType, planId: string, extra?: Partial<TaskEvent>): void {
    const event: TaskEvent = {
      type,
      planId,
      timestamp: Date.now(),
      ...extra,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Approve a task plan for execution
   *
   * @param plan - The plan to approve
   * @returns Updated plan with approved status
   * @throws Error if plan is not in pending state
   */
  public approve(plan: TaskPlan): TaskPlan {
    if (plan.status !== "pending") {
      throw new Error(`Cannot approve plan in '${plan.status}' state. Plan must be pending.`);
    }

    const approved: TaskPlan = {
      ...plan,
      status: "approved",
      approvedAt: Date.now(),
    };

    this.emit("plan-approved", plan.id);

    return approved;
  }

  /**
   * Execute an approved task plan
   *
   * @param plan - The approved plan to execute
   * @returns Updated plan with execution results
   * @throws Error if plan is not approved
   */
  public async execute(plan: TaskPlan): Promise<TaskPlan> {
    if (plan.status !== "approved") {
      throw new Error(`Cannot execute plan in '${plan.status}' state. Plan must be approved.`);
    }

    // Clone the plan for mutation
    const executingPlan: TaskPlan = {
      ...plan,
      status: "running",
      startedAt: Date.now(),
      steps: plan.steps.map((s) => ({ ...s })),
    };

    this.emit("execution-started", plan.id);

    let failed = false;
    let failedStepIndex = -1;

    for (let i = 0; i < executingPlan.steps.length; i++) {
      const step = executingPlan.steps[i];
      executingPlan.currentStepIndex = i;

      if (failed) {
        // Skip remaining steps
        step.status = "skipped";
        continue;
      }

      // Get handler for step type
      const handler = this.handlers.get(step.type);
      if (!handler) {
        throw new Error(`No handler registered for step type: ${step.type}`);
      }

      // Mark step as running
      step.status = "running";
      this.emit("step-started", plan.id, { stepId: step.id, stepIndex: i });

      try {
        // Execute the step
        const result = await handler.execute(step);

        if (result.success) {
          step.status = "completed";
          step.result = {
            success: true,
            path: result.path,
            backupPath: result.backupPath,
            metadata: result.metadata,
          };
          if (result.undoAction) {
            step.undoAction = result.undoAction;
          }

          this.emit("step-completed", plan.id, { stepId: step.id, stepIndex: i });
        } else {
          step.status = "failed";
          step.result = {
            success: false,
            error: result.error,
          };
          failed = true;
          failedStepIndex = i;

          this.emit("step-failed", plan.id, {
            stepId: step.id,
            stepIndex: i,
            error: result.error,
          });
        }
      } catch (error) {
        step.status = "failed";
        step.result = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
        failed = true;
        failedStepIndex = i;

        this.emit("step-failed", plan.id, {
          stepId: step.id,
          stepIndex: i,
          error: step.result.error,
        });
      }
    }

    // Update final status
    if (failed) {
      executingPlan.status = "failed";
      executingPlan.error = `Step ${failedStepIndex + 1} failed: ${executingPlan.steps[failedStepIndex].result?.error}`;
      this.emit("execution-failed", plan.id, { error: executingPlan.error });

      // Auto-rollback if configured
      if (this.config.autoRollback && failedStepIndex > 0) {
        return this.rollback(executingPlan);
      }
    } else {
      executingPlan.status = "completed";
      executingPlan.completedAt = Date.now();
      this.emit("execution-completed", plan.id);
    }

    return executingPlan;
  }

  /**
   * Rollback a completed or failed plan
   *
   * @param plan - The plan to rollback
   * @returns Updated plan with rollback status
   */
  public async rollback(plan: TaskPlan): Promise<TaskPlan> {
    const rollingBackPlan: TaskPlan = {
      ...plan,
      steps: plan.steps.map((s) => ({ ...s })),
    };

    this.emit("rollback-started", plan.id);

    // Get completed steps with undo actions, in reverse order
    const stepsToUndo = rollingBackPlan.steps
      .filter((s) => s.status === "completed" && s.undoAction)
      .reverse();

    const errors: string[] = [];

    for (const step of stepsToUndo) {
      const handler = this.handlers.get(step.type);
      if (!handler || !step.undoAction) {
        continue;
      }

      try {
        const result = await handler.undo(step.undoAction);
        if (result.success) {
          step.status = "rolled-back";
        } else {
          errors.push(`Failed to undo step '${step.description}': ${result.error}`);
        }
      } catch (error) {
        errors.push(
          `Error undoing step '${step.description}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    rollingBackPlan.status = "rolled-back";

    if (errors.length > 0) {
      rollingBackPlan.error = `Rollback completed with partial failures: ${errors.join("; ")}`;
      this.emit("rollback-failed", plan.id, { error: rollingBackPlan.error });
    } else {
      this.emit("rollback-completed", plan.id);
    }

    return rollingBackPlan;
  }

  /**
   * Cancel a running or pending plan
   *
   * @param plan - The plan to cancel
   * @returns Updated plan with cancelled status
   */
  public cancel(plan: TaskPlan): TaskPlan {
    const cancelledPlan: TaskPlan = {
      ...plan,
      status: "cancelled",
    };

    this.emit("task-cancelled", plan.id);

    return cancelledPlan;
  }
}
