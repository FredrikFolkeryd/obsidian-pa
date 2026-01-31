# v1.0 MVP Plan

**Status:** Planning
**Lead:** @team-lead
**Created:** 2026-01-31

## Stakeholder Requirements

### Core Features (All required for 1.0)

1. **Chat Interface** - Conversational AI with vault context
2. **Agent Commands** - Summarise, extract tasks, link suggestions, etc.
3. **Background Automation** - Auto-tagging, daily note generation
4. **Plugin-as-Tools** - Automate other Obsidian plugins

### Technical Constraints

- **AI Backend:** GitHub Copilot (GitHub Models) only
- **Platform:** Obsidian Plugin API
- **Language:** TypeScript with strict mode

### Privacy Model

- Toggle between **opt-in** (whitelist folders) and **opt-out** (blacklist folders)
- Default: Opt-in (nothing shared until explicitly configured)
- Future (2.x): Dynamic exclusion via properties/tags/content parsing

### Quality Requirements

- **Automated tests:** Must pass before any release
- **Exploratory testing:** Local vault with pre-release versions
- **Data safety:** Pre-release versions MUST NOT destroy content

---

## Technical Research Findings

### ✅ Plugin-as-Tools: FEASIBLE

Obsidian provides `app.commands` API for cross-plugin interoperability:

```typescript
// List all available commands (including from other plugins)
const commands = this.app.commands.listCommands();

// Execute a command by ID
this.app.commands.executeCommandById('plugin-id:command-name');
```

**Security considerations:**
- Commands are user-consented (installed plugins only)
- No sandboxing between plugins - execute with same permissions
- Should whitelist safe commands rather than allowing arbitrary execution

### ✅ GitHub Models Integration: FEASIBLE

**Authentication:**
- PAT with `models:read` scope
- Use Obsidian's new `SecretStorage` API (since 1.11.4) for secure credential storage

**API Endpoint:**
- Azure AI Inference SDK compatible
- REST API available at `https://models.inference.ai.azure.com`

**Rate Limits (Copilot Pro):**
- 15 requests/min, 150 requests/day for low-tier models
- 8000 tokens in, 4000 tokens out per request

### ✅ Data Safety: ACHIEVABLE

**Strategy for "MUST NOT destroy content":**

1. **Read-only by default** - AI suggestions presented, user confirms
2. **Backup before modify** - Create `.backup` file before any automated change
3. **Undo integration** - Leverage Obsidian's undo stack where possible
4. **Dry-run mode** - Show what would change without applying
5. **Transaction log** - Record all automated changes for rollback

### ✅ Obsidian SecretStorage API

```typescript
// Available since Obsidian 1.11.4
this.app.vault.adapter.getSecret('github-pat');
this.app.vault.adapter.setSecret('github-pat', token);
```

**Note:** May need fallback for older Obsidian versions.

---

## Revised Scope: Phased 1.0

Given the breadth of features, I recommend splitting 1.0 into phases:

### Phase 1.0.0: Foundation + Chat (MVP)

**Goal:** Working chat with vault context, secure auth, basic consent model.

- [ ] Project scaffolding (package.json, tsconfig, esbuild, manifest)
- [ ] CI/CD pipeline (lint, test, build)
- [ ] Settings UI with opt-in/opt-out folder configuration
- [ ] GitHub PAT authentication with SecretStorage
- [ ] Chat view in sidebar
- [ ] Send message + selected note context to GitHub Models
- [ ] Display streamed response
- [ ] Basic test suite

### Phase 1.1.0: Agent Commands

**Goal:** Command palette integration with useful actions.

- [ ] "Summarise this note" command
- [ ] "Extract tasks from note" command
- [ ] "Suggest links" command
- [ ] Response displayed in modal or inserted at cursor

### Phase 1.2.0: Background Automation

**Goal:** Non-destructive automated enhancements.

- [ ] Auto-tag suggestions (presents to user, doesn't auto-apply)
- [ ] Daily note template population
- [ ] Automation framework with backup + dry-run
- [ ] Transaction log for rollback

### Phase 1.3.0: Plugin-as-Tools

**Goal:** AI can invoke other plugin commands safely.

- [ ] Command discovery and whitelisting UI
- [ ] Tool definitions for AI (command descriptions)
- [ ] Execute whitelisted commands on AI request
- [ ] Confirmation modal for destructive actions

---

## Decision

✅ **Confirmed**: Phased approach approved by stakeholder (2026-01-31).

Proceeding with **Phase 1.0.0 (Foundation + Chat)** as the first deliverable.

---

## Phase 1.0.0 Task Breakdown

### Epic 1: Project Scaffolding

| Task | Owner | Description |
| ---- | ----- | ----------- |
| 1.1 | @developer | Create `package.json` with dependencies |
| 1.2 | @developer | Create `tsconfig.json` with strict mode |
| 1.3 | @developer | Create `esbuild.config.mjs` for bundling |
| 1.4 | @developer | Create `manifest.json` (minAppVersion: 1.11.4) |
| 1.5 | @developer | Create `.eslintrc.js` with TypeScript rules |
| 1.6 | @developer | Create `src/main.ts` plugin skeleton |

### Epic 2: Settings & Consent

| Task | Owner | Description |
| ---- | ----- | ----------- |
| 2.1 | @developer | Create `src/settings.ts` with `PluginSettingTab` |
| 2.2 | @developer | Implement consent toggle (opt-in default = OFF) |
| 2.3 | @security | Design OAuth Device Flow for no-touch auth |
| 2.4 | @developer | Implement OAuth Device Flow (no copy-paste tokens) |
| 2.5 | @developer | Store token via SecretStorage after device flow |
| 2.6 | @security | Review complete auth flow |

### Epic 3: Chat Interface

| Task | Owner | Description |
| ---- | ----- | ----------- |
| 3.1 | @developer | Create `src/views/ChatView.ts` extending `ItemView` |
| 3.2 | @developer | Implement message input and display |
| 3.3 | @developer | Add command to open chat pane |
| 3.4 | @reviewer | Review UI accessibility and UX |

### Epic 4: GitHub Models Integration

| Task | Owner | Description |
| ---- | ----- | ----------- |
| 4.1 | @architect | Design API client interface |
| 4.2 | @developer | Create `src/api/GitHubModelsClient.ts` |
| 4.3 | @developer | Implement chat completion with streaming |
| 4.4 | @developer | Handle rate limiting (15 req/min) |
| 4.5 | @tester | Write unit tests for API client |

### Epic 5: Data Safety

| Task | Owner | Description |
| ---- | ----- | ----------- |
| 5.1 | @architect | Design read-only by default pattern |
| 5.2 | @developer | Implement vault access wrapper |
| 5.3 | @security | Review data exposure to external API |
| 5.4 | @tester | Write tests verifying no destructive ops |

### Epic 6: Quality & Release

| Task | Owner | Description |
| ---- | ----- | ----------- |
| 6.1 | @tester | Create test strategy document |
| 6.2 | @tester | Write integration tests |
| 6.3 | @reviewer | Final code review |
| 6.4 | @tech-writer | Write README and user guide |
| 6.5 | @team-lead | Create pre-release for local testing |

### Implementation Order

```text
Week 1: Epic 1 (Scaffolding) → Epic 2 (Settings)
Week 2: Epic 3 (Chat UI) → Epic 4 (API Integration)
Week 3: Epic 5 (Data Safety) → Epic 6 (Quality)
```

---

## Team Allocation

| Agent | Responsibility |
| ----- | -------------- |
| @team-lead | Planning, coordination, milestone tracking |
| @architect | Technical design, API design, architecture decisions |
| @developer | Implementation of all milestones |
| @tester | Test strategy, automated tests, exploratory testing |
| @security | Privacy model review, secrets management, data safety |
| @reviewer | Code review, quality gates |
| @tech-writer | README, user guide, settings documentation |
