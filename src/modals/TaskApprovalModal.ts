/**
 * Task Approval Modal
 *
 * Shows a task plan preview and confirmation dialog before executing.
 * Allows users to review all steps and approve or cancel.
 *
 * Features:
 * - Step list with descriptions
 * - File path display for each step
 * - Color-coded step types
 * - Statistics (total steps, affected files)
 */

import { Modal, App } from "obsidian";
import type { TaskPlan, TaskStep } from "../tasks/types";

/**
 * Result of the task approval modal
 */
export interface TaskApprovalResult {
  approved: boolean;
  plan: TaskPlan;
}

/**
 * Icons for step types (using simple text for now)
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
 * Human-readable labels for step types
 */
const STEP_LABELS: Record<string, string> = {
  "create-note": "Create Note",
  "modify-note": "Modify Note",
  "delete-note": "Delete Note",
  "move-note": "Move Note",
  "add-link": "Add Link",
  "add-tag": "Add Tag",
};

/**
 * Modal for approving AI-proposed task plans
 */
export class TaskApprovalModal extends Modal {
  private plan: TaskPlan;
  private onApprove: (result: TaskApprovalResult) => void;
  private resolved = false;

  public constructor(
    app: App,
    plan: TaskPlan,
    onApprove: (result: TaskApprovalResult) => void
  ) {
    super(app);
    this.plan = plan;
    this.onApprove = onApprove;
  }

  public onOpen(): void {
    const { contentEl, titleEl } = this;

    // Title
    titleEl.setText("Review Task Plan");

    // Container
    contentEl.addClass("pa-task-approval");

    // Task description
    if (this.plan.description) {
      const descEl = contentEl.createDiv({ cls: "pa-task-description" });
      descEl.createSpan({ text: this.plan.description });
    }

    // Statistics
    const stats = this.calculateStats();
    const statsEl = contentEl.createDiv({ cls: "pa-task-stats" });
    statsEl.createSpan({ text: `${stats.totalSteps} steps` });
    statsEl.createSpan({ text: " • " });
    statsEl.createSpan({ text: `${stats.affectedFiles} files affected` });

    // Steps list
    const stepsContainer = contentEl.createDiv({ cls: "pa-task-steps-container" });
    this.renderSteps(stepsContainer);

    // Warning notice
    const warningEl = contentEl.createDiv({ cls: "pa-task-warning" });
    warningEl.createSpan({ text: "⚠️ " });
    warningEl.createSpan({
      text: "This will modify your vault. Changes can be undone if needed.",
    });

    // Button container
    const buttonContainer = contentEl.createDiv({ cls: "pa-task-buttons" });

    // Cancel button
    const cancelBtn = buttonContainer.createEl("button", {
      text: "Cancel",
      cls: "pa-task-cancel-btn",
    });
    cancelBtn.addEventListener("click", () => {
      this.resolve(false);
    });

    // Approve button (primary)
    const approveBtn = buttonContainer.createEl("button", {
      text: "Approve & Execute",
      cls: "pa-task-approve-btn mod-cta",
    });
    approveBtn.addEventListener("click", () => {
      this.resolve(true);
    });

    // Add styles
    this.addStyles();
  }

  /**
   * Calculate statistics for the task plan
   */
  private calculateStats(): { totalSteps: number; affectedFiles: number } {
    const totalSteps = this.plan.steps.length;
    const affectedFiles = new Set<string>();

    for (const step of this.plan.steps) {
      const params = step.params as unknown as Record<string, unknown>;
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
   * Render the steps list
   */
  private renderSteps(container: HTMLElement): void {
    const listEl = container.createEl("ol", { cls: "pa-task-steps-list" });

    for (const step of this.plan.steps) {
      const stepEl = listEl.createEl("li", { cls: "pa-task-step" });
      this.renderStep(stepEl, step);
    }
  }

  /**
   * Render a single step
   */
  private renderStep(container: HTMLElement, step: TaskStep): void {
    const icon = STEP_ICONS[step.type] ?? "📋";
    const label = STEP_LABELS[step.type] ?? step.type;

    // Step type badge
    const badge = container.createSpan({ cls: `pa-task-step-badge pa-step-${step.type}` });
    badge.createSpan({ text: icon, cls: "pa-task-step-icon" });
    badge.createSpan({ text: ` ${label}` });

    // Description
    if (step.description) {
      container.createSpan({ text: `: ${step.description}`, cls: "pa-task-step-desc" });
    }

    // File path
    const params = step.params as unknown as Record<string, unknown>;
    if (params.path && typeof params.path === "string") {
      const pathEl = container.createDiv({ cls: "pa-task-step-path" });
      pathEl.createSpan({ text: "→ " });
      pathEl.createEl("code", { text: params.path });

      // For move operations, show destination
      if (step.type === "move-note" && params.destination && typeof params.destination === "string") {
        pathEl.createSpan({ text: " → " });
        pathEl.createEl("code", { text: params.destination });
      }
    }
  }

  /**
   * Resolve the modal with a result
   */
  private resolve(approved: boolean): void {
    if (this.resolved) return;
    this.resolved = true;

    this.onApprove({
      approved,
      plan: this.plan,
    });
    this.close();
  }

  public onClose(): void {
    // If closed without explicit action, treat as cancelled
    if (!this.resolved) {
      this.resolve(false);
    }
    this.contentEl.empty();
  }

  /**
   * Add modal-specific styles
   */
  private addStyles(): void {
    const styleId = "pa-task-approval-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .pa-task-approval {
        padding: 16px;
        max-width: 600px;
      }

      .pa-task-description {
        margin-bottom: 12px;
        font-size: 14px;
        color: var(--text-normal);
      }

      .pa-task-stats {
        margin-bottom: 16px;
        font-size: 13px;
        color: var(--text-muted);
      }

      .pa-task-steps-container {
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 16px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        padding: 8px;
        background: var(--background-secondary);
      }

      .pa-task-steps-list {
        margin: 0;
        padding-left: 24px;
      }

      .pa-task-step {
        margin-bottom: 12px;
        font-size: 14px;
      }

      .pa-task-step:last-child {
        margin-bottom: 0;
      }

      .pa-task-step-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        background: var(--background-modifier-hover);
      }

      .pa-step-create-note .pa-task-step-badge { color: var(--color-green); }
      .pa-step-modify-note .pa-task-step-badge { color: var(--color-orange); }
      .pa-step-delete-note .pa-task-step-badge { color: var(--color-red); }
      .pa-step-move-note .pa-task-step-badge { color: var(--color-blue); }
      .pa-step-add-link .pa-task-step-badge { color: var(--color-cyan); }
      .pa-step-add-tag .pa-task-step-badge { color: var(--color-purple); }

      .pa-task-step-icon {
        margin-right: 4px;
      }

      .pa-task-step-desc {
        color: var(--text-muted);
      }

      .pa-task-step-path {
        margin-top: 4px;
        margin-left: 8px;
        font-size: 12px;
        color: var(--text-muted);
      }

      .pa-task-step-path code {
        font-family: var(--font-monospace);
        background: var(--background-primary);
        padding: 1px 4px;
        border-radius: 3px;
      }

      .pa-task-warning {
        margin-bottom: 16px;
        padding: 8px 12px;
        background: var(--background-modifier-error-rgb);
        border-radius: 6px;
        font-size: 13px;
        color: var(--text-warning);
      }

      .pa-task-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .pa-task-cancel-btn {
        background: var(--background-modifier-hover);
      }

      .pa-task-approve-btn {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }
    `;
    document.head.appendChild(style);
  }
}
