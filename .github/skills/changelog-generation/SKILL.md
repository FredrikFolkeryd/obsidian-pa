---
name: changelog-generation
description: >
  Provides guidance for automated changelog generation from conventional commits.
  Use this skill to understand how changelogs are generated, configured, and
  maintained for releases.

  Requires conventional commits to be consistently used throughout the project.
---

# Changelog Generation

## Purpose

This skill enables automated changelog generation from conventional commits, providing clear release notes for users and maintaining a project history.

## Prerequisites

- All commits follow [Conventional Commits](https://www.conventionalcommits.org/) format
- Git tags follow semantic versioning (e.g., `v1.0.0`)
- Node.js and npm available

## Quick Start

### Generate Changelog

```bash
# Install standard-version (one-time)
npm install --save-dev standard-version

# Add to package.json scripts
{
  "scripts": {
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major"
  }
}

# Run to generate changelog and bump version
npm run release
```

## Changelog Format

### Generated Structure

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0](https://github.com/user/repo/compare/v1.1.0...v1.2.0) (2026-01-31)

### Features

* **settings:** add configuration for agent timeout ([abc1234](https://github.com/user/repo/commit/abc1234))
* **agent:** implement streaming responses ([def5678](https://github.com/user/repo/commit/def5678))

### Bug Fixes

* **ui:** correct modal positioning on mobile ([ghi9012](https://github.com/user/repo/commit/ghi9012))
* handle null vault reference gracefully ([jkl3456](https://github.com/user/repo/commit/jkl3456))

## [1.1.0](https://github.com/user/repo/compare/v1.0.0...v1.1.0) (2026-01-15)

### Features

* initial agent implementation ([mno7890](https://github.com/user/repo/commit/mno7890))
```

### Commit Type to Section Mapping

| Commit Type | Changelog Section | Included |
| ----------- | ----------------- | -------- |
| `feat` | Features | ✅ Yes |
| `fix` | Bug Fixes | ✅ Yes |
| `perf` | Performance Improvements | ✅ Yes |
| `revert` | Reverts | ✅ Yes |
| `docs` | Documentation | ❌ No (by default) |
| `style` | Styles | ❌ No |
| `refactor` | Code Refactoring | ❌ No (by default) |
| `test` | Tests | ❌ No |
| `build` | Build System | ❌ No |
| `ci` | CI | ❌ No |
| `chore` | Chores | ❌ No |

## Configuration

### .versionrc.json

Create this file for custom configuration:

```json
{
  "types": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "revert", "section": "Reverts" },
    { "type": "docs", "section": "Documentation", "hidden": false },
    { "type": "refactor", "section": "Code Refactoring", "hidden": false },
    { "type": "style", "section": "Styles", "hidden": true },
    { "type": "chore", "section": "Maintenance", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "build", "section": "Build System", "hidden": true },
    { "type": "ci", "section": "CI/CD", "hidden": true }
  ],
  "commitUrlFormat": "https://github.com/FredrikFolkeryd/obsidian-pa/commit/{{hash}}",
  "compareUrlFormat": "https://github.com/FredrikFolkeryd/obsidian-pa/compare/{{previousTag}}...{{currentTag}}",
  "issueUrlFormat": "https://github.com/FredrikFolkeryd/obsidian-pa/issues/{{id}}",
  "userUrlFormat": "https://github.com/{{user}}",
  "releaseCommitMessageFormat": "chore(release): {{currentTag}}",
  "header": "# Changelog\n\nAll notable changes to this project will be documented in this file.\n"
}
```

### Package.json Configuration

```json
{
  "name": "obsidian-pa",
  "version": "0.1.0",
  "scripts": {
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major",
    "release:patch": "standard-version --release-as patch",
    "release:dry-run": "standard-version --dry-run",
    "release:first": "standard-version --first-release"
  },
  "devDependencies": {
    "standard-version": "^9.5.0"
  }
}
```

## Workflow

### Standard Release Process

```bash
# 1. Ensure all changes are committed with conventional commits
git log --oneline -10

# 2. Preview what will happen (dry run)
npm run release:dry-run

# 3. Generate changelog and bump version
npm run release

# 4. Push changes and tags
git push --follow-tags origin main
```

### First Release

```bash
# For the very first release (no previous tags)
npm run release:first
```

### Pre-release Versions

```bash
# Alpha release
npx standard-version --prerelease alpha
# Result: 1.0.0 → 1.0.1-alpha.0

# Beta release
npx standard-version --prerelease beta
# Result: 1.0.0 → 1.0.1-beta.0

# Release candidate
npx standard-version --prerelease rc
# Result: 1.0.0 → 1.0.1-rc.0
```

### Force Specific Version

```bash
# Force a specific version
npx standard-version --release-as 2.0.0
```

## Breaking Changes

### In Commit Message

```bash
# Method 1: Footer
git commit -m "feat: redesign settings UI

BREAKING CHANGE: Settings API has changed. The `timeout` setting
is now specified in seconds instead of milliseconds."

# Method 2: Type with !
git commit -m "feat!: remove deprecated API endpoints"
```

### In Changelog

Breaking changes appear prominently:

```markdown
## [2.0.0](link) (2026-01-31)

### ⚠ BREAKING CHANGES

* **settings:** Settings API has changed. The `timeout` setting
  is now specified in seconds instead of milliseconds.

### Features

* **settings:** redesign settings UI ([abc1234](link))
```

## GitHub Actions Integration

### Automated Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Generate changelog and bump version
        run: npm run release

      - name: Push changes
        run: git push --follow-tags origin main
```

### Manual Release Workflow

```yaml
# .github/workflows/manual-release.yml
name: Manual Release

on:
  workflow_dispatch:
    inputs:
      release-type:
        description: 'Release type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Generate release
        run: npm run release:${{ inputs.release-type }}

      - name: Push changes
        run: git push --follow-tags origin main
```

## Obsidian Plugin Considerations

### Manifest Synchronisation

The Obsidian plugin requires version updates in multiple files:

```json
// package.json
{ "version": "1.2.0" }

// manifest.json
{ "version": "1.2.0" }

// versions.json (for compatibility)
{ "1.2.0": "0.15.0" }
```

### Custom Bump Script

```javascript
// .versionrc.js
module.exports = {
  bumpFiles: [
    { filename: 'package.json', type: 'json' },
    { filename: 'package-lock.json', type: 'json' },
    { filename: 'manifest.json', type: 'json' }
  ],
  // ... other config
};
```

## Best Practices

1. **Commit consistently** - Every meaningful change gets a conventional commit
2. **Scope appropriately** - Use scopes to categorize changes
3. **Write good descriptions** - Commit messages become changelog entries
4. **Mark breaking changes** - Always use `BREAKING CHANGE:` or `!`
5. **Review before release** - Run `--dry-run` first
6. **Tag releases** - Let the tool create tags automatically
7. **Keep changelog in repo** - CHANGELOG.md should be committed

## Checklist

Before release:

- [ ] All changes have conventional commit messages
- [ ] Breaking changes are marked appropriately
- [ ] Dry run reviewed and looks correct
- [ ] Version in manifest.json will be updated

After release:

- [ ] CHANGELOG.md updated and committed
- [ ] Git tag created
- [ ] Changes pushed to remote
- [ ] GitHub release created (if applicable)
