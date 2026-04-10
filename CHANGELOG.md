# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.3](https://github.com/FredrikFolkeryd/obsidian-pa/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2026-04-10)


### 🐛 Bug Fixes

* **env:** resolve macOS GUI shell environment for CLI spawning ([#66](https://github.com/FredrikFolkeryd/obsidian-pa/issues/66)) ([7d4e41a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/7d4e41a004d45ac0682e045d96d1002bf2f25bd9))
* defer heavy async init to onLayoutReady to prevent slow-load warning ([#71](https://github.com/FredrikFolkeryd/obsidian-pa/issues/71)) ([a777e9b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/a777e9b9d0cfd7a99e940d9f467f12556d7787a2))


### 🔧 Maintenance

* **deps:** update dependency @types/node to v20.19.37 ([#61](https://github.com/FredrikFolkeryd/obsidian-pa/issues/61)) ([80725a9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/80725a95a968e45e1f56967315d46404fc01a361))
* **deps:** update dependency @types/node to v20.19.39 ([#77](https://github.com/FredrikFolkeryd/obsidian-pa/issues/77)) ([c17f487](https://github.com/FredrikFolkeryd/obsidian-pa/commit/c17f487))
* **deps:** update dependency esbuild to v0.27.4 ([#64](https://github.com/FredrikFolkeryd/obsidian-pa/issues/64)) ([b777ff8](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b777ff843a0636a802ec6aec66f0ebdeec0e27e7))
* **deps:** update dependency node to v24 ([#18](https://github.com/FredrikFolkeryd/obsidian-pa/issues/18)) ([587d3cb](https://github.com/FredrikFolkeryd/obsidian-pa/commit/587d3cb))
* **deps:** update typescript-eslint monorepo to v8.57.0 ([#63](https://github.com/FredrikFolkeryd/obsidian-pa/issues/63)) ([5ebea28](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5ebea28adafaf1f8897007852b4cea5b855a9e34))
* **deps:** update typescript-eslint monorepo to v8.57.1 ([#65](https://github.com/FredrikFolkeryd/obsidian-pa/issues/65)) ([3895d71](https://github.com/FredrikFolkeryd/obsidian-pa/commit/3895d71fa52d4592d42519850ab70a52282822aa))
* **deps:** update typescript-eslint monorepo to v8.57.2 ([#67](https://github.com/FredrikFolkeryd/obsidian-pa/issues/67)) ([787481e](https://github.com/FredrikFolkeryd/obsidian-pa/commit/787481e7f5b768e9fc7af092bb802693f39735bb))
* **deps:** update typescript-eslint monorepo to v8.58.0 ([#74](https://github.com/FredrikFolkeryd/obsidian-pa/issues/74)) ([7c0e608](https://github.com/FredrikFolkeryd/obsidian-pa/commit/7c0e608))
* **deps:** update typescript-eslint monorepo to v8.58.1 ([#78](https://github.com/FredrikFolkeryd/obsidian-pa/issues/78)) ([bc8dd5a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/bc8dd5a))

## [Unreleased]

_Changes that will be in the next release._

### 🔮 Planned Features (Future Releases)

- **Link suggestions** — AI recommends connections between notes
- **Orphan detection** — Find unlinked notes in vault
- **Performance** — Lazy loading, virtual scrolling for long chats

## [1.0.0-beta.2] - 2026-03-03

### ✨ Features

- **Context picker improvements** — Better usability for selecting context files (#43)
- **Task issue template** — Maintainer-only task template for structured issue creation (#51)
- **Licence enforcement** — Automated licence compatibility checks for dependencies (#57)
- **Release automation** — Changelog and releases via release-please (#58)

### 🐛 Bug Fixes

- **Chat**: restore input and show informative message when request interrupted by app switch (#47)
- **Chat**: model settings take effect immediately in open views (#29)
- **Chat**: context files count not updating correctly (#3)
- **Chat**: always add newly opened files to context
- **Chat**: auto-update context when workspace changes with debounced refresh
- **Chat**: use ISO 8601 timestamps instead of unreliable `toLocaleString`
- **Chat**: maintain async `onClose` signature for compatibility
- **Context**: context files not recognized when added via picker (#48)
- **Context**: selection updates when assistant panel is re-activated (#41)
- **UI**: chat icon does not open chat panel (#26)
- **UI**: add missing CSS classes for context picker selected items (#35)
- **Edits**: truncated with nested code blocks and unactionable error messages (#30)
- **Vault**: create intermediate backup directories for nested file paths (#37)
- Settings auto-open on restart for configured plugins (#27)
- Ensure open files saved before edit operations to prevent stale content (#22)
- Correct property name from `contextWindow` to `maxContextTokens` in ChatView
- Standardise issue template label format (#52)

### ♻️ Code Refactoring

- Deduplicate timestamp formatting and use locale-correct dates
- Add debouncing to context refresh

### 📚 Documentation

- Add SECURITY.md for responsible vulnerability reporting (#55)
- Simplify issue templates to reduce friction (#32)

### 🔧 Maintenance

- Prepare for public beta release (#49)
- Add issue triage workflow and YAML form templates
- Enable Renovate for dependency updates
- Update dependency @types/node to v20.19.32–v20.19.35
- Update typescript-eslint monorepo to v8.55.0–v8.56.1
- Update esbuild to ^0.27.0
- Update actions/checkout to v6, actions/setup-node to v6, actions/github-script to v8
- Update softprops/action-gh-release to v2

## [1.0.0-beta.1] - 2026-02-05

🎉 **First Beta Release** — Full task automation with chat integration!

### ✨ Features

- **Natural Language Task Detection** — Pattern-based intent detection from user messages:
  - `TaskIntentDetector` — Detects 6 intent types (create, modify, delete, move, add-link, add-tag)
  - Confidence scoring for detected intents
  - Helper: `mayContainTaskIntent`, `generatePlanDescription`
  - 49 tests

- **Task History Manager** — Persistent history of executed task plans:
  - Load/export for storage
  - Query by status, date range, or affected file
  - Rollback tracking
  - Helpers: `formatHistoryEntry`, `getHistoryStats`
  - 38 tests

- **Task History View** — Dedicated UI for browsing executed task plans:
  - Filter by status (all, completed, failed, rolled-back)
  - Expandable step details
  - Rollback button with confirmation modal
  - Clear history option
  - "Open Task History" command
  - 12 tests

- **Enhanced System Prompt** — Task planning instructions for AI:
  - `buildTaskPlanningInstructions()` helper
  - `buildSystemPrompt({ enableTaskPlanning: true })` option
  - 7 tests

- **ChatView Task Integration** — Execute task plans directly from chat:
  - `createTaskExecutor()` factory function
  - Task plan detection via `parseTaskPlanBlocks`
  - "Review & Execute" button for valid task plans
  - Real-time step progress feedback
  - History tracking on execution

- **Integration Tests** — E2E flow coverage:
  - Parse → Approve → Execute → History lifecycle
  - 8 integration tests

### 📊 Test Coverage

- **669 tests** (up from 555 in alpha.9)
- **86%+ branch coverage** maintained

## [1.0.0-alpha.9]

### ✨ Features

- **Task Automation Framework** — AI can perform multi-step workflows:
  - `TaskPlanParser` — Parses XML task plans from AI responses
  - `TaskExecutor` — Plan-Approve-Execute pattern with full rollback
  - `TaskApprovalModal` — Review and approve task plans before execution
  - `TaskPlanBlockParser` — Detects task plan blocks in chat responses

- **6 Step Handlers** — Vault operations for task automation:
  - `CreateNoteHandler` — Create new vault notes
  - `ModifyNoteHandler` — Edit existing notes with backup
  - `DeleteNoteHandler` — Delete notes with content backup for undo
  - `MoveNoteHandler` — Rename/move notes via fileManager
  - `AddLinkHandler` — Insert wikilinks into notes
  - `AddTagHandler` — Add frontmatter or inline tags

- **Expanded test coverage** — 555 tests total (up from 375):
  - 98 handler tests with comprehensive edge cases
  - 30 TaskPlanParser tests
  - 21 TaskExecutor tests
  - 21 TaskPlanBlockParser tests
  - 10 TaskApprovalModal tests

### 🔧 Changed

- Branch coverage maintained at 84.57%
- Statement coverage increased to 52.48%
- Sprint plan updated with Sprint 8 completion

## [1.0.0-alpha.8]

### ✨ Features

- **Expanded test coverage** — 330 tests total (up from 232):
  - Pure helper functions extracted to `src/chat/helpers.ts` with 100% coverage
  - Settings validation tests (+15)
  - EditHistoryModal logic tests (+22)
  - SafeVaultAccess edge case tests (+14)
  
- **Branch coverage exceeds 80% target** — Now at 84%

### 📋 Documentation

- **Threat model** for write operations — Comprehensive security review:
  - 9 threat categories analysed (T1–T9)
  - Risk matrix with likelihood/impact assessments
  - All critical controls verified and tested
  - Approved for release by @security, @architect, @team-lead
  
- **Sprint 6 retrospective** — Coverage target recalibration:
  - Industry research (Martin Fowler, Stack Overflow consensus)
  - Revised targets based on UI-heavy architecture
  - E2E testing planned for beta phase

### 🔧 Changed

- Coverage targets recalibrated based on industry best practices
- Pure functions extracted from ChatView for improved testability
- Sprint plan updated with realistic progression table

## [1.0.0-alpha.7]

### ✨ Features

- **Improved diff preview** — Edit confirmation modal now shows:
  - Line numbers for old and new content
  - LCS-based unified diff algorithm for accurate change detection
  - Better handling of large files with context snippets
  - Statistics showing additions, deletions, and unchanged lines
  
- **Edit history panel** — New "History" button in chat toolbar:
  - View all recorded AI edits with timestamps
  - See edit reasons and backup information
  - Revert the most recent edit directly from history
  - Clear edit history when no longer needed

- **Enhanced edit block parsing** — Better detection of AI edit suggestions:
  - Support for SEARCH/REPLACE patterns with git-style markers
  - New edit types: `full-replace`, `search-replace`, `append`, `prepend`
  - `applySearchReplace()` function for partial text replacements
  - Improved `mayContainEdits()` with search/replace pattern detection

### 🧪 Testing

- **232 tests total** — Up from 209
- **16 new tests** for diff algorithm (LCS, unified diff, statistics)
- **7 new tests** for search/replace edit parsing

### 🔧 Changed

- Edit confirmation modal width increased for better diff readability
- Diff lines now hover-highlight for easier reading
- Context lines shown for large file changes

## [1.0.0-alpha.6]

### ✨ Features

- **AI-assisted note editing** — AI can now suggest changes to your vault files:
  - Edit detection: Parses AI responses for code blocks with file paths
  - Supports multiple formats: fenced-path, XML-style, contextual blocks
  - "Apply Edit" button appears on AI messages containing edits
  
- **Diff preview confirmation** — Before any edit is applied:
  - Modal shows file path and reason for the edit
  - Color-coded diff: green for additions, red for deletions
  - Statistics: +N lines added, -N lines removed
  - Accept or Cancel buttons with keyboard support
  
- **Automatic backups** — Every edit creates a backup:
  - Stored in `.pa-backups/` folder (hidden by default)
  - Timestamped backup files for each modification
  - Maximum 10 backups per file, auto-cleanup of old backups
  - 7-day retention policy for backup cleanup
  
- **Undo last edit** — "Undo Edit" button in chat toolbar:
  - Reverts the most recent AI-initiated change
  - Restores from automatic backup
  - Confirmation dialog before reverting
  
- **Audit logging** — Full history of AI-initiated writes:
  - Tracks create, modify, and revert operations
  - Timestamps and reasons recorded
  - Maximum 100 entries maintained
  
- **SafeVaultAccess API** — Secure write layer with:
  - Explicit write enablement (disabled by default)
  - Path-based access control (respects private patterns)
  - Proposal → confirmation → apply workflow

### 🧪 Testing

- **209 tests total** — Up from 178 (+31 new)
- **22 tests** for EditBlockParser covering all edit formats
- **13 tests** for VaultBackup (create, restore, cleanup)
- **13 tests** for SafeVaultAccess (reads, writes, security)
- **9 tests** for E2E edit flow integration

### 🔧 Changed

- Chat view now integrates write operations with SafeVaultAccess
- Plugin initialises SafeVaultAccess on load as `plugin.safeVault`
- Write mode defaults to disabled (must be explicitly enabled per operation)

## [1.0.0-alpha.4]

### ✨ Features

- **Structured error handling** — Custom error classes with user-friendly messages
  - Categorised errors: Authentication, TokenValidation, RateLimit, Network, API errors
  - Retryable error detection for better UX
  - Consistent error messaging across the plugin

### 🧪 Testing

- **Coverage thresholds** — 35% statement, 70% branch coverage required for CI
- **Codecov integration** — Coverage tracking and badges in README
- **Provider integration tests** — 43 new tests for ProviderManager and GitHubModelsProvider
- **E2E integration tests** — 12 tests for full chat flow with mock vault
- **Error handling tests** — 25 tests for custom error classes

### 🔧 Changed

- **CI coverage reporting** — Coverage summary in GitHub Actions job summary
- **ESLint relaxations for tests** — Type safety relaxed in test files for mock compatibility
- **114 tests total** — Up from 77, 42% statement coverage, 82% branch coverage

## [1.0.0-alpha.3]

### ✨ Features

- **Streaming responses** — AI responses now stream in real-time with a blinking cursor
- **Conversation persistence** — Chat history saved across Obsidian sessions (up to 50 messages)
- **Export conversation** — Copy conversation to clipboard as formatted markdown
- **Stop button** — Cancel in-progress AI requests
- **Send button state** — Disabled during AI thinking to prevent duplicate requests

### 🔄 Changed

- Updated README with alpha warning banner and known limitations section
- Added limitation notice link in chat header pointing to documentation

## [1.0.0-alpha.2]

### 🔄 Changed

- **Migrated to standalone Copilot CLI** — Now uses `copilot` command instead of deprecated `gh copilot` extension
- Updated installation instructions for Copilot CLI (`brew install copilot-cli`)
- Simplified release workflow (removed environments, uses CHANGELOG for release notes)

### 🐛 Fixed

- Copilot CLI provider now works correctly from Obsidian GUI
- Updated model list to match current Copilot CLI offerings

## [1.0.0-alpha.1]

First alpha release of the Obsidian Personal Assistant plugin.

### ✨ Features

- **AI Chat Interface** — Side panel for conversational AI within your vault
- **Multi-Provider Support** — Choose between:
  - **GitHub Models** via 1Password integration or direct API token
  - **gh Copilot CLI** using existing `gh auth` credentials (no token management!)
- **Dynamic Model Selection** — Choose from available models (Claude, GPT, Gemini series)
- **Vault Context Access** — AI can read notes from opt-in folders you specify
- **Usage Tracking** — Daily request counter displayed in chat header
- **Gated Setup Flow** — Chat panel disabled until configuration complete
- **Chat-Only Mode** — Use the plugin without vault access (explicit opt-in)

### 🔒 Security

- No credentials stored in plugin — uses 1Password CLI or gh auth
- Opt-in folder access — you choose which folders AI can read
- Read-only vault access — AI cannot modify your notes

### 📦 Installation

1. Download `obsidian-pa-1.0.0-alpha.1.zip` from releases
2. Extract to `<vault>/.obsidian/plugins/` (creates `obsidian-pa/` folder)
3. Reload Obsidian and enable in **Settings → Community plugins**
4. Configure in **Settings → Personal Assistant**

### ⚠️ Known Limitations

| Limitation | Notes |
|------------|-------|
| No streaming | Responses appear all at once |
| No conversation persistence | Chat history lost on reload |
| macOS/Linux only | Windows paths untested |
| Not in Community plugins | Manual installation required |

### 🔗 Links

- [Documentation](https://github.com/FredrikFolkeryd/obsidian-pa#readme)
- [Report an issue](https://github.com/FredrikFolkeryd/obsidian-pa/issues)
