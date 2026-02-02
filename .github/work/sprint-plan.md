# Sprint Plan

## Release Strategy

- **Alpha releases**: One per sprint until write operations are complete
- **Beta**: After write operations enabled (Phase 1.1)
- **1.0**: Requires functional write operations with safety guardrails

## Coverage Progression

| Release | Statements | Branches | Functions | Status |
|---------|------------|----------|-----------|--------|
| alpha.4 | 35% | 70% | 30% | ✅ Complete |
| alpha.5 | 45% | 75% | 40% | 🎯 Sprint 3 target |
| alpha.6 | 55% | 80% | 50% | Planned |
| alpha.7 | 65% | 85% | 60% | Planned |
| beta.1 | 70% | 85% | 65% | After write ops |
| 1.0 | 75% | 90% | 70% | Release quality |

---

## Sprint 3: Test Coverage (Current)

**Goal:** Raise coverage to 45% statements, 75% branches

### Priority Areas (by coverage gap)

| File | Current | Target | Tests Needed |
|------|---------|--------|--------------|
| ChatView.ts | 17.65% | 40% | UI interactions, message rendering |
| settings.ts | 21.13% | 40% | Settings tab rendering, validation |
| GhCopilotCliProvider.ts | 39.25% | 55% | CLI execution, streaming |
| OnePasswordResolver.ts | 36.19% | 50% | CLI interactions |
| SetupHelpModal.ts | 12.9% | 30% | Modal rendering |

### Tasks

1. [ ] Add ChatView tests (jsdom environment)
2. [ ] Add Settings tests
3. [ ] Expand GhCopilotCliProvider tests
4. [ ] Add OnePasswordResolver tests
5. [ ] Integrate custom errors into existing code
6. [ ] Add retry logic for retryable errors

### Acceptance Criteria

- [ ] All thresholds pass (45/75/40/45)
- [ ] No regressions in existing tests
- [ ] Lint passes
- [ ] Build succeeds

---

## Sprint 4: Write Operations (Phase 1.1)

**Goal:** Enable AI-assisted note editing with safety guardrails

### Features

1. **SafeVaultAccess write API**
   - `proposeEdit(path, content)` — Returns diff preview
   - `applyEdit(path, content)` — Applies with backup
   - `revertEdit(path)` — Restores from backup

2. **Confirmation Modal**
   - Diff preview (additions/deletions highlighted)
   - Accept/Reject buttons
   - "Don't show again for this session" option

3. **Automatic Backups**
   - Create `.pa-backup/` folder in vault
   - One backup per file per day
   - Auto-cleanup after 7 days

4. **Audit Logging**
   - Log all AI-initiated changes
   - Store in `data.json` with timestamps
   - Expose in settings for review

### Security Review Required

- [ ] `@security` review before implementation
- [ ] Threat model for write operations
- [ ] Backup integrity verification

---

## Sprint 5+: Future Features

### Enhanced Context (Phase 1.2)
- Multi-file context picker
- Token budget management
- Smart context suggestions

### Agentic Capabilities (Phase 2.0)
- Task automation framework
- Note creation from chat
- Link suggestions

---

## Cross-Platform Considerations

**Status:** Windows deferred until further notice

**Architecture Guidance Requested:**
- File path handling (use Obsidian's `normalizePath`)
- Shell command execution patterns
- Environment variable access
- Line ending handling

See: `@architect` consultation for cross-platform design patterns.
