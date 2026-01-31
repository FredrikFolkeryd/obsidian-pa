# Release Process

This document describes how releases are created for obsidian-pa.

## Release Types

### Pre-release (alpha/beta)

Pre-releases are for testing and early feedback. They are created automatically with version suffixes like `1.0.0-alpha.1`.

**Who can create:** Repository admins and maintainers

**Requirements:** None (used for exploratory testing)

### Full Release

Full releases are stable versions intended for general use. They require passing release criteria checks.

**Who can create:** Repository admins and maintainers (with production environment approval)

**Requirements:**
- All tests pass
- Lint passes
- README.md exists
- Security audit reviewed
- Production environment approval (if configured)

## Creating a Release

### Via GitHub Actions (Recommended)

1. Go to **Actions** → **Create Release**
2. Click **Run workflow**
3. Select release type:
   - `pre-release` — Creates an alpha version (default)
   - `release` — Creates a stable version (requires criteria checks)
4. Optionally override the version (leave empty for auto-increment)
5. Click **Run workflow**

The version is automatically computed from conventional commits:
- `feat!:` or `BREAKING CHANGE` → Major bump (1.0.0 → 2.0.0)
- `feat:` → Minor bump (1.0.0 → 1.1.0)
- `fix:`, `perf:` → Patch bump (1.0.0 → 1.0.1)

### Via Local Script (Development)

For local testing only:

```bash
# Create a local package
./scripts/package.sh

# Create and install to a vault
./scripts/package.sh /path/to/your/vault
```

## Repository Setup

To enable release protection, configure these GitHub environments:

### 1. Create `staging` Environment

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `staging`
4. No protection rules needed (for pre-releases)

### 2. Create `production` Environment

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `production`
4. Enable **Required reviewers** and add yourself or a team
5. This ensures full releases require explicit approval

### 3. Branch Protection (Recommended)

1. Go to **Settings** → **Branches**
2. Add rule for `main`:
   - Require status checks to pass
   - Require pull request reviews
   - Restrict who can push

## Version History

See [versions.json](../versions.json) for the mapping of plugin versions to minimum Obsidian versions.

## Troubleshooting

### "User does not have permission to create releases"

Only users with `admin` or `maintain` permission can trigger releases. Check your repository role in Settings → Collaborators.

### "Environment 'production' not found"

Create the `production` environment in Settings → Environments before creating full releases.

### Version not incrementing correctly

Ensure your commits follow [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat: add new feature`
- `fix: resolve bug`
- `feat!: breaking change`
