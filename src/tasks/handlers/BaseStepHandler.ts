/**
 * Base Step Handler
 *
 * Interface for handlers that execute individual task steps.
 */

import type { TaskStep, UndoAction, TaskStepType } from "../types";

/**
 * Result of executing a step handler
 */
export interface StepHandlerResult {
  /** Whether the step succeeded */
  success: boolean;
  /** Path of the affected file */
  path?: string;
  /** Error message if failed */
  error?: string;
  /** Backup path if file was modified */
  backupPath?: string;
  /** Undo action for rollback */
  undoAction?: UndoAction;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of undoing a step
 */
export interface UndoResult {
  /** Whether the undo succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Interface for step handlers
 */
export interface StepHandler {
  /**
   * Check if this handler can handle a step type
   */
  canHandle(type: TaskStepType): boolean;

  /**
   * Execute the step
   * @param step - The step to execute
   * @returns Result of the execution
   */
  execute(step: TaskStep): Promise<StepHandlerResult>;

  /**
   * Undo a previously executed step
   * @param undoAction - The undo action to perform
   * @returns Result of the undo operation
   */
  undo(undoAction: UndoAction): Promise<UndoResult>;
}

/**
 * Abstract base class for step handlers
 */
export abstract class BaseStepHandler implements StepHandler {
  protected readonly supportedTypes: TaskStepType[];

  public constructor(supportedTypes: TaskStepType[]) {
    this.supportedTypes = supportedTypes;
  }

  public canHandle(type: TaskStepType): boolean {
    return this.supportedTypes.includes(type);
  }

  public abstract execute(step: TaskStep): Promise<StepHandlerResult>;
  public abstract undo(undoAction: UndoAction): Promise<UndoResult>;
}
