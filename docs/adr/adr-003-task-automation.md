# ADR-003: Task Automation Architecture

**Status:** Proposed  
**Date:** 2026-02-04  
**Author:** @architect

## Context

Sprint 8 introduces "Agentic Foundations" - enabling the AI to perform multi-step tasks autonomously. This is a significant capability expansion from single-edit operations (Sprint 4-5) to chained, goal-oriented workflows.

Current state:
- Single file edits with confirmation modal
- Manual "Apply Edit" button per suggestion
- No persistent task state

Desired state:
- AI can execute multi-step plans
- User approves plan once, execution is automated
- Progress tracking and rollback capability

## Decision

### 1. Task Definition Model

Tasks are defined as **executable plans** with discrete steps:

```typescript
interface TaskPlan {
  id: string;
  name: string;
  description: string;
  steps: TaskStep[];
  status: "pending" | "approved" | "running" | "completed" | "failed" | "cancelled";
  createdAt: number;
  approvedAt?: number;
  completedAt?: number;
}

interface TaskStep {
  id: string;
  type: TaskStepType;
  params: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: TaskStepResult;
  error?: string;
}

type TaskStepType = 
  | "create-note"      // Create new file
  | "modify-note"      // Edit existing file
  | "delete-note"      // Delete file (with backup)
  | "add-link"         // Add wikilink to file
  | "add-tag"          // Add tag to frontmatter
  | "move-note"        // Rename/move file
  | "batch-edit";      // Apply same edit to multiple files
```

### 2. Execution Model

**Plan-Approve-Execute (PAE) Pattern:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PLAN      │────▶│   APPROVE   │────▶│   EXECUTE   │
│  AI creates │     │ User reviews│     │  Automated  │
│  task plan  │     │  full plan  │     │  with logs  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   ROLLBACK  │
                    │  If needed  │
                    └─────────────┘
```

Key principles:
- **Single approval point**: User approves the entire plan, not each step
- **Atomic rollback**: All steps can be reverted as a unit
- **Progress visibility**: Real-time step-by-step progress
- **Fail-fast**: Stop execution on first error (unless configured otherwise)

### 3. Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ChatView                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  TaskPlanView (shows plan preview, approve button)  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      TaskExecutor                            │
│  - Parses AI response for task plans                        │
│  - Manages plan lifecycle                                    │
│  - Emits progress events                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      StepHandlers                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │CreateHandler │ │ModifyHandler │ │ LinkHandler  │ ...    │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SafeVaultAccess                           │
│  - All vault operations go through consent layer            │
│  - Automatic backup before modifications                     │
│  - Audit logging                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Task Plan Format (AI Response)

The AI will emit task plans in a structured format:

```markdown
<task-plan name="Organize meeting notes">
  <step type="create-note" path="meetings/2026-02-04.md">
    Create meeting note with template
  </step>
  <step type="add-link" path="projects/alpha.md" target="meetings/2026-02-04.md">
    Link from project page
  </step>
  <step type="add-tag" path="meetings/2026-02-04.md" tag="meeting">
    Add meeting tag
  </step>
</task-plan>
```

### 5. Rollback Strategy

Each step records its "undo" action:

| Step Type | Undo Action |
|-----------|-------------|
| create-note | Delete file (already backed up) |
| modify-note | Restore from backup |
| delete-note | Restore from backup |
| add-link | Remove link |
| add-tag | Remove tag |
| move-note | Move back to original path |

Rollback executes undo actions in reverse order.

### 6. File Structure

```
src/
├── tasks/
│   ├── index.ts              # Barrel export
│   ├── types.ts              # TaskPlan, TaskStep interfaces
│   ├── TaskExecutor.ts       # Main executor class
│   ├── TaskPlanParser.ts     # Parse AI response to TaskPlan
│   ├── TaskProgressEmitter.ts # Event emitter for UI updates
│   └── handlers/
│       ├── BaseStepHandler.ts
│       ├── CreateNoteHandler.ts
│       ├── ModifyNoteHandler.ts
│       ├── AddLinkHandler.ts
│       ├── AddTagHandler.ts
│       └── MoveNoteHandler.ts
└── views/
    └── TaskPlanView.ts       # UI component for plan preview
```

## Consequences

### Positive
- Clear separation of planning and execution
- Single approval point reduces friction for multi-step tasks
- Atomic rollback provides safety net
- Extensible handler architecture for new step types

### Negative
- More complex than single-edit model
- AI must generate well-formed task plans
- Rollback may not be perfect (e.g., external sync conflicts)

### Risks
- **R1**: AI generates invalid/unsafe plans → Mitigated by validation layer
- **R2**: Long-running tasks block UI → Mitigated by async execution with progress
- **R3**: Partial failures leave vault in inconsistent state → Mitigated by atomic rollback

## Alternatives Considered

### A. Step-by-step approval
- User approves each step individually
- **Rejected**: Too much friction for multi-step tasks

### B. YAML-based task definitions
- Tasks defined in YAML files in vault
- **Rejected**: Over-engineering for v1; can add later as power-user feature

### C. Undo stack (vs explicit rollback)
- Track all changes in global undo stack
- **Rejected**: Harder to reason about task boundaries

## Implementation Plan

1. **Phase 1**: Core types and TaskExecutor (Sprint 8, Week 1)
2. **Phase 2**: Step handlers for create/modify (Sprint 8, Week 1)
3. **Phase 3**: TaskPlanView UI integration (Sprint 8, Week 2)
4. **Phase 4**: Rollback implementation (Sprint 8, Week 2)
5. **Phase 5**: Link/tag handlers (Sprint 9 or later)

## References

- [ADR-001: Provider Architecture](adr-001-provider-architecture.md)
- [Threat Model](../threat-model.md)
- [Sprint Plan](../../.github/work/sprint-plan.md)
