/**
 * Tasks Module Barrel Export
 *
 * Provides task automation capabilities for multi-step operations.
 * See ADR-003 for architecture details.
 */

// Types
export type {
  TaskPlan,
  TaskStep,
  TaskStepType,
  TaskPlanStatus,
  TaskStepStatus,
  TaskStepResult,
  TaskStepParams,
  TaskExecutorConfig,
  TaskEvent,
  TaskEventType,
  TaskEventListener,
  TaskPlanValidation,
  UndoAction,
  CreateNoteParams,
  ModifyNoteParams,
  DeleteNoteParams,
  AddLinkParams,
  AddTagParams,
  MoveNoteParams,
} from "./types";

// Constants and utilities
export {
  DEFAULT_EXECUTOR_CONFIG,
  generateTaskId,
  generateStepId,
  createTaskPlan,
} from "./types";

// Parser
export {
  parseTaskPlan,
  extractTaskPlanXml,
  validateTaskPlan,
  sanitizePath,
  ParseError,
} from "./TaskPlanParser";

// Executor
export { TaskExecutor, type TaskExecutorOptions } from "./TaskExecutor";

// Handlers
export {
  BaseStepHandler,
  CreateNoteHandler,
  ModifyNoteHandler,
  AddLinkHandler,
  AddTagHandler,
} from "./handlers";
export type { StepHandler, StepHandlerResult, UndoResult } from "./handlers";
