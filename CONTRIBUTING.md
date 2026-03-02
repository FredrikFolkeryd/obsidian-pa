# Contributing to Obsidian PA

Thank you for your interest in contributing to Obsidian PA! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We value caring for people—providing feedback that is both honest and supportive.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Create a new branch for your work: `git checkout -b feat/your-feature-name`

## Development Workflow

### Making Changes

1. Make your changes following the code style guidelines below
2. Write or update tests for your changes
3. Ensure all tests pass: `npm run test`
4. Ensure linting passes: `npm run lint`
5. Build the project: `npm run build`

### Commit Standards

All commits **must** follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or correcting tests
- `build`: Changes to build system or dependencies
- `ci`: Changes to CI configuration
- `chore`: Other changes that don't modify src or test files

**Examples:**

```bash
feat(settings): add configuration for agent timeout
fix(agent): resolve memory leak in long-running sessions
docs(readme): update installation instructions
test(processor): add unit tests for note parsing
```

## Code Style

### TypeScript Standards

- Use strict TypeScript mode
- Provide explicit return types on public methods
- Use interface-driven design for extensibility
- Add JSDoc comments for public APIs
- Prefer `const` over `let`, avoid `var`

### Obsidian Plugin Conventions

- Extend `Plugin` class for main entry point
- Use `PluginSettingTab` for settings UI
- Follow Obsidian API patterns for commands and events
- Clean up all resources in `onunload()`
- Register event handlers with `this.registerEvent()`

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Fill out the pull request template completely
3. Link any related issues
4. Wait for CI checks to pass
5. Request review from maintainers

### PR Checklist

Before submitting, verify:

- [ ] Code follows project style guidelines
- [ ] Tests written for new functionality
- [ ] All tests pass (`npm run test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Conventional commit messages used
- [ ] Documentation updated if needed

## Reporting Issues

### Using Issue Templates

This repository **requires** all issues to use a template. Follow these steps:

1. Go to [New Issue](https://github.com/FredrikFolkeryd/obsidian-pa/issues/new/choose) — this opens the **template chooser**
2. Select the appropriate template by clicking **Get started**
3. Fill in the form fields and click **Submit new issue**

> ⚠️ Do not navigate directly to `/issues/new` — GitHub will block the submission because blank issues are disabled.

### Available Templates

| Template | Use when |
|----------|----------|
| 🐛 **Bug Report** | Something is not working as expected |
| ✨ **Feature Request** | You want to suggest a new feature or improvement |
| 🗂️ **Task** | Maintainers only — internal project tasks |

The **Task** template is restricted to project maintainers. Non-maintainer submissions using the Task template are automatically closed by a bot.

### What to Include

**Bug reports** should include:

- Clear description of the problem and steps to reproduce
- What you expected to happen
- Any screenshots or error logs from the developer console

**Feature requests** should include:

- A description of the feature you'd like
- Why it would be useful and what problem it solves

### Labels

Labels are applied automatically based on the template selected. You do not need to apply labels manually.

## Security

- **Never** commit secrets, API keys, or credentials
- Report security vulnerabilities privately to the maintainers
- Verify licence compliance when adding dependencies
- Avoid `AGPL-3.0` and other strong reciprocal licences

## Questions?

If you have questions about contributing, feel free to open an issue with the `question` label.
