# Obsidian PA

[![CI](https://github.com/FredrikFolkeryd/obsidian-pa/actions/workflows/ci.yml/badge.svg)](https://github.com/FredrikFolkeryd/obsidian-pa/actions/workflows/ci.yml)

An Obsidian plugin that provides an agentic interface to leverage AI agents within your Obsidian vault.

> ⚠️ **Alpha Release** — This plugin is in early development. See [Known Limitations](#known-limitations) below.

## Overview

Obsidian PA enables users to interact with AI capabilities directly in their note-taking workflow, bringing agentic development practices to personal knowledge management.

**Developer**: Fredrik Folkeryd  
**Organisation Context**: Built using models from Ingka Group Digital as personal upskilling on agentic development.

## Features

- Seamless AI integration within Obsidian
- Agentic workflow support
- **Two provider options:**
  - **GitHub Models** (free tier) — GPT-4o, Llama, Mistral, and more
  - **GitHub Copilot CLI** — Premium models like Claude Opus 4.5 and o1 for Copilot Business/Enterprise users
- Secure credential management via 1Password CLI or direct entry
- Folder-based data sharing controls (opt-in or opt-out)
- Built with TypeScript for type safety and maintainability

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

**Alternative: Manual copy**

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

This is an **alpha release** with the following limitations:

| Limitation | Status | Planned |
|------------|--------|---------|
| **Read-only access** | AI can read notes but cannot edit them | Phase 1.1 |
| **Single-file context** | AI only sees the currently open note | Phase 1.2 |
| **macOS/Linux focus** | Windows paths less tested | Ongoing |
| **Manual installation** | Not yet in Community Plugins | Future |

### What's Working Well

As of alpha.3:
- ✅ **Streaming responses** — See AI output in real-time with blinking cursor
- ✅ **Conversation persistence** — Chat history survives Obsidian restarts
- ✅ **Export conversations** — Copy to clipboard as markdown
- ✅ **Stop requests** — Cancel in-progress AI requests

### Why Read-Only?

The AI currently operates in **read-only mode** for safety. It can:
- ✅ Read notes in your allowed folders
- ✅ Answer questions about your content
- ✅ Suggest edits (you copy/paste manually)

It cannot:
- ❌ Modify, create, or delete notes
- ❌ Execute commands in your vault

Write support is planned for Phase 1.1 with safety features including confirmation dialogs, automatic backups, and audit logging.

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

## Development Values

This project follows IKEA values in development:

- **Simplicity**: Write clear, straightforward code; avoid over-engineering
- **Cost-consciousness**: Optimise for performance and bundle size
- **Renew and improve**: Continuously refactor and improve code quality
- **Give and take responsibility**: Each agent owns its domain; trust but verify

## Licence

[MIT](LICENSE)
