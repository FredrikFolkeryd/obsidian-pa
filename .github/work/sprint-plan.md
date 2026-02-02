# Sprint Plan

## Release Strategy

- **Alpha releases**: One per sprint until write operations are complete
- **Beta**: After write operations enabled (Phase 1.1)
- **1.0**: Requires functional write operations with safety guardrails

## Coverage Progression

| Release | Statements | Branches | Functions | Status |
|---------|------------|----------|-----------|--------|
| alpha.4 | 35% | 70% | 30% | ✅ Complete |
| alpha.5 | 45% | 75% | 40% | ✅ Complete |
| alpha.6 | ~46% | ~76% | ~41% | ✅ Complete (Sprint 4) |
| alpha.7 | 55% | 80% | 50% | 🎯 Sprint 5 target |
| beta.1 | 65% | 85% | 60% | After integration |
| 1.0 | 70% | 85% | 65% | Release quality |

> **Note**: Coverage targets recalibrated after Sprint 4 retro. Original targets were optimistic.

---

## Sprint 3: Test Coverage ✅ Complete

**Goal:** Raise coverage to 45% statements, 75% branches

- ✅ Custom error handling implemented
- ✅ Provider tests expanded  
- ✅ E2E integration tests added
- ✅ 164 tests passing
- ✅ alpha.5 released

---

## Sprint 4: Write Operations ✅ Complete

**Goal:** Enable AI-assisted note editing with safety guardrails

### Delivered Features

1. ✅ **SafeVaultAccess write API**
   - `proposeEdit(path, content, reason)` — Creates pending edit
   - `applyEdit(path)` — Applies with automatic backup
   - `revertEdit(path)` — Restores from backup
   - Audit logging for all operations

2. ✅ **Confirmation Modal** (EditConfirmationModal.ts)
   - Diff preview (additions/deletions highlighted)
   - Accept/Cancel buttons
   - Short and long diff views

3. ✅ **Automatic Backups** (VaultBackup.ts)
   - Creates `.pa-backups/` folder in vault
   - Max 10 backups per file
   - Auto-cleanup after 7 days

4. ✅ **Testing**
   - 178 tests passing (+14 from Sprint 3)
   - VaultBackup unit tests added
   - SafeVaultAccess write tests added

### Pending from Retro

- [ ] Threat model for write operations (@security)
- [ ] Exploratory testing session (@tester)

---

## Sprint 5: Chat Integration (Current)

**Goal:** Connect write operations to chat interface

### Features

1. **Edit Command Recognition**
   - Detect when AI suggests edits
   - Parse edit blocks from responses
   - Show confirmation modal

2. **Apply from Chat**
   - "Apply this edit" button in chat
   - Inline diff preview
   - Success/error feedback

3. **Revert from Chat**
   - "Undo last edit" command
   - List recent edits
   - Revert with confirmation

### Acceptance Criteria

- [ ] User can request file edits via chat
- [ ] Confirmation modal shown before applying
- [ ] Successful edits reflected in vault
- [ ] Revert functionality works
- [ ] Coverage at 55%+

---

## Sprint 6+: Future Features

### Enhanced Context (Phase 1.2)
- Multi-file context picker
- Token budget management
- Smart context suggestions

### Agentic Capabilities (Phase 2.0)
- Task automation framework
- Note creation from chat
- Link suggestions

---
