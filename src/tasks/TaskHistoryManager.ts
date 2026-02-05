/**
 * Task History Manager
 *
 * Manages persistent history of executed task plans.
 * Enables undo/rollback of past operations and provides
 * visibility into what changes have been made to the vault.
 */

import type { TaskPlan } from "../tasks/types";

/**
 * History entry for an executed task plan
 */
export interface TaskHistoryEntry {
  /** Unique identifier for this history entry */
  id: string;
  /** The executed task plan */
  plan: TaskPlan;
  /** When the plan was executed */
  executedAt: number;
  /** Final status after execution */
  status: "completed" | "failed" | "rolled-back";
  /** Error message if failed */
  error?: string;
  /** Whether this entry can be rolled back */
  canRollback: boolean;
}

/**
 * Serializable history data for storage
 */
export interface TaskHistoryData {
  version: number;
  entries: TaskHistoryEntry[];
}

/**
 * Configuration for history manager
 */
export interface TaskHistoryConfig {
  /** Maximum number of entries to keep */
  maxEntries: number;
  /** Maximum age of entries in days */
  maxAgeDays: number;
}

const DEFAULT_CONFIG: TaskHistoryConfig = {
  maxEntries: 100,
  maxAgeDays: 30,
};

const CURRENT_VERSION = 1;

/**
 * Manages task execution history with persistence
 */
export class TaskHistoryManager {
  private entries: TaskHistoryEntry[] = [];
  private config: TaskHistoryConfig;
  private dirty = false;

  public constructor(config: Partial<TaskHistoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Load history from serialized data
   */
  public load(data: TaskHistoryData | null): void {
    if (!data || typeof data !== "object") {
      this.entries = [];
      return;
    }

    if (data.version !== CURRENT_VERSION) {
      // Handle migration if needed in the future
      console.warn(`[TaskHistory] Unknown version ${data.version}, starting fresh`);
      this.entries = [];
      return;
    }

    this.entries = Array.isArray(data.entries) ? data.entries : [];
    this.prune();
  }

  /**
   * Export history for persistence
   */
  public export(): TaskHistoryData {
    return {
      version: CURRENT_VERSION,
      entries: this.entries,
    };
  }

  /**
   * Check if there are unsaved changes
   */
  public isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Mark as saved
   */
  public markClean(): void {
    this.dirty = false;
  }

  /**
   * Add a completed task plan to history
   */
  public addEntry(
    plan: TaskPlan,
    status: "completed" | "failed" | "rolled-back",
    error?: string
  ): TaskHistoryEntry {
    const entry: TaskHistoryEntry = {
      id: this.generateId(),
      plan,
      executedAt: Date.now(),
      status,
      error,
      canRollback: status === "completed" && this.hasRollbackCapability(plan),
    };

    this.entries.unshift(entry); // Add to front (most recent first)
    this.prune();
    this.dirty = true;

    return entry;
  }

  /**
   * Mark an entry as rolled back
   */
  public markRolledBack(entryId: string): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) {
      return false;
    }

    entry.status = "rolled-back";
    entry.canRollback = false;
    this.dirty = true;
    return true;
  }

  /**
   * Get all history entries
   */
  public getEntries(): TaskHistoryEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by status
   */
  public getEntriesByStatus(
    status: "completed" | "failed" | "rolled-back"
  ): TaskHistoryEntry[] {
    return this.entries.filter((e) => e.status === status);
  }

  /**
   * Get entries within a date range
   */
  public getEntriesByDateRange(startMs: number, endMs: number): TaskHistoryEntry[] {
    return this.entries.filter(
      (e) => e.executedAt >= startMs && e.executedAt <= endMs
    );
  }

  /**
   * Get entries that affected a specific file
   */
  public getEntriesForFile(filePath: string): TaskHistoryEntry[] {
    return this.entries.filter((entry) => {
      return entry.plan.steps.some((step) => {
        const params = step.params as unknown as Record<string, unknown>;
        return params.path === filePath || params.newPath === filePath;
      });
    });
  }

  /**
   * Get a specific entry by ID
   */
  public getEntry(entryId: string): TaskHistoryEntry | null {
    return this.entries.find((e) => e.id === entryId) ?? null;
  }

  /**
   * Get entries that can be rolled back
   */
  public getRollbackableEntries(): TaskHistoryEntry[] {
    return this.entries.filter((e) => e.canRollback);
  }

  /**
   * Get count of entries
   */
  public getCount(): number {
    return this.entries.length;
  }

  /**
   * Clear all history
   */
  public clear(): void {
    this.entries = [];
    this.dirty = true;
  }

  /**
   * Remove old entries based on config
   */
  private prune(): void {
    const now = Date.now();
    const maxAge = this.config.maxAgeDays * 24 * 60 * 60 * 1000;

    // Remove entries older than maxAge
    this.entries = this.entries.filter((e) => now - e.executedAt < maxAge);

    // Keep only maxEntries
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(0, this.config.maxEntries);
    }
  }

  /**
   * Check if a plan has rollback capability
   */
  private hasRollbackCapability(plan: TaskPlan): boolean {
    // All step types currently support rollback via undo actions
    return plan.steps.length > 0;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Format a history entry for display
 */
export function formatHistoryEntry(entry: TaskHistoryEntry): string {
  const date = new Date(entry.executedAt);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const stepCount = entry.plan.steps.length;
  const statusIcon =
    entry.status === "completed"
      ? "✅"
      : entry.status === "failed"
        ? "❌"
        : "↩️";

  return `${statusIcon} ${dateStr} ${timeStr} — ${entry.plan.description} (${stepCount} step${stepCount !== 1 ? "s" : ""})`;
}

/**
 * Get summary statistics for history
 */
export function getHistoryStats(entries: TaskHistoryEntry[]): {
  total: number;
  completed: number;
  failed: number;
  rolledBack: number;
  rollbackable: number;
} {
  return {
    total: entries.length,
    completed: entries.filter((e) => e.status === "completed").length,
    failed: entries.filter((e) => e.status === "failed").length,
    rolledBack: entries.filter((e) => e.status === "rolled-back").length,
    rollbackable: entries.filter((e) => e.canRollback).length,
  };
}
