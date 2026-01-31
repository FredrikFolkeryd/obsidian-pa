# Obsidian PA

An Obsidian plugin that provides an agentic interface to leverage AI agents within your Obsidian vault.

## Overview

Obsidian PA enables users to interact with AI capabilities directly in their note-taking workflow, bringing agentic development practices to personal knowledge management.

**Developer**: Fredrik Folkeryd  
**Organisation Context**: Built using models from Ingka Group Digital as personal upskilling on agentic development.

## Features

- Seamless AI integration within Obsidian
- Agentic workflow support
- Built with TypeScript for type safety and maintainability

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

```
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
