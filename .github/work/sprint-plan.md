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
- [x] Exploratory testing session (@tester) — feedback incorporated

---

## Sprint 5: Chat Integration (Current)

**Goal:** Connect write operations to chat interface + UX polish

### Exploratory Testing Fixes (from alpha.6)

1. ✅ **Double-submit prevention**
   - Input cleared and disabled immediately on submit
   - Loading state set synchronously before async work
   - Prevents duplicate messages from rapid Enter/click

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
- [x] No double-submit on rapid input

---

## Sprint 6: Edit Flow Polish

**Goal:** Smooth edit experience with robust parsing

### Features

1. **Robust Edit Block Parsing**
   - Handle markdown code blocks with language hints
   - Support partial file replacements
   - Graceful fallback for unparseable responses

2. **Edit Preview Improvements**
   - Side-by-side diff view option
   - Syntax highlighting in preview
   - Show affected line numbers

3. **Edit History**
   - List recent edits in sidebar
   - Quick revert from history
   - Export edit log

### Acceptance Criteria

- [ ] AI responses with code blocks parsed reliably
- [ ] User can preview edits before applying
- [ ] Edit history accessible from chat
- [ ] Coverage at 60%+

---

## Sprint 7: Enhanced Context (Phase 1.2)

**Goal:** Smarter file context for better AI responses

### Features

1. **Multi-file Context Picker**
   - Select multiple files to include
   - Folder selection with recursion
   - Context size indicator

2. **Token Budget Management**
   - Show estimated token usage
   - Warn when approaching limits
   - Auto-truncate intelligently

3. **Smart Context Suggestions**
   - Suggest related notes based on links
   - Recent files quick-add
   - Tag-based context groups

### Acceptance Criteria

- [ ] User can select multiple files as context
- [ ] Token budget visible and respected
- [ ] Context suggestions reduce friction
- [ ] Coverage at 65%+

---

## Sprint 8: Agentic Foundations (Phase 2.0)

**Goal:** Enable AI to perform multi-step tasks

### Features

1. **Task Automation Framework**
   - Define repeatable tasks
   - Chain multiple operations
   - Progress tracking

2. **Note Creation from Chat**
   - "Create a note about X" command
   - Template selection
   - Auto-linking to context

3. **Link Suggestions**
   - AI suggests wikilinks
   - Backlink discovery
   - Orphan note detection

### Acceptance Criteria

- [ ] User can define and run tasks
- [ ] Notes created via chat appear in vault
- [ ] Link suggestions improve connectivity
- [ ] Coverage at 70%+ (beta-ready)

---

## Future Backlog

- **Performance**: Lazy loading, virtual scrolling for long chats
- **Sync**: Cloud backup of conversations
- **Plugins**: Extension API for custom commands
- **Mobile**: Obsidian Mobile compatibility testing
- **Accessibility**: Keyboard navigation, screen reader support

---
