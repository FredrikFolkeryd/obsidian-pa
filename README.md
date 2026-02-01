# Obsidian PA

An Obsidian plugin that provides an agentic interface to leverage AI agents within your Obsidian vault.

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
2. [GitHub CLI](https://cli.github.com/) installed
3. Authenticated with: `gh auth login`
4. Copilot extension installed: `gh extension install github/gh-copilot`

## Installation

### From Source

1. Clone this repository into your vault's `.obsidian/plugins/` directory:

   ```bash
   cd /path/to/your/vault/.obsidian/plugins
   git clone https://github.com/FredrikFolkeryd/obsidian-pa.git
   cd obsidian-pa
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the plugin:

   ```bash
   npm run build
   ```

4. Enable the plugin in Obsidian:
   - Open Settings → Community plugins
   - Enable "Obsidian PA"

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
