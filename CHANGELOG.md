# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Changes that will be in the next release._

### 🔮 Planned Features (Future Releases)

The following features are planned for future releases:

#### Enhanced Context (Phase 1.2)

- **Multi-file context** — AI can reference multiple notes in a single conversation

#### Agentic Capabilities (Phase 2.0)

- **Natural language tasks** — "Create a note about X" detection
- **Link suggestions** — AI recommends connections between notes
- **Orphan detection** — Find unlinked notes in vault

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
