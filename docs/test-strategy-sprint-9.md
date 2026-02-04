# Test Strategy: Sprint 9 - Chat Integration & Natural Language Tasks

**Date:** 2026-02-04  
**Author:** @tester  
**Sprint:** 9 - Chat Integration

## 1. Overview

Sprint 9 connects the task automation framework (Sprint 8) to the chat interface, enabling users to execute multi-step tasks via natural language. This requires integration testing between components while maintaining the 85%+ branch coverage target.

### Risk Assessment

| Component | Risk Level | Rationale |
|-----------|------------|-----------|
| ChatView Integration | **High** | UI-heavy, many user interaction paths |
| Natural Language Detection | **Medium** | Intent parsing could be ambiguous |
| Task History View | **Low** | Display-only, minimal logic |
| System Prompt Enhancement | **Medium** | AI behavior changes affect all responses |

## 2. Test Types by Component

### 2.1 Natural Language Task Detection (High Priority)

**Unit Tests** - Pure function parsing:

```typescript
describe("TaskIntentDetector", () => {
  describe("detectIntent", () => {
    it("should detect 'create a note about X' intent");
    it("should detect 'add a link to X' intent");
    it("should detect 'tag this note with X' intent");
    it("should detect 'move X to folder Y' intent");
    it("should detect 'delete the note X' intent");
    it("should return null for non-task messages");
    it("should handle multiple intents in one message");
    it("should extract parameters from intent (path, content, tag)");
  });
});
```

**Coverage Target:** 100% statements, 100% branches

### 2.2 Chat-Task Integration (High Priority)

**Integration Tests** - Mock AI responses:

```typescript
describe("ChatTaskIntegration", () => {
  describe("task plan rendering", () => {
    it("should show Execute Plan button when AI returns task plan");
    it("should show progress indicator during execution");
    it("should show success notification on completion");
    it("should show failure notification with rollback button");
    it("should disable Execute button during execution");
  });

  describe("execution flow", () => {
    it("should open TaskApprovalModal on Execute click");
    it("should execute plan after modal approval");
    it("should cancel execution on modal cancel");
    it("should rollback on failure confirmation");
  });
});
```

**Coverage Target:** 80% statements, 85% branches

### 2.3 Task History (Medium Priority)

**Unit Tests** - History storage and display:

```typescript
describe("TaskHistoryManager", () => {
  describe("storage", () => {
    it("should persist executed plans to data.json");
    it("should load history on plugin init");
    it("should limit history to 100 entries");
    it("should prune entries older than 30 days");
  });

  describe("queries", () => {
    it("should return plans by status (completed, failed, rolled-back)");
    it("should return plans by date range");
    it("should return plans affecting a specific file");
  });
});
```

**Coverage Target:** 95% statements, 90% branches

### 2.4 System Prompt Enhancement (Medium Priority)

**Unit Tests** - Prompt building:

```typescript
describe("TaskSystemPrompt", () => {
  it("should include task plan XML format instructions");
  it("should include available step types");
  it("should include examples for each step type");
  it("should adapt prompt based on detected intent");
  it("should not include task instructions when disabled");
});
```

**Coverage Target:** 100% statements, 100% branches

## 3. Integration Test Scenarios

### 3.1 End-to-End Task Flow

```typescript
describe("Task E2E", () => {
  it("should complete: user request → AI plan → approval → execution → vault change");
  it("should complete: failed step → rollback prompt → rollback → vault restored");
  it("should complete: task history → select plan → undo → vault restored");
});
```

### 3.2 Edge Cases

```typescript
describe("Edge Cases", () => {
  it("should handle concurrent task executions (queue or reject)");
  it("should handle network failure during AI response");
  it("should handle vault lock during execution");
  it("should handle user navigating away during execution");
  it("should handle malformed AI task plan response");
});
```

## 4. Test Data Requirements

### Sample AI Responses

```xml
<!-- Create note response -->
<task-plan description="Create meeting notes">
  <step type="create-note" path="meetings/2026-02-04.md">
    <content># Meeting Notes\n\nDate: 2026-02-04</content>
  </step>
  <step type="add-tag" path="meetings/2026-02-04.md" tag="meeting" />
</task-plan>

<!-- Multi-step response -->
<task-plan description="Organise project files">
  <step type="create-note" path="projects/index.md">
    <content># Project Index</content>
  </step>
  <step type="move-note" path="draft.md" destination="projects/draft.md" />
  <step type="add-link" path="projects/index.md" target="projects/draft.md" />
</task-plan>
```

### Sample Natural Language Inputs

| Input | Expected Intent | Parameters |
|-------|----------------|------------|
| "Create a note about today's meeting" | create-note | content: "today's meeting" |
| "Add a link to the project page" | add-link | target: "project page" |
| "Tag this with #urgent" | add-tag | tag: "urgent" |
| "Move this to the archive folder" | move-note | destination: "archive/" |
| "Delete the old draft" | delete-note | path: "old draft" |

## 5. Coverage Targets

| Component | Statements | Branches | Functions |
|-----------|------------|----------|-----------|
| TaskIntentDetector | 100% | 100% | 100% |
| ChatTaskIntegration | 80% | 85% | 80% |
| TaskHistoryManager | 95% | 90% | 95% |
| TaskSystemPrompt | 100% | 100% | 100% |
| **Sprint 9 Total** | 55%+ | 85%+ | 60%+ |

## 6. Test Execution Plan

1. **Phase 1: Core Logic** (Days 1-2)
   - TaskIntentDetector unit tests
   - TaskSystemPrompt unit tests
   - TaskHistoryManager unit tests

2. **Phase 2: Integration** (Days 3-4)
   - Chat-Task integration tests
   - E2E task flow tests
   - Edge case tests

3. **Phase 3: Coverage & Polish** (Day 5)
   - Coverage gap analysis
   - Additional edge case tests
   - Documentation updates

## 7. Exit Criteria

- [ ] All unit tests passing (100+ new tests)
- [ ] Integration tests passing
- [ ] Branch coverage ≥85%
- [ ] No critical bugs in task execution
- [ ] Rollback tested and verified
- [ ] Task history persists across sessions
