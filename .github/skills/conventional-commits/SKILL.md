---
name: conventional-commits
description: >
  Provides guidance and validation for Conventional Commits format. Use this skill
  when creating commit messages to ensure they conform to the project's semantic
  versioning requirements.

  All commits must follow the Conventional Commits specification to enable
  automated changelog generation and semantic versioning.
---

# Conventional Commits

## Purpose

This skill ensures all commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification, enabling semantic versioning and automated changelog generation.

## Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types

| Type | Description | Semver Impact |
|------|-------------|---------------|
| `feat` | A new feature | Minor (0.x.0) |
| `fix` | A bug fix | Patch (0.0.x) |
| `docs` | Documentation only changes | None |
| `style` | Code style changes (formatting, semicolons, etc.) | None |
| `refactor` | Code changes that neither fix bugs nor add features | None |
| `perf` | Performance improvements | Patch (0.0.x) |
| `test` | Adding or correcting tests | None |
| `build` | Changes to build system or dependencies | None |
| `ci` | Changes to CI configuration | None |
| `chore` | Other changes that don't modify src or test files | None |

## Breaking Changes

Breaking changes trigger a major version bump (x.0.0) and can be indicated in two ways:

1. **Footer notation:**
   ```
   feat: allow provided config object to extend other configs

   BREAKING CHANGE: `extends` key in config file is now used for extending other config files
   ```

2. **Type with `!`:**
   ```
   feat!: remove deprecated API endpoints
   ```

## Scopes

Scopes provide additional context about what part of the codebase is affected:

| Scope | Description |
|-------|-------------|
| `settings` | Plugin settings and configuration |
| `agent` | Agent-related functionality |
| `ui` | User interface components |
| `api` | API integrations |
| `vault` | Vault interactions |
| `commands` | Obsidian commands |

## Examples

### Features

```bash
feat(settings): add configuration for agent timeout
feat(agent): implement streaming responses
feat!: redesign settings UI with breaking API changes
```

### Bug Fixes

```bash
fix(agent): resolve memory leak in long-running sessions
fix(ui): correct modal positioning on mobile
fix: handle null vault reference gracefully
```

### Documentation

```bash
docs(readme): update installation instructions
docs: add API reference for AgentService
```

### Refactoring

```bash
refactor(ui): extract modal into separate component
refactor: simplify note parsing logic
```

### Tests

```bash
test(processor): add unit tests for note parsing
test: increase coverage for settings module
```

### Build & CI

```bash
build: upgrade esbuild to v0.20
ci: add Node.js 22 to test matrix
chore: update development dependencies
```

## Validation Rules

A valid commit message must:

1. **Start with a type** from the allowed list
2. **Use lowercase** for type and scope
3. **Not end with a period** in the description
4. **Use imperative mood** ("add" not "added" or "adds")
5. **Keep first line under 72 characters**
6. **Separate body from subject with blank line** (if body present)

## Common Mistakes

❌ **Wrong:**
```bash
Added new feature for settings
Fix: resolved the bug
feat(Settings): Add timeout config.
FEAT: new feature
```

✅ **Correct:**
```bash
feat(settings): add timeout configuration
fix: resolve null reference in agent service
feat(settings): add timeout config
feat: add streaming response support
```

## Rebasing Plan Commits

If an agent creates an "Initial plan" commit during work planning, it **must** be interactively rebased into the next real commit:

```bash
git rebase -i HEAD~2
# Change 'pick' to 'fixup' for the plan commit
```

This preserves conventional commit compliance in the history.

## Git Hooks

Consider adding a commit-msg hook to validate commits:

```bash
#!/bin/sh
# .git/hooks/commit-msg
commit_regex='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?(!)?: .{1,72}$'

if ! grep -qE "$commit_regex" "$1"; then
    echo "ERROR: Commit message does not follow Conventional Commits format"
    echo "Expected: <type>[scope]: <description>"
    exit 1
fi
```
