# ADR-002: SafeVaultAccess Consent Model

**Status:** Accepted  
**Date:** 2026-02-01  
**Author:** @architect, @security  
**Supersedes:** N/A

## Context

The plugin needs to read vault files to provide context to AI conversations. This raises privacy and consent concerns:

1. Users may have sensitive notes they don't want shared with AI
2. Third parties mentioned in notes have implicit privacy expectations
3. AI providers may log/train on submitted content
4. Accidental exposure could breach trust

### Requirements

1. Users must explicitly consent to file sharing
2. Sensitive files must be excludable
3. Default should be privacy-preserving
4. Write operations need additional safeguards

## Decision

Implement a **consent-based access model** with two modes:

### Consent Modes

| Mode | Behaviour | Use Case |
|------|-----------|----------|
| **Opt-in** (default) | Only explicitly allowed paths shared | Privacy-first users |
| **Opt-out** | All files shared except excluded paths | Power users |

### Configuration

```typescript
interface PASettings {
  vaultConsent: {
    mode: "opt-in" | "opt-out";
    allowedPaths: string[];   // Globs for opt-in mode
    excludedPaths: string[];  // Globs for opt-out mode
  };
}
```

### Default Exclusions

Always excluded regardless of mode:
- `.obsidian/` — Plugin/app configuration
- `.pa-backups/` — Our backup files
- `*.env` — Environment files
- Files matching user-defined patterns

### Write Operations

Write access has additional controls:

1. **Disabled by default** — Must explicitly enable in settings
2. **Confirmation required** — User approves each edit via modal
3. **Automatic backup** — Original content preserved before modification
4. **Audit logging** — All write operations logged

```typescript
class SafeVaultAccess {
  // Read: governed by consent mode
  readFile(path: string): Promise<VaultReadResult | null>;
  
  // Write: requires explicit enablement + confirmation
  enableWrites(): void;
  proposeEdit(path: string, content: string, reason: string): ProposedEdit;
  applyEdit(path: string): Promise<WriteResult>;
  revertEdit(path: string): Promise<WriteResult>;
}
```

## Consequences

### Positive

- **Privacy by default:** Opt-in mode protects sensitive content
- **User control:** Clear configuration for access boundaries
- **Auditability:** All operations logged
- **Reversibility:** Backups enable recovery from mistakes

### Negative

- **Friction:** Opt-in mode requires explicit file selection
- **Complexity:** Two modes to document and support
- **Edge cases:** Glob patterns can be confusing

### Risks Mitigated

- **Data leakage:** Sensitive files not sent to AI without consent
- **Third-party privacy:** Users can exclude notes about others
- **Accidental destruction:** Backups prevent data loss

## Implementation

### Files Created

- `src/vault/SafeVaultAccess.ts` — Core access wrapper
- `src/vault/VaultBackup.ts` — Backup management
- `src/settings.ts` — Consent configuration UI

### Access Check Flow

```
readFile(path)
    │
    ▼
┌─────────────────┐
│ Is path in      │──No──► Return null (denied)
│ allowed scope?  │
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Is path in      │──Yes─► Return null (denied)
│ excluded list?  │
└────────┬────────┘
         │ No
         ▼
    Return content
```

### Write Operation Flow

```
proposeEdit(path, content, reason)
    │
    ▼
┌─────────────────┐
│ Are writes      │──No──► Return error
│ enabled?        │
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Is path in      │──No──► Return error
│ write scope?    │
└────────┬────────┘
         │ Yes
         ▼
    Store pending edit
         │
         ▼
    Show confirmation modal
         │
         ▼
┌─────────────────┐
│ User approves?  │──No──► Discard pending edit
└────────┬────────┘
         │ Yes
         ▼
    Create backup → Apply edit → Log audit entry
```

## Alternatives Considered

### 1. No Consent (Share Everything)

**Rejected:** Violates privacy expectations and EA-03 requirements.

### 2. Per-File Consent Prompt

**Rejected:** Too intrusive for frequent operations.

### 3. Folder-Only Consent

**Rejected:** Insufficient granularity for mixed-sensitivity folders.

## References

- [EA-03: Security and Privacy Requirements](https://engineering-baseline.ingka.com/adr/adr-ea-03)
- [Threat Model](/docs/threat-model.md)
- [GDPR Data Minimisation Principle](https://gdpr-info.eu/art-5-gdpr/)
