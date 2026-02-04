# Test Strategy: Sprint 8 - Agentic Features

**Date:** 2026-02-04  
**Author:** @tester  
**Sprint:** 8 - Agentic Foundations (Phase 2.0)

## 1. Overview

Sprint 8 introduces multi-step task automation, significantly increasing complexity compared to single-edit operations. This strategy ensures comprehensive test coverage while maintaining the high branch coverage (85%) established in previous sprints.

### Risk Assessment

| Component | Risk Level | Rationale |
|-----------|------------|-----------|
| TaskExecutor | **High** | Core orchestration, failure here affects all tasks |
| TaskPlanParser | **High** | Malformed AI output could cause crashes/security issues |
| Step Handlers | **Medium** | Each handler isolated, but vault modifications are risky |
| Rollback | **High** | Must work perfectly or data loss possible |
| TaskPlanView | **Low** | UI component, visual testing sufficient |

## 2. Test Types by Component

### 2.1 TaskPlanParser (High Priority)

**Unit Tests** - Pure function, easy to test:

```typescript
describe("TaskPlanParser", () => {
  describe("parse", () => {
    it("should parse valid task-plan XML");
    it("should handle multiple steps");
    it("should reject malformed XML");
    it("should sanitize file paths (no traversal)");
    it("should reject unknown step types");
    it("should handle empty task plan");
    it("should handle missing required attributes");
    it("should escape HTML in step descriptions");
  });
});
```

**Coverage Target:** 100% statements, 100% branches

### 2.2 TaskExecutor (High Priority)

**Unit Tests** - Mock step handlers:

```typescript
describe("TaskExecutor", () => {
  describe("execute", () => {
    it("should execute steps in order");
    it("should stop on first failure");
    it("should emit progress events");
    it("should mark plan as completed on success");
    it("should mark plan as failed on error");
    it("should not execute unapproved plans");
  });

  describe("rollback", () => {
    it("should execute undo actions in reverse order");
    it("should handle partial rollback on rollback failure");
    it("should emit rollback progress events");
  });

  describe("cancel", () => {
    it("should stop execution mid-task");
    it("should rollback completed steps");
  });
});
```

**Coverage Target:** 95% statements, 90% branches

### 2.3 Step Handlers (Medium Priority)

**Unit Tests** - Each handler tested in isolation:

```typescript
describe("CreateNoteHandler", () => {
  it("should create file via SafeVaultAccess");
  it("should fail if file already exists");
  it("should respect consent settings");
  it("should return undo action (delete)");
});

describe("ModifyNoteHandler", () => {
  it("should modify file via SafeVaultAccess");
  it("should fail if file does not exist");
  it("should create backup before modify");
  it("should return undo action (restore)");
});

describe("AddLinkHandler", () => {
  it("should add wikilink to file content");
  it("should not duplicate existing link");
  it("should handle various link formats");
  it("should return undo action (remove link)");
});
```

**Coverage Target:** 90% statements, 85% branches per handler

### 2.4 Integration Tests (High Priority)

**End-to-end task execution** - Using mock vault:

```typescript
describe("Task Execution E2E", () => {
  it("should execute multi-step create + link task");
  it("should rollback all steps on failure");
  it("should respect consent for all operations");
  it("should handle concurrent task attempts");
  it("should persist task state across reload");
});
```

**Location:** `src/integration/TaskFlow.test.ts`

### 2.5 TaskPlanView (Low Priority)

**Snapshot/Visual Tests** - If time permits:

- Plan preview renders correctly
- Progress indicators update
- Error states display properly

**Note:** May defer to manual testing given UI complexity

## 3. Security-Focused Tests

Given the elevated risk of multi-step automation:

```typescript
describe("Task Security", () => {
  // Path traversal
  it("should reject paths with ../");
  it("should reject absolute paths outside vault");
  
  // Consent
  it("should check consent for each step, not just plan");
  it("should fail entire task if any step violates consent");
  
  // Resource limits
  it("should limit maximum steps per task");
  it("should limit maximum file size for create/modify");
  it("should timeout long-running tasks");
  
  // Injection
  it("should sanitize step descriptions in UI");
  it("should not execute code in step params");
});
```

## 4. Test Data

### Mock Task Plans

Create `src/tasks/__fixtures__/` with:

```
task-plans/
├── valid-single-step.xml
├── valid-multi-step.xml
├── malformed-xml.xml
├── path-traversal-attempt.xml
├── unknown-step-type.xml
└── oversized-plan.xml
```

### Mock Vault State

Reuse existing mock vault from `src/__mocks__/obsidian.ts`, extended with:
- Pre-existing files for modify tests
- Folder structure for path tests

## 5. Coverage Targets

| Module | Statements | Branches | Functions |
|--------|------------|----------|-----------|
| tasks/types.ts | 100% | 100% | 100% |
| tasks/TaskPlanParser.ts | 100% | 100% | 100% |
| tasks/TaskExecutor.ts | 95% | 90% | 95% |
| tasks/handlers/* | 90% | 85% | 90% |
| **Overall Sprint 8** | **70%** | **85%** | **75%** |

**Note:** 70% statement coverage is beta-ready target per sprint plan.

## 6. Test Execution Plan

### Phase 1: Foundation (Week 1)

- [ ] TaskPlanParser unit tests (before implementation - TDD)
- [ ] TaskExecutor unit tests
- [ ] CreateNoteHandler tests
- [ ] ModifyNoteHandler tests

### Phase 2: Integration (Week 2)

- [ ] TaskFlow E2E tests
- [ ] Security-focused tests
- [ ] AddLinkHandler tests
- [ ] Rollback tests

### Phase 3: Polish

- [ ] Edge case coverage
- [ ] Performance tests (large task plans)
- [ ] Manual exploratory testing

## 7. Test Utilities

New test helpers to add:

```typescript
// src/tasks/__test-utils__/index.ts

export function createMockTaskPlan(overrides?: Partial<TaskPlan>): TaskPlan;
export function createMockStep(type: TaskStepType, overrides?: Partial<TaskStep>): TaskStep;
export function createMockExecutor(handlers?: Map<TaskStepType, StepHandler>): TaskExecutor;
```

## 8. Definition of Done

Sprint 8 tests are complete when:

- [ ] All unit tests pass (green CI)
- [ ] Coverage targets met (70% stmt, 85% branch)
- [ ] Security tests implemented and passing
- [ ] E2E test for happy path + rollback
- [ ] No lint errors
- [ ] Test strategy reviewed and approved

## References

- [ADR-003: Task Automation Architecture](../adr/adr-003-task-automation.md)
- [Sprint 6 Retro: Coverage Philosophy](../../.github/work/retros/2025-02-04-sprint-6.md)
