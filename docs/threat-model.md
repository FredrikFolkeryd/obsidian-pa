# Threat Model: Write Operations

**Version**: 1.0  
**Date**: 2026-02-03  
**Author**: @security  
**Status**: Approved for alpha.8

---

## Overview

This threat model covers the AI-assisted write operations introduced in Phase 1.1 of the obsidian-pa plugin. The feature allows the AI assistant to propose edits to vault files, subject to user confirmation.

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

---

## Recommendations

### Immediate (alpha.8)
- ✅ All critical controls implemented
- ✅ Documentation updated with privacy guidance
- No blocking issues identified

### Short-term (beta.1)
- [ ] Add content length limits for context files (T5 mitigation)
- [ ] Consider system prompt hardening against injection
- [ ] Add telemetry for failed operations (opt-in)

### Long-term (1.0)
- [ ] E2E tests for edit flow security scenarios
- [ ] Security review of any new AI capabilities
- [ ] Consider local-only AI option for maximum privacy

---

## Approval

| Role | Name | Decision |
|------|------|----------|
| Security | @security | ✅ Approved for alpha.8 |
| Architect | @architect | ✅ Controls adequate |
| Team Lead | @team-lead | ✅ Proceed with release |

**Conclusion**: Write operations are adequately protected for alpha release. The confirmation-before-apply pattern combined with automatic backups provides defence in depth. No unacceptable risks identified.
