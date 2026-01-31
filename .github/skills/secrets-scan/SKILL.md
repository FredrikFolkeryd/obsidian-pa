---
name: secrets-scan
description: >
  Provides guidance for preventing credential exposure in code per EA-07.
  Use this skill to understand what constitutes a secret, how to detect
  accidental exposure, and secure alternatives for credential management.

  Covers detection patterns, prevention strategies, and remediation steps.
---

# Secrets Scanning

## Purpose

This skill prevents accidental credential exposure in the repository, ensuring compliance with EA-07 (Secrets Management) and protecting user security.

## What Counts as a Secret?

### Definitely Secrets (Never Commit)

| Type | Pattern Examples | Risk |
|------|------------------|------|
| API Keys | `sk-`, `pk_live_`, `AKIA` | Full account access |
| PATs | `ghp_`, `gho_`, `ghu_` | Repository/org access |
| OAuth Tokens | Long base64 strings | Application access |
| Private Keys | `-----BEGIN.*PRIVATE KEY-----` | Authentication bypass |
| Passwords | In config files, env samples | Account compromise |
| Database URLs | `postgres://user:pass@`, `mongodb+srv://` | Data breach |
| AWS Credentials | `AKIA`, `aws_secret_access_key` | Cloud infrastructure |
| Webhook URLs | Slack, Discord with tokens | Service abuse |

### Potentially Sensitive (Review Carefully)

| Type | Context |
|------|---------|
| Internal URLs | May reveal infrastructure |
| Email addresses | PII considerations |
| IP addresses | Internal network info |
| Usernames | Enumeration risk |
| File paths | System info disclosure |

## Common Secret Patterns

### GitHub Tokens

```regex
# GitHub Personal Access Token (classic)
ghp_[a-zA-Z0-9]{36}

# GitHub Personal Access Token (fine-grained)
github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}

# GitHub OAuth Access Token
gho_[a-zA-Z0-9]{36}

# GitHub User-to-Server Token
ghu_[a-zA-Z0-9]{36}

# GitHub Server-to-Server Token
ghs_[a-zA-Z0-9]{36}

# GitHub Refresh Token
ghr_[a-zA-Z0-9]{36}
```

### API Keys

```regex
# Generic API key patterns
[aA][pP][iI]_?[kK][eE][yY].*['\"][a-zA-Z0-9]{20,}['\"]
[aA][pP][iI]_?[sS][eE][cC][rR][eE][tT].*['\"][a-zA-Z0-9]{20,}['\"]

# OpenAI
sk-[a-zA-Z0-9]{48}

# Stripe
sk_live_[a-zA-Z0-9]{24}
pk_live_[a-zA-Z0-9]{24}

# AWS
AKIA[A-Z0-9]{16}
```

### Private Keys

```regex
-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----
-----BEGIN PGP PRIVATE KEY BLOCK-----
```

### Connection Strings

```regex
# Database connection strings
(postgres|mysql|mongodb)(\+srv)?:\/\/[^:]+:[^@]+@
(redis|amqp):\/\/[^:]+:[^@]+@
```

## Prevention Strategies

### 1. Git Hooks (Pre-commit)

Install git-secrets or similar:

```bash
# Install git-secrets
brew install git-secrets

# Configure for this repo
cd /path/to/repo
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'ghp_[a-zA-Z0-9]{36}'
git secrets --add 'sk-[a-zA-Z0-9]{48}'
```

### 2. .gitignore Sensitive Files

```gitignore
# Environment files
.env
.env.local
.env.*.local
*.env

# Credential files
.credentials
*.pem
*.key
*_rsa
*_dsa
*_ecdsa
*_ed25519

# IDE settings with potential secrets
.idea/
.vscode/settings.json

# OS files
.DS_Store
Thumbs.db
```

### 3. Pre-commit Hook Script

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Patterns to detect
PATTERNS=(
  'ghp_[a-zA-Z0-9]{36}'
  'gho_[a-zA-Z0-9]{36}'
  'sk-[a-zA-Z0-9]{48}'
  'AKIA[A-Z0-9]{16}'
  '-----BEGIN.*PRIVATE KEY-----'
  'password\s*=\s*["\047][^"\047]+'
  'api_key\s*=\s*["\047][^"\047]+'
)

# Check staged files
STAGED=$(git diff --cached --name-only)

for file in $STAGED; do
  if [ -f "$file" ]; then
    for pattern in "${PATTERNS[@]}"; do
      if grep -qE "$pattern" "$file"; then
        echo "❌ Potential secret detected in: $file"
        echo "   Pattern: $pattern"
        echo ""
        echo "If this is a false positive, you can:"
        echo "  git commit --no-verify"
        echo ""
        echo "But first, verify it's not a real secret!"
        exit 1
      fi
    done
  fi
done

echo "✅ No secrets detected"
exit 0
```

### 4. GitHub Actions Workflow

```yaml
# .github/workflows/secrets-scan.yml
name: Secrets Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified
```

## Secure Credential Storage

### For Development

```typescript
// ❌ NEVER: Hardcoded credentials
const token = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// ❌ NEVER: Credentials in settings (persisted to disk)
this.settings.apiToken = token;

// ✅ PREFERRED: System keychain
import { keytar } from 'keytar';
const token = await keytar.getPassword('obsidian-pa', 'github-token');

// ✅ ACCEPTABLE: Environment variable
const token = process.env.GITHUB_TOKEN;

// ✅ GOOD: 1password CLI integration
import { exec } from 'child_process';
const token = await exec('op read "op://Vault/GitHub/token"');
```

### For CI/CD

```yaml
# Use GitHub Secrets
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# Never echo or log secrets
- run: echo "Token is ${{ secrets.API_KEY }}"  # ❌ NEVER
- run: ./script.sh                              # ✅ Script uses env var internally
```

## Remediation Steps

### If a Secret Was Committed

1. **Revoke the credential immediately**
   - GitHub: Settings → Developer settings → Personal access tokens → Revoke
   - Other services: Revoke/regenerate in their settings

2. **Remove from Git history**
   ```bash
   # Using git-filter-repo (recommended)
   pip install git-filter-repo
   git filter-repo --invert-paths --path <file-with-secret>

   # Force push (coordinate with team first!)
   git push origin --force --all
   git push origin --force --tags
   ```

3. **Generate new credentials**
   - Create new token/key with same permissions
   - Store securely (not in repo)
   - Update applications using the credential

4. **Audit for exposure**
   - Check if the secret was used maliciously
   - Review logs for unauthorized access
   - Consider the secret compromised even if quickly removed

### If False Positive

If the scanner flags something that isn't a secret:

1. **Verify it's truly not sensitive**
2. **Add to allowlist** (if your tool supports it)
3. **Add inline ignore comment** (if supported)

```bash
# Example: gitleaks ignore
# gitleaks:allow

# Example: git-secrets exception
git secrets --add --allowed 'example-api-key-for-tests'
```

## Safe Patterns for Documentation

When documenting API usage:

```typescript
// ✅ Use placeholder tokens
const token = 'your-token-here';
const token = '<YOUR_API_TOKEN>';
const token = process.env.API_TOKEN;

// ✅ Use obviously fake values
const apiKey = 'sk-test-xxxxxxxxxxxxxxxxxxxx';
const password = 'example-password-do-not-use';

// ❌ Never use realistic-looking values
const token = 'ghp_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8';
```

## Checklist

Before committing:

- [ ] No API keys or tokens in code
- [ ] No passwords in configuration files
- [ ] No private keys committed
- [ ] No database connection strings with credentials
- [ ] Environment files are gitignored
- [ ] Test credentials are obviously fake
- [ ] Pre-commit hooks installed and running

After discovering exposed secret:

- [ ] Credential immediately revoked
- [ ] History cleaned (if necessary)
- [ ] New credential generated
- [ ] Stored securely (not in repo)
- [ ] Audit completed for misuse
