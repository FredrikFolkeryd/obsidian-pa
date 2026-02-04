/**
 * Task Automation Types
 *
 * Core type definitions for multi-step task execution.
 * See ADR-003 for architecture details.
 */

/**
 * Supported task step types
 */
export type TaskStepType =
  | "create-note" // Create new file
  | "modify-note" // Edit existing file
  | "delete-note" // Delete file (with backup)
  | "add-link" // Add wikilink to file
  | "add-tag" // Add tag to frontmatter
  | "move-note"; // Rename/move file

/**
 * Status of a task plan
 */
export type TaskPlanStatus =
  | "pending" // Awaiting user approval
  | "approved" // User approved, ready to execute
  | "running" // Currently executing
  | "completed" // All steps completed successfully
  | "failed" // Execution failed
  | "cancelled" // User cancelled
  | "rolled-back"; // Rolled back after failure or cancellation

/**
 * Status of an individual step
 */
export type TaskStepStatus =
  | "pending" // Not yet executed
  | "running" // Currently executing
  | "completed" // Completed successfully
  | "failed" // Failed to execute
  | "skipped" // Skipped (e.g., due to earlier failure)
  | "rolled-back"; // Undone during rollback

/**
 * Result of executing a step
 */
export interface TaskStepResult {
  /** Whether the step succeeded */
  success: boolean;
  /** Path of the affected file */
  path?: string;
  /** Error message if failed */
  error?: string;
  /** Backup path if file was modified */
  backupPath?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Undo action for rollback
 */
export interface UndoAction {
  /** Type of undo operation */
  type: "delete" | "restore" | "remove-link" | "remove-tag" | "move-back";
  /** Target file path */
  path: string;
  /** Additional parameters for undo */
  params?: Record<string, unknown>;
}

/**
 * Parameters for create-note step
 */
export interface CreateNoteParams {
  /** Path for the new note */
  path: string;
  /** Content of the new note */
  content: string;
  /** Optional template to use */
  template?: string;
}

/**
 * Parameters for modify-note step
 */
export interface ModifyNoteParams {
  /** Path to the note to modify */
  path: string;
  /** New content (full replacement) */
  content?: string;
  /** Search string for partial replacement */
  search?: string;
  /** Replace string for partial replacement */
  replace?: string;
  /** Append content to end */
  append?: string;
  /** Prepend content to beginning */
  prepend?: string;
}

/**
 * Parameters for delete-note step
 */
export interface DeleteNoteParams {
  /** Path to the note to delete */
  path: string;
}

/**
 * Parameters for add-link step
 */
export interface AddLinkParams {
  /** Path to the note to add link to */
  path: string;
  /** Target of the wikilink */
  target: string;
  /** Optional display text */
  displayText?: string;
  /** Where to add the link: 'append', 'prepend', or 'section' */
  position?: "append" | "prepend" | "section";
  /** Section heading if position is 'section' */
  section?: string;
}

/**
 * Parameters for add-tag step
 */
export interface AddTagParams {
  /** Path to the note to add tag to */
  path: string;
  /** Tag to add (without #) */
  tag: string;
}

/**
 * Parameters for move-note step
 */
export interface MoveNoteParams {
  /** Current path of the note */
  path: string;
  /** New path for the note */
  newPath: string;
  /** Whether to update links to this note */
  updateLinks?: boolean;
}

/**
 * Union of all step parameter types
 */
export type TaskStepParams =
  | CreateNoteParams
  | ModifyNoteParams
  | DeleteNoteParams
  | AddLinkParams
  | AddTagParams
  | MoveNoteParams;

/**
 * A single step in a task plan
 */
export interface TaskStep {
  /** Unique identifier for this step */
  id: string;
  /** Type of operation */
  type: TaskStepType;
  /** Human-readable description */
  description: string;
  /** Parameters for the operation */
  params: TaskStepParams;
  /** Current status */
  status: TaskStepStatus;
  /** Result after execution */
  result?: TaskStepResult;
  /** Undo action for rollback */
  undoAction?: UndoAction;
}

/**
 * A complete task plan
 */
export interface TaskPlan {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the task does */
  description: string;
  /** Ordered list of steps */
  steps: TaskStep[];
  /** Current status */
  status: TaskPlanStatus;
  /** Timestamp when plan was created */
  createdAt: number;
  /** Timestamp when user approved */
  approvedAt?: number;
  /** Timestamp when execution started */
  startedAt?: number;
  /** Timestamp when execution completed */
  completedAt?: number;
  /** Index of currently executing step */
  currentStepIndex?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Configuration for task execution
 */
export interface TaskExecutorConfig {
  /** Maximum number of steps allowed per task */
  maxSteps: number;
  /** Maximum content size in bytes per file */
  maxContentSize: number;
  /** Timeout for entire task in milliseconds */
  taskTimeout: number;
  /** Timeout for individual step in milliseconds */
  stepTimeout: number;
  /** Whether to continue on step failure */
  continueOnError: boolean;
  /** Whether to auto-rollback on failure */
  autoRollback: boolean;
}

/**
 * Default executor configuration
 */
export const DEFAULT_EXECUTOR_CONFIG: TaskExecutorConfig = {
  maxSteps: 20,
  maxContentSize: 100 * 1024, // 100KB
  taskTimeout: 60 * 1000, // 1 minute
  stepTimeout: 10 * 1000, // 10 seconds
  continueOnError: false,
  autoRollback: true,
};

/**
 * Events emitted during task execution
 */
export type TaskEventType =
  | "plan-approved"
  | "execution-started"
  | "step-started"
  | "step-completed"
  | "step-failed"
  | "execution-completed"
  | "execution-failed"
  | "rollback-started"
  | "rollback-completed"
  | "rollback-failed"
  | "task-cancelled";

/**
 * Event payload for task events
 */
export interface TaskEvent {
  /** Type of event */
  type: TaskEventType;
  /** Task plan ID */
  planId: string;
  /** Timestamp */
  timestamp: number;
  /** Step ID if applicable */
  stepId?: string;
  /** Step index if applicable */
  stepIndex?: number;
  /** Error if applicable */
  error?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Listener for task events
 */
export type TaskEventListener = (event: TaskEvent) => void;

/**
 * Validation result for task plans
 */
export interface TaskPlanValidation {
  /** Whether the plan is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Generate a unique ID for tasks/steps
 */
export function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique ID for steps
 */
export function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new task plan with default values
 */
export function createTaskPlan(
  name: string,
  description: string,
  steps: Omit<TaskStep, "id" | "status">[]
): TaskPlan {
  return {
    id: generateTaskId(),
    name,
    description,
    steps: steps.map((step) => ({
      ...step,
      id: generateStepId(),
      status: "pending" as TaskStepStatus,
    })),
    status: "pending",
    createdAt: Date.now(),
  };
}
