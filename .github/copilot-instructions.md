# Copilot Instructions

## Overview

This is an Obsidian plugin that provides an agentic interface to leverage AI agents within an Obsidian vault. The plugin enables users to interact with AI capabilities directly in their note-taking workflow.

**Developer**: Fredrik Folkeryd  
**Organisation Context**: Built using models from Ingka Group Digital as personal upskilling on agentic development.

### Safety Rules

- **Never** commit secrets, API keys, or credentials to the repository
- **Never** execute destructive commands without explicit user confirmation
- **Always** read relevant agent files before starting work
- **Respect** copyright - do not generate copyrighted content
- **Reference**: [Awesome Copilot](https://github.com/github/awesome-copilot) for patterns and best practices

## General Rules

### Commit Standards

All commits **must** conform to [Conventional Commits](https://www.conventionalcommits.org/) to enable semantic versioning:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

**Important**: If an agent creates an "Initial plan" commit, that commit **must** be interactively rebased into the next real commit to preserve conventional commit compliance in the history.

### Development Environment

- Node.js with TypeScript (Obsidian plugin standard)
- ESLint for linting
- Jest or Vitest for testing
- esbuild for bundling

### IKEA Values in Development

- **Simplicity**: Write clear, straightforward code; avoid over-engineering
- **Cost-consciousness**: Optimise for performance and bundle size
- **Renew and improve**: Continuously refactor and improve code quality
- **Give and take responsibility**: Each agent owns its domain; trust but verify

## Tech Stack

- **Language**: TypeScript
- **Platform**: Obsidian Plugin API
- **Build**: esbuild (Obsidian standard)
- **Testing**: Jest/Vitest
- **Linting**: ESLint with TypeScript rules

## Project Structure

```
obsidian-pa/
├── .github/
│   ├── agents/           # AI agent definitions
│   ├── workflows/        # GitHub Actions
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

## Agents

### Core Agents

Create these agents in `.github/agents/` as the project develops:

| Agent | Purpose |
|-------|---------|
| `team-lead.md` | Work planning, issue triage, milestone tracking |
| `architect.md` | Technical design, architecture decisions, API design |
| `developer.md` | Code implementation, bug fixes, feature development |
| `review.md` | Code review, quality checks, standards enforcement |

### Specialised Agents

| Agent | Purpose |
|-------|---------|
| `docs.md` | Documentation, README updates, user guides |
| `test.md` | Test writing, coverage analysis, test strategy |
| `pa.md` | End-user personal assistant, user interaction, bug/enhancement reporting |

## Workflows

### Bug Report → Fix

1. **Planning**: `@team-lead` analyses the bug, creates investigation plan
2. **Analysis**: `@architect` reviews code paths, identifies root cause
3. **Implementation**: `@developer` implements fix following the plan
4. **Review**: `@review` validates fix quality and test coverage

### Feature Request → Implementation

1. **Planning**: `@team-lead` breaks down feature into tasks
2. **Design**: `@architect` creates technical design with concrete steps
3. **Implementation**: `@developer` implements each task sequentially
4. **Review**: `@review` validates implementation against design

### Pull Request Review

1. **Triage**: `@team-lead` assesses scope and impact
2. **Technical Review**: `@architect` validates design decisions
3. **Code Review**: `@review` checks code quality and standards

### Critical Rule: Two-Shot Pattern

All workflows follow the **planning → implementation** pattern:

1. **Planning Phase**: Results in concrete, unambiguous steps. No optionality. Any ambiguity must be resolved with user input BEFORE implementation.
2. **Implementation Phase**: Execute the plan exactly as documented.

## Code Style

### TypeScript Standards

- Strict TypeScript mode enabled
- Explicit return types on public methods
- Interface-driven design for extensibility
- JSDoc comments for public APIs

### Obsidian Plugin Conventions

- Extend `Plugin` class for main entry point
- Use `PluginSettingTab` for settings UI
- Follow Obsidian API patterns for commands and events
- Clean up resources in `onunload()`

### Quality Checks

- ESLint must pass with no errors
- All tests must pass before merge
- Bundle size should be monitored

## Collaboration

### Human-AI Workflow

1. **Verify understanding** before implementing changes
2. **Track work** in issues and commits
3. **Pause for confirmation** on destructive or irreversible operations
4. **Document decisions** in commit messages and PR descriptions

### Communication

- Be concise and direct
- Reference specific files and line numbers
- Explain the "why" behind suggestions
- Flag uncertainties explicitly

## Work Management

### Issue Tracking

Use GitHub Issues for all work items with labels:

- `bug`: Something isn't working
- `enhancement`: New feature or improvement
- `documentation`: Documentation updates
- `question`: Further information needed

### Milestones

Track progress using GitHub Milestones aligned with semantic versioning.

## Engineering Standards (Ingka Baseline)

This project follows relevant Ingka Engineering Baseline ADRs:

| ADR | Requirement |
|-----|-------------|
| EA-01 | Source code managed in GitHub |
| EA-02 | Defined test strategy with change management |
| EA-09 | Open source licence compliance checks |
| EA-10 | Technical documentation following OSPO guidelines |

### Security & Privacy

- No hardcoded secrets or credentials
- Dependencies must be vetted for licence compliance
- Avoid `AGPL-3.0` and other strong reciprocal licences
- Prefer permissive licences (MIT, Apache-2.0, BSD)

## Resources

- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Awesome Copilot](https://github.com/github/awesome-copilot)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
