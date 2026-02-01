# Implementation Plan: gh copilot CLI Provider

**Feature**: Add GitHub Copilot CLI as an alternative AI provider  
**Date**: 2026-02-01  
**Status**: Ready for Implementation

---

## Summary

Add a new provider (`GhCopilotCliProvider`) that invokes the `gh copilot` CLI to enable access to premium models like Claude Opus 4.5 for users with Copilot Enterprise/Business licences.

### Key Documents

| Document | Purpose |
|----------|---------|
| [design.md](design.md) | Technical architecture and implementation details |
| [security-review.md](security-review.md) | Security assessment and required mitigations |

---

## Prerequisites

Before starting implementation, ensure understanding of:
1. Existing provider architecture (BaseProvider, ProviderManager)
2. Security requirements (use `spawn` with `shell: false`, sanitise errors)
3. Obsidian's Node.js environment (child_process available)

---

## Implementation Tasks

### Phase 1: Core Provider (MVP)

| # | Task | File | Est. |
|---|------|------|------|
| 1.1 | Add `gh-copilot-cli` to ProviderType union | src/api/types.ts | 5 min |
| 1.2 | Add provider config to PROVIDER_CONFIGS | src/api/BaseProvider.ts | 10 min |
| 1.3 | Create GhCopilotCliProvider class | src/api/providers/GhCopilotCliProvider.ts | 2 hrs |
| 1.4 | Export new provider | src/api/providers/index.ts | 2 min |
| 1.5 | Register provider in ProviderManager | src/api/ProviderManager.ts | 15 min |

**Security-Critical for 1.3:**
- Use `spawn` with `shell: false` (NEVER `exec`)
- No shell argument escaping needed
- Sanitise all error messages before returning to user
- Add process cleanup on unload

### Phase 2: Settings & UX

| # | Task | File | Est. |
|---|------|------|------|
| 2.1 | Add CLI status check button | src/settings.ts | 30 min |
| 2.2 | Add installation instructions UI | src/settings.ts | 30 min |
| 2.3 | Style CLI-specific elements | styles.css | 15 min |

### Phase 3: Testing

| # | Task | File | Est. |
|---|------|------|------|
| 3.1 | Unit tests with mocked spawn | tests/GhCopilotCliProvider.test.ts | 1 hr |
| 3.2 | Error handling tests | tests/GhCopilotCliProvider.test.ts | 30 min |
| 3.3 | Manual testing on macOS | N/A | 30 min |

---

## Security Requirements Checklist

Before marking implementation complete:

- [ ] Uses `spawn` with `shell: false` for all CLI invocations
- [ ] No `exec`, `execSync`, or `shell: true` usage
- [ ] Error messages sanitised (no file paths, usernames, or raw errors)
- [ ] Process killed on timeout/unload
- [ ] No prompt content logged at debug level or higher
- [ ] Security model documented in code comments

---

## Acceptance Criteria

1. ✅ User can select "GitHub Copilot CLI" as provider in settings
2. ✅ Provider detects gh CLI installation status
3. ✅ Provider detects gh-copilot extension installation
4. ✅ Provider verifies gh auth status
5. ✅ Chat works with Claude Opus 4.5 model
6. ✅ Graceful error messages for all failure modes
7. ✅ No security vulnerabilities (shell injection, info leakage)

---

## Not in Scope (v1)

- Streaming responses (CLI limitation)
- Vision/image support
- Function calling/tool use
- Windows testing (deferred to v1.1)
- Mobile support (not possible)

---

## Estimated Total Effort

| Phase | Time |
|-------|------|
| Phase 1: Core | 2.5 hrs |
| Phase 2: UX | 1.25 hrs |
| Phase 3: Testing | 2 hrs |
| **Total** | **~6 hrs** |
