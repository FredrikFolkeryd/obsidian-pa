# Threat Model: Write Operations

**Version**: 1.1  
**Date**: 2026-02-04  
**Author**: @security  
**Status**: Updated for Sprint 8 (Agentic Foundations)

---

## Overview

This threat model covers the AI-assisted write operations introduced in Phase 1.1 of the obsidian-pa plugin, updated for Phase 2.0 multi-step task automation. The feature allows the AI assistant to propose edits to vault files, subject to user confirmation.

### Assets Under Protection

1. **User vault content** — Notes, documents, personal data
2. **Vault integrity** — File structure and relationships
3. **User trust** — Confidence that AI won't cause data loss
4. **Backup data** — Recovery files in `.pa-backups/`

### Attack Surface

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  ChatView    │  │ Apply Button │  │ Confirmation     │  │
│  │  (input)     │──│ (trigger)    │──│ Modal (consent)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   SafeVaultAccess                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ proposeEdit │  │ applyEdit   │  │ revertEdit          │ │
│  │ (pending)   │──│ (backup+    │──│ (restore)           │ │
│  │             │  │  modify)    │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                          │                                  │
│                          ▼                                  │
│              ┌─────────────────────────┐                   │
│              │     VaultBackup         │                   │
│              │ (.pa-backups/ folder)   │                   │
│              └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Obsidian Vault API                        │
│                   (vault.modify, vault.create)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Threat Categories

### T1: Unintended Content Modification

**Description**: AI produces incorrect or harmful edits that damage vault content.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Medium — LLMs can hallucinate or misunderstand intent |
| Impact | High — User notes could be corrupted or lost |
| Risk Level | **High** |

**Existing Mitigations**:
1. ✅ **User confirmation required** — EditConfirmationModal shows diff before apply
2. ✅ **Automatic backup** — VaultBackup creates backup before every modify
3. ✅ **Revert capability** — User can undo via revertEdit()
4. ✅ **Audit logging** — All operations logged with timestamp and reason

**Residual Risk**: Low — Multiple safety layers prevent unrecoverable loss.

---

### T2: Unauthorised File Access

**Description**: AI accesses or modifies files outside user-consented folders.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Low — Path checks enforced at SafeVaultAccess level |
| Impact | High — Privacy violation, unexpected modifications |
| Risk Level | **Medium** |

**Existing Mitigations**:
1. ✅ **Path allowlist** — `isPathAllowed()` checks against consent settings
2. ✅ **Opt-in mode** — Default requires explicit folder inclusion
3. ✅ **Write mode toggle** — `writeEnabled` flag must be explicitly set
4. ✅ **Denied operations logged** — Attempts to access forbidden paths logged

**Code Reference** ([SafeVaultAccess.ts](../src/vault/SafeVaultAccess.ts#L113-L134)):
```typescript
public isPathAllowed(path: string): boolean {
  if (!this.settings.consentEnabled) {
    return false;
  }
  // Opt-in: only allow if in included folders
  // Opt-out: allow unless in excluded folders
}
```

**Residual Risk**: Low — Defence in depth with multiple checks.

---

### T3: Data Loss via Failed Backup

**Description**: Backup fails silently, then modify operation corrupts original.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Low — Explicit backup check before modify |
| Impact | Critical — Unrecoverable data loss |
| Risk Level | **High** |

**Existing Mitigations**:
1. ✅ **Backup-or-abort pattern** — applyEdit() aborts if backup fails
2. ✅ **Audit log on failure** — Failed backups logged with error
3. ✅ **Backup retention** — 10 backups per file, 7-day retention

**Code Reference** ([SafeVaultAccess.ts](../src/vault/SafeVaultAccess.ts#L370-L377)):
```typescript
backupMeta = await this.backup.createBackup(file, pending.reason);
if (!backupMeta) {
  // Don't proceed without backup
  const error = "Failed to create backup - aborting edit for safety";
  this.logAudit("modify", path, pending.reason, false, error);
  return { success: false, path, error };
}
```

**Residual Risk**: Very Low — Critical path properly guarded.

---

### T4: Denial of Service via Backup Exhaustion

**Description**: Attacker floods vault with edit requests, filling disk with backups.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Very Low — Requires user to confirm each edit |
| Impact | Medium — Disk space exhaustion |
| Risk Level | **Low** |

**Existing Mitigations**:
1. ✅ **Max backups per file** — 10 backups limit (configurable)
2. ✅ **Auto-cleanup** — Backups older than 7 days deleted
3. ✅ **User confirmation required** — Can't automate mass edits

**Residual Risk**: Very Low — Rate limited by user confirmation.

---

### T5: Prompt Injection via File Content

**Description**: Malicious file content tricks AI into harmful actions.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Medium — If AI reads user files, content could inject prompts |
| Impact | Medium — Unintended edits, information disclosure |
| Risk Level | **Medium** |

**Existing Mitigations**:
1. ✅ **User confirmation** — Any resulting edit requires user approval
2. ✅ **Diff preview** — User can inspect exactly what changes
3. ✅ **Path restrictions** — AI can only see consented folders
4. ⚠️ **No content sanitisation** — File content passed directly to LLM

**Recommendations**:
- Consider adding content length limits for context files
- Document risk to users in README
- Future: Add system prompt hardening against injection

**Residual Risk**: Medium — Mitigated by confirmation flow but not eliminated.

---

### T6: Sensitive Data Exposure to AI Provider

**Description**: Note content sent to external AI provider exposes private data.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Certain — Core functionality requires sending context |
| Impact | Variable — Depends on note content sensitivity |
| Risk Level | **Medium-High** (privacy concern) |

**Existing Mitigations**:
1. ✅ **Consent required** — User must opt-in to AI features
2. ✅ **Folder selection** — User controls which folders are accessible
3. ✅ **Chat-only mode** — Option to disable file access entirely
4. ✅ **Provider choice** — User selects which AI provider receives data

**User Guidance** (documented in settings):
- Only include folders you're comfortable sharing with AI provider
- Use chat-only mode for sensitive work sessions
- Review provider's data retention policies

**Residual Risk**: Accepted — Inherent to AI assistant functionality with user consent.

---

### T7: Delete Operations

**Description**: AI attempts to delete files, causing data loss.

| Aspect | Assessment |
|--------|------------|
| Likelihood | N/A — Delete operations forbidden |
| Impact | N/A |
| Risk Level | **Eliminated** |

**Existing Mitigations**:
1. ✅ **Hard block** — `deleteFile()` always throws, never executes
2. ✅ **No delete method exposed** — API only offers proposeEdit/applyEdit/revertEdit

**Code Reference** ([SafeVaultAccess.ts](../src/vault/SafeVaultAccess.ts#L461-L467)):
```typescript
public deleteFile(_path: string): never {
  throw new Error(
    "Delete operations are forbidden through the AI interface. " +
    "Use Obsidian's native file operations for deletions."
  );
}
```

**Residual Risk**: None — Architecturally eliminated.

---

### T8: Race Conditions in Edit Flow

**Description**: Multiple edits to same file cause conflicts or data loss.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Low — UI prevents rapid multi-submit |
| Impact | Medium — Content conflicts, unexpected state |
| Risk Level | **Low** |

**Existing Mitigations**:
1. ✅ **Pending edit map** — Only one pending edit per path
2. ✅ **UI submit lock** — Double-submit prevention in ChatView
3. ✅ **Sequential processing** — Edits applied one at a time

**Residual Risk**: Low — UI guards prevent realistic attack vectors.

---

### T9: Backup Content Exposure

**Description**: Backup folder `.pa-backups/` exposes historical content.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Low — Folder is in vault, same access as original |
| Impact | Low — Historical versions accessible |
| Risk Level | **Low** |

**Existing Mitigations**:
1. ✅ **7-day auto-cleanup** — Old backups removed
2. ✅ **Same vault permissions** — Backup folder follows vault access
3. ✅ **Dot-prefix** — `.pa-backups` hidden by default in many file browsers

**User Guidance**:
- Add `.pa-backups` to .gitignore if syncing vault
- Backups contain exact file copies — treat with same sensitivity

**Residual Risk**: Accepted — Inherent to backup functionality.

---

## Phase 2.0: Multi-Step Task Automation Threats

The following threats are specific to Sprint 8's agentic features, where AI can execute multi-step task plans with a single user approval.

### T10: Cascading Failure in Multi-Step Tasks

**Description**: A failure mid-task leaves vault in inconsistent state (some steps applied, others not).

| Aspect | Assessment |
|--------|------------|
| Likelihood | Medium — Network errors, file conflicts possible |
| Impact | High — Vault inconsistency, broken links |
| Risk Level | **High** |

**Mitigations**:
1. ☐ **Atomic rollback** — All completed steps reverted on failure
2. ☐ **Transaction log** — Each step's undo action recorded before execution
3. ☐ **Fail-fast default** — Stop on first error (no partial execution)
4. ☐ **Rollback confirmation** — Clear UI showing what was undone

**Residual Risk**: Medium — Rollback may not be perfect in all edge cases.

---

### T11: Approval Fatigue / Rubber-Stamping

**Description**: User approves complex multi-step plans without reviewing each step, leading to unintended changes.

| Aspect | Assessment |
|--------|------------|
| Likelihood | High — Users may trust AI too much |
| Impact | Medium — Unintended but reversible changes |
| Risk Level | **Medium-High** |

**Mitigations**:
1. ☐ **Clear plan summary** — Show step count, affected files prominently
2. ☐ **Step limit** — Maximum 10 steps per task (configurable)
3. ☐ **High-risk warnings** — Flag delete/move operations distinctly
4. ☐ **Undo available** — Rollback always accessible after execution
5. ☐ **Preview mode** — Option to run task as dry-run first

**Residual Risk**: Medium — User education and clear UI critical.

---

### T12: Resource Exhaustion via Large Task Plans

**Description**: AI generates task with many steps or large file content, exhausting memory or disk.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Low — AI models have output limits |
| Impact | Medium — Plugin crash or disk full |
| Risk Level | **Low-Medium** |

**Mitigations**:
1. ☐ **Max steps per task** — Hard limit of 20 steps
2. ☐ **Max content size** — Per-file size limit (e.g., 100KB)
3. ☐ **Task timeout** — Cancel long-running tasks automatically
4. ☐ **Validation layer** — Reject oversized plans before approval

**Residual Risk**: Low — Limits provide adequate protection.

---

### T13: Malformed Task Plan Injection

**Description**: AI response contains malformed XML/task plan that causes parser crash or unexpected behaviour.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Medium — LLM output unpredictable |
| Impact | Low-Medium — Plugin crash, no data loss |
| Risk Level | **Medium** |

**Mitigations**:
1. ☐ **Strict XML parsing** — Reject malformed plans gracefully
2. ☐ **Schema validation** — Validate step types and required attributes
3. ☐ **Path sanitisation** — Check all paths before execution
4. ☐ **Error recovery** — Show user-friendly error, don't crash

**Residual Risk**: Low — Parser robustness is testable.

---

### T14: Privilege Escalation via Task Chaining

**Description**: A task plan includes steps that individually pass consent checks but together achieve forbidden access (e.g., move file to consented folder, then modify).

| Aspect | Assessment |
|--------|------------|
| Likelihood | Low — Requires sophisticated attack |
| Impact | Medium — Access to non-consented content |
| Risk Level | **Low-Medium** |

**Mitigations**:
1. ☐ **Per-step consent check** — Verify consent at execution time, not just plan time
2. ☐ **Source and destination checks** — Move operations check both paths
3. ☐ **Audit trail** — Full task history for review

**Residual Risk**: Low — Defence in depth at step level.

---

### T15: Rollback Failure

**Description**: Rollback operation fails, leaving vault with partial undo state.

| Aspect | Assessment |
|--------|------------|
| Likelihood | Low — Rollback uses same backup mechanism |
| Impact | High — Inconsistent vault state |
| Risk Level | **Medium** |

**Mitigations**:
1. ☐ **Backup before rollback** — Create restore point before undo
2. ☐ **Manual recovery docs** — Document how to recover from .pa-backups
3. ☐ **Rollback log** — Show exactly what was/wasn't undone
4. ☐ **Graceful degradation** — Continue rollback even if one step fails

**Residual Risk**: Medium — Edge cases possible but documented.

---

## Sprint 8 Security Controls

| Control | Type | Status | Tested |
|---------|------|--------|--------|
| Plan-Approve-Execute pattern | Preventive | ☐ Planned | ☐ |
| Atomic rollback | Recovery | ☐ Planned | ☐ |
| Task step limit | Preventive | ☐ Planned | ☐ |
| Content size limit | Preventive | ☐ Planned | ☐ |
| Task timeout | Preventive | ☐ Planned | ☐ |
| Schema validation | Preventive | ☐ Planned | ☐ |
| Per-step consent check | Preventive | ☐ Planned | ☐ |
| Rollback confirmation UI | Detective | ☐ Planned | ☐ |

---

## Security Controls Summary

| Control | Type | Implemented | Tested |
|---------|------|-------------|--------|
| User confirmation modal | Preventive | ✅ | ✅ |
| Automatic backup before modify | Detective/Recovery | ✅ | ✅ |
| Revert capability | Recovery | ✅ | ✅ |
| Audit logging | Detective | ✅ | ✅ |
| Path allowlist | Preventive | ✅ | ✅ |
| Write mode toggle | Preventive | ✅ | ✅ |
| Delete operation block | Preventive | ✅ | ✅ |
| Backup retention limits | Preventive | ✅ | ✅ |
| Double-submit prevention | Preventive | ✅ | ✅ |

---

## Risk Matrix

### Phase 1.1 Threats (alpha.8 - Implemented)

| Threat | Likelihood | Impact | Risk | Residual |
|--------|------------|--------|------|----------|
| T1: Unintended modification | Medium | High | High | **Low** |
| T2: Unauthorised access | Low | High | Medium | **Low** |
| T3: Failed backup | Low | Critical | High | **Very Low** |
| T4: Backup DoS | Very Low | Medium | Low | **Very Low** |
| T5: Prompt injection | Medium | Medium | Medium | **Medium** |
| T6: Data exposure | Certain | Variable | Medium-High | **Accepted** |
| T7: Delete operations | N/A | N/A | Eliminated | **None** |
| T8: Race conditions | Low | Medium | Low | **Low** |
| T9: Backup exposure | Low | Low | Low | **Accepted** |

### Phase 2.0 Threats (Sprint 8 - Planned)

| Threat | Likelihood | Impact | Risk | Residual |
|--------|------------|--------|------|----------|
| T10: Cascading failure | Medium | High | High | **Medium** (pending) |
| T11: Approval fatigue | High | Medium | Medium-High | **Medium** (pending) |
| T12: Resource exhaustion | Low | Medium | Low-Medium | **Low** (pending) |
| T13: Malformed plan injection | Medium | Low-Medium | Medium | **Low** (pending) |
| T14: Privilege escalation | Low | Medium | Low-Medium | **Low** (pending) |
| T15: Rollback failure | Low | High | Medium | **Medium** (pending) |

---

## Recommendations

### Immediate (alpha.8) ✅ Complete

- ✅ All critical controls implemented
- ✅ Documentation updated with privacy guidance
- No blocking issues identified

### Sprint 8 (Agentic Foundations)

- [ ] Implement Plan-Approve-Execute pattern (T10, T11 mitigation)
- [ ] Add task step limits (max 20) (T12 mitigation)
- [ ] Add content size limits per file (T12 mitigation)
- [ ] Implement strict XML parser with schema validation (T13 mitigation)
- [ ] Per-step consent checking at execution time (T14 mitigation)
- [ ] Atomic rollback with transaction log (T10, T15 mitigation)
- [ ] Clear plan summary UI with affected file count (T11 mitigation)

### Short-term (beta.1)

- [ ] Add content length limits for context files (T5 mitigation)
- [ ] Consider system prompt hardening against injection
- [ ] Add telemetry for failed operations (opt-in)
- [ ] Security tests for all Sprint 8 controls

### Long-term (1.0)

- [ ] E2E tests for edit flow security scenarios
- [ ] Security review of any new AI capabilities
- [ ] Consider local-only AI option for maximum privacy

---

## Approval

### Phase 1.1 (alpha.8)

| Role | Name | Decision |
|------|------|----------|
| Security | @security | ✅ Approved for alpha.8 |
| Architect | @architect | ✅ Controls adequate |
| Team Lead | @team-lead | ✅ Proceed with release |

### Phase 2.0 (Sprint 8) — Pending Implementation

| Role | Name | Decision |
|------|------|----------|
| Security | @security | ⏳ Conditional approval — requires all T10-T15 mitigations |
| Architect | @architect | ✅ Architecture reviewed (ADR-003) |
| Team Lead | @team-lead | ⏳ Pending security signoff |

**Conclusion**: Write operations are adequately protected for alpha release. Multi-step task automation introduces elevated risks (T10-T15) that require implementation of planned mitigations before beta release. The Plan-Approve-Execute pattern with atomic rollback is critical for safe agentic operation.
