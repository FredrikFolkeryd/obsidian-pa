/**
 * Tasks Module Barrel Export
 *
 * Provides task automation capabilities for multi-step operations.
 * See ADR-003 for architecture details.
 */

import type { App } from "obsidian";
import type { SafeVaultAccess } from "../vault/SafeVaultAccess";
import type { VaultBackup } from "../vault/VaultBackup";
import type { TaskStepType } from "./types";
import { TaskExecutor } from "./TaskExecutor";
import type { StepHandler } from "./handlers/BaseStepHandler";
import { CreateNoteHandler } from "./handlers/CreateNoteHandler";
import { ModifyNoteHandler } from "./handlers/ModifyNoteHandler";
import { DeleteNoteHandler } from "./handlers/DeleteNoteHandler";
import { MoveNoteHandler } from "./handlers/MoveNoteHandler";
import { AddLinkHandler } from "./handlers/AddLinkHandler";
import { AddTagHandler } from "./handlers/AddTagHandler";

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

// History
export {
  TaskHistoryManager,
  formatHistoryEntry,
  getHistoryStats,
  type TaskHistoryEntry,
  type TaskHistoryData,
  type TaskHistoryConfig,
} from "./TaskHistoryManager";

// Handlers (for direct use if needed)
export { CreateNoteHandler } from "./handlers/CreateNoteHandler";
export { ModifyNoteHandler } from "./handlers/ModifyNoteHandler";
export { DeleteNoteHandler } from "./handlers/DeleteNoteHandler";
export { MoveNoteHandler } from "./handlers/MoveNoteHandler";
export { AddLinkHandler } from "./handlers/AddLinkHandler";
export { AddTagHandler } from "./handlers/AddTagHandler";
export type { StepHandler, StepHandlerResult, UndoResult } from "./handlers/BaseStepHandler";

/**
 * Create a fully configured TaskExecutor with all handlers wired up
 *
 * @param app - Obsidian App instance
 * @param vault - SafeVaultAccess for consent-checked operations
 * @param backup - VaultBackup for backup/restore operations
 * @returns Configured TaskExecutor
 */
export function createTaskExecutor(
  app: App,
  vault: SafeVaultAccess,
  backup: VaultBackup
): TaskExecutor {
  const handlers = new Map<TaskStepType, StepHandler>();

  handlers.set("create-note", new CreateNoteHandler(app, vault));
  handlers.set("modify-note", new ModifyNoteHandler(app, vault, backup));
  handlers.set("delete-note", new DeleteNoteHandler(app, vault, backup));
  handlers.set("move-note", new MoveNoteHandler(app, vault));
  handlers.set("add-link", new AddLinkHandler(app, vault, backup));
  handlers.set("add-tag", new AddTagHandler(app, vault, backup));

  return new TaskExecutor({ handlers });
}
