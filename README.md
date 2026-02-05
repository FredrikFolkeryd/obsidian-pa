# Obsidian PA

[![CI](https://github.com/FredrikFolkeryd/obsidian-pa/actions/workflows/ci.yml/badge.svg)](https://github.com/FredrikFolkeryd/obsidian-pa/actions/workflows/ci.yml)

An Obsidian plugin that provides an agentic interface to leverage AI agents within your Obsidian vault.

> 🚀 **Beta Release** — Full task automation now available! See [Changelog](CHANGELOG.md) for details.

## Overview

Obsidian PA enables users to interact with AI capabilities directly in their note-taking workflow, bringing agentic development practices to personal knowledge management.

**Developer**: Fredrik Folkeryd  
**Organisation Context**: Built using models from Ingka Group Digital as personal upskilling on agentic development.

## Features

### Core AI Chat
- 💬 **Streaming AI responses** — Real-time output with conversation persistence
- 🔄 **Two provider options:**
  - **GitHub Models** (free tier) — GPT-4o, Llama, Mistral, and more
  - **GitHub Copilot CLI** — Premium models like Claude Opus 4.5 for Copilot Business/Enterprise
- 🔐 **Secure credentials** — 1Password CLI integration or direct token entry
- 📁 **Folder-based privacy** — Opt-in or opt-out data sharing controls

### Write Operations (New in beta)
- ✏️ **AI-assisted editing** — Apply suggested edits with diff preview
- 💾 **Automatic backups** — All changes backed up with one-click revert
- 📜 **Edit history** — Browse and restore previous versions

### Task Automation (New in beta)
- 🤖 **Multi-step task plans** — AI executes complex workflows:
  - Create, modify, delete, and move notes
  - Add wikilinks and tags
  - All with confirmation before execution
- 🗣️ **Natural language tasks** — Say "create a note about X" and it works
- 📊 **Task history view** — Browse past operations with rollback capability
- ↩️ **Full rollback support** — Undo entire task plans

### Context Management
- 📎 **Multi-file context** — Select multiple files for AI to reference
- 📏 **Token budget** — Visual indicator of context window usage
- 💡 **Smart suggestions** — AI recommends relevant linked files

## Prerequisites

You'll need **one** of the following:

### Option A: GitHub Models (Free Tier)

1. A GitHub account
2. A [Personal Access Token](https://github.com/settings/tokens) with **Models: Read** permission
3. (Optional) [1Password CLI](https://1password.com/downloads/command-line/) for secure token management

### Option B: GitHub Copilot CLI (Premium Models)

1. A GitHub Copilot Business or Enterprise licence
2. [GitHub Copilot CLI](https://github.com/github/copilot-cli) installed:
   - **macOS/Linux**: `brew install copilot-cli`
   - **Windows**: `winget install GitHub.Copilot`
   - **npm**: `npm install -g @github/copilot`
3. Authenticated via OAuth (run `copilot` and follow prompts) or via PAT with "Copilot Requests" permission

> **Note**: The older `gh copilot` extension has been deprecated in favour of the standalone `copilot` CLI.

## Installation

### From Community Plugins (Recommended)

> **Note**: This plugin is not yet available in the Obsidian Community Plugins directory. Once submitted and approved, you'll be able to install it directly from Obsidian.

1. Open Obsidian Settings → Community plugins
2. Click "Browse" and search for "Personal Assistant"
3. Click "Install" then "Enable"

### Manual Installation

Download the release zip and run the included installer:

```bash
# Download and extract
curl -L https://github.com/FredrikFolkeryd/obsidian-pa/releases/latest/download/obsidian-pa-latest.zip -o /tmp/obsidian-pa.zip
unzip -o /tmp/obsidian-pa.zip -d /tmp/

# Run installer (auto-detects your vaults)
/tmp/obsidian-pa/install.sh
```

The installer will auto-detect your Obsidian vaults and let you choose where to install.

#### Alternative: Manual copy

If you prefer to install manually:

1. Download `obsidian-pa-X.X.X.zip` from the [latest release](https://github.com/FredrikFolkeryd/obsidian-pa/releases/latest)
2. Extract the `obsidian-pa/` folder to `<your-vault>/.obsidian/plugins/`
3. Enable the plugin in Obsidian Settings → Community plugins

### Using BRAT (Beta Testing)

If you use the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) for beta testing:

1. Open BRAT settings
2. Click "Add Beta plugin"
3. Enter: `FredrikFolkeryd/obsidian-pa`

## Known Limitations

This is a **beta release** — core features are stable but some areas are still in development:

| Area | Status | Notes |
|------|--------|-------|
| **Windows support** | 🟡 Partial | macOS/Linux focus; Windows paths less tested |
| **Community Plugins** | 🔴 Pending | Not yet in official directory |
| **Mobile** | 🔴 Untested | Desktop-first development |
| **Link suggestions** | 🔵 Planned | AI-recommended connections |
| **Orphan detection** | 🔵 Planned | Find unlinked notes |

### What's Working Well

As of beta.1:

- ✅ **Full task automation** — AI can create, modify, delete, and organise notes
- ✅ **Natural language tasks** — "Create a note about X" just works
- ✅ **Task history with rollback** — Undo entire operations
- ✅ **Multi-file context** — AI references multiple notes at once
- ✅ **Streaming responses** — Real-time output with conversation persistence
- ✅ **Edit confirmations** — Diff preview before any changes
- ✅ **Automatic backups** — Every edit is backed up

### Safety Features

All write operations include:

- ✅ **Confirmation dialogs** — Review changes before applying
- ✅ **Diff previews** — See exactly what will change
- ✅ **Automatic backups** — Stored in `.pa-backups/` folder
- ✅ **One-click revert** — Restore any previous version
- ✅ **Audit logging** — All operations logged
- ✅ **Task approval** — Review multi-step plans before execution

## Development

### Prerequisites

- Node.js (v20 or later recommended)
- npm

### Setup

```bash
# Install dependencies
npm install

# Run in development mode with watch
npm run dev

# Run linting
npm run lint

# Run tests
npm run test

# Build for production
npm run build
```

### Tech Stack

- **Language**: TypeScript
- **Platform**: Obsidian Plugin API
- **Build**: esbuild
- **Testing**: Jest/Vitest
- **Linting**: ESLint with TypeScript rules

### Project Structure

```text
obsidian-pa/
├── .github/
│   ├── agents/           # AI agent definitions
│   ├── workflows/        # GitHub Actions CI/CD
│   └── copilot-instructions.md
├── src/
│   ├── main.ts          # Plugin entry point
│   ├── settings.ts      # Plugin settings
│   └── agents/          # Agent implementations
├── manifest.json        # Obsidian plugin manifest
├── package.json         # Node.js dependencies
├── tsconfig.json        # TypeScript configuration
└── esbuild.config.mjs   # Build configuration
```

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/) specification to enable semantic versioning.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## Development Values

This project follows IKEA values in development:

- **Simplicity**: Write clear, straightforward code; avoid over-engineering
- **Cost-consciousness**: Optimise for performance and bundle size
- **Renew and improve**: Continuously refactor and improve code quality
- **Give and take responsibility**: Each agent owns its domain; trust but verify

## Licence

[MIT](LICENSE)
