# Test Strategy - obsidian-pa v1.0 MVP

> Created: 2026-01-31
> Author: @tester
> Status: Active

## Overview

This document defines the test strategy for the Personal Assistant Obsidian plugin v1.0 MVP release.

## Test Objectives

1. **Prevent regressions** - Ensure changes don't break existing functionality
2. **Validate security** - Verify credential handling and data safety
3. **Ensure reliability** - Plugin loads, runs, and unloads cleanly
4. **Confirm UX** - Onboarding flow works as designed

## Test Framework

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit testing (fast, ESM-native) |
| **Obsidian Mocks** | Simulate Obsidian APIs |
| **Manual Testing** | Exploratory testing in real vault |

## Test Types

### Unit Tests ✅

Automated tests for isolated components:

| Component | File | Tests | Status |
|-----------|------|-------|--------|
| API Client | `GitHubModelsClient.test.ts` | 8 | ✅ Done |
| 1Password Resolver | `OnePasswordResolver.test.ts` | 7 | ✅ Done |
| Vault Safety | `SafeVaultAccess.test.ts` | 12 | ✅ Done |
| Settings | `settings.test.ts` | 6 | ✅ Done |
| **Total** | | **33** | |

### Integration Tests 🔄

Tests requiring real environment (manual for MVP):

| Scenario | Method | Status |
|----------|--------|--------|
| 1Password CLI resolution | Manual | 🔄 Pending |
| SecretStorage token persistence | Manual | 🔄 Pending |
| GitHub Models API call | Manual | 🔄 Pending |

### Exploratory Testing 🔄

Ad-hoc testing sessions:

| Charter | Duration | Status |
|---------|----------|--------|
| First-run onboarding flow | 15 min | 🔄 Pending |
| Chat interaction patterns | 20 min | 🔄 Pending |
| Error handling scenarios | 15 min | 🔄 Pending |

## Risk-Based Prioritisation

| Risk | Component | Test Approach | Priority |
|------|-----------|---------------|----------|
| **Critical** | Token exposure | Unit tests + code review | P0 |
| **High** | Vault data safety | Unit tests (12 tests) | P0 |
| **High** | API failures | Unit tests (rate limiting) | P1 |
| **Medium** | Settings persistence | Unit tests (6 tests) | P2 |
| **Medium** | UI responsiveness | Manual testing | P2 |
| **Low** | Install script | Manual testing | P3 |

## Coverage Targets

| Metric | Target | Current |
|--------|--------|---------|
| Line coverage | 60% | TBD |
| Branch coverage | 50% | TBD |
| Critical paths | 100% | ✅ |

> Coverage reporting to be added in future iteration.

## Test Execution

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage (when configured)
npm run test:coverage

# Run specific test file
npx vitest run src/api/GitHubModelsClient.test.ts
```

### Pre-commit Checks

Before every commit:

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds

### Pre-release Checks

Before creating a release:

- [ ] All unit tests pass
- [ ] Manual exploratory testing completed
- [ ] Install script tested on clean vault
- [ ] First-run onboarding verified

## Test Environment

### Mocking Strategy

Obsidian APIs are mocked in `src/__mocks__/obsidian.ts`:

- `App`, `Vault`, `Workspace` - Core APIs
- `Plugin`, `PluginSettingTab` - Plugin lifecycle
- `ItemView`, `WorkspaceLeaf` - View system
- `Modal`, `Notice`, `Setting` - UI components

### External Dependencies

| Dependency | Mock Strategy |
|------------|---------------|
| GitHub Models API | Mock fetch responses |
| 1Password CLI | Mock exec responses |
| File system | In-memory mocks |

## Exploratory Testing Charters

### Charter 1: First-Run Onboarding

**Objective**: Verify new user experience is smooth

**Steps**:

1. Install plugin on fresh vault
2. Enable plugin
3. Observe welcome notice appears
4. Navigate to settings
5. Configure 1Password reference OR direct token
6. Verify "Ready to Use" section appears
7. Click "Open AI Chat" button
8. Verify chat panel opens

**Pass Criteria**: User can go from install to working chat in <5 minutes

### Charter 2: Chat Interaction

**Objective**: Verify chat works with AI backend

**Steps**:

1. Open a note with content
2. Open AI chat
3. Send a message referencing the note
4. Verify response appears
5. Test message history
6. Test clear button

**Pass Criteria**: Messages sent and responses received correctly

### Charter 3: Error Handling

**Objective**: Verify errors are handled gracefully

**Steps**:

1. Test with invalid token
2. Test with 1Password locked
3. Test with network disconnected
4. Test rate limit scenarios

**Pass Criteria**: Clear error messages, no crashes

## Known Limitations

1. **No E2E tests** - Obsidian doesn't support automated E2E testing easily
2. **Coverage not tracked** - To be added in v1.1
3. **No CI integration tests** - 1Password/API require real credentials

## Appendix: Test File Locations

```
src/
├── api/
│   └── GitHubModelsClient.test.ts    # API client tests
├── auth/
│   └── OnePasswordResolver.test.ts   # 1Password tests
├── vault/
│   └── SafeVaultAccess.test.ts       # Vault safety tests
├── settings.test.ts                   # Settings tests
└── __mocks__/
    └── obsidian.ts                    # Obsidian API mocks
```
