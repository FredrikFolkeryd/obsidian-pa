---
name: licence-check
description: >
  Provides guidance for dependency licence compliance checking per EA-09.
  Use this skill when adding new dependencies to ensure they use approved
  licences and avoid problematic reciprocal licences.

  Covers licence categories, checking procedures, and compliance requirements.
---

# Licence Compliance Check

## Purpose

This skill ensures all dependencies comply with licence requirements per EA-09, preventing the introduction of problematic licences that could affect project distribution.

## Licence Categories

### ✅ Approved Licences (Preferred)

These permissive licences are safe for use:

| Licence | SPDX ID | Notes |
| ------- | ------- | ----- |
| MIT | `MIT` | Most permissive, preferred |
| Apache 2.0 | `Apache-2.0` | Permissive with patent grant |
| BSD 2-Clause | `BSD-2-Clause` | Permissive |
| BSD 3-Clause | `BSD-3-Clause` | Permissive with non-endorsement |
| ISC | `ISC` | Functionally equivalent to MIT |
| CC0 | `CC0-1.0` | Public domain dedication |
| Unlicense | `Unlicense` | Public domain equivalent |
| 0BSD | `0BSD` | Zero-clause BSD |

### ⚠️ Caution Licences (Review Required)

These require additional review before use:

| Licence | SPDX ID | Concern |
| ------- | ------- | ------- |
| LGPL 2.1 | `LGPL-2.1` | Copyleft for library modifications |
| LGPL 3.0 | `LGPL-3.0` | Copyleft for library modifications |
| MPL 2.0 | `MPL-2.0` | File-level copyleft |
| EPL 1.0 | `EPL-1.0` | Weak copyleft |
| EPL 2.0 | `EPL-2.0` | Weak copyleft |
| CC-BY | `CC-BY-4.0` | Attribution required |

**Review Criteria:**

- Is the dependency used at runtime or build-time only?
- Are we modifying the dependency source?
- How is the dependency distributed (bundled vs. separate)?

### ❌ Prohibited Licences (Must Avoid)

These licences are incompatible with this project:

| Licence | SPDX ID | Reason |
| ------- | ------- | ------ |
| GPL 2.0 | `GPL-2.0` | Strong copyleft, viral |
| GPL 3.0 | `GPL-3.0` | Strong copyleft, viral |
| AGPL 3.0 | `AGPL-3.0` | Network copyleft, most restrictive |
| SSPL | `SSPL-1.0` | Service copyleft |
| CC-BY-NC | `CC-BY-NC-*` | Non-commercial restriction |
| CC-BY-ND | `CC-BY-ND-*` | No derivatives restriction |
| Proprietary | Various | No redistribution rights |

## Checking Procedures

### Before Adding a Dependency

1. **Check the licence** in the package's `package.json` or repository
2. **Verify the SPDX identifier** matches an approved licence
3. **Check transitive dependencies** for licence compliance
4. **Document the decision** if adding a caution-category licence

### Using npm to Check Licences

```bash
# Check licence of a specific package
npm view <package-name> license

# Check all dependencies (requires license-checker)
npx license-checker --summary

# Check for problematic licences
npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"

# Generate licence report
npx license-checker --csv > licences.csv
```

### Using Package.json License Field

```json
{
  "name": "obsidian-pa",
  "license": "MIT",
  "dependencies": {
    "safe-package": "^1.0.0"
  }
}
```

## Automated Checking

### Pre-commit Check Script

```bash
#!/bin/bash
# scripts/check-licences.sh

echo "Checking dependency licences..."

PROHIBITED="GPL-2.0;GPL-3.0;AGPL-3.0;SSPL"

npx license-checker --failOn "$PROHIBITED" --production

if [ $? -ne 0 ]; then
  echo "❌ Prohibited licence detected!"
  echo "Please remove the dependency or find an alternative."
  exit 1
fi

echo "✅ All licences are compliant"
```

### GitHub Actions Check

```yaml
# .github/workflows/licence-check.yml
name: Licence Check

on:
  pull_request:
    paths:
      - 'package.json'
      - 'package-lock.json'

jobs:
  check-licences:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Check licences
        run: npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
```

## Handling Licence Issues

### Finding Alternatives

When a needed package has a prohibited licence:

1. **Search for alternatives** on npm with similar functionality
2. **Check if dual-licensed** - some packages offer MIT + GPL
3. **Consider implementing** the functionality yourself (if small)
4. **Request licence exception** with documented justification

### Documenting Exceptions

If a caution-category licence must be used, document it:

```markdown
## Licence Exception: package-name

**Package:** package-name@1.2.3
**Licence:** LGPL-2.1
**Justification:** Required for X functionality, no MIT alternatives exist
**Usage:** Used only at build time, not bundled in distribution
**Approved by:** [name/date]
**Review date:** [next review date]
```

## Transitive Dependencies

### Checking Deep Dependencies

```bash
# Check all dependencies including transitive
npx license-checker --production

# Generate dependency tree with licences
npm ls --all

# Check specific package's dependencies
npm ls <package-name>
```

### Handling Transitive Violations

If a transitive dependency has a prohibited licence:

1. **Check if avoidable** - Is there an alternative to the parent package?
2. **Check if runtime** - Build-time only dependencies may be acceptable
3. **Check if bundled** - Non-bundled dependencies may have different requirements
4. **Open an issue** with the parent package requesting an alternative

## Obsidian-Specific Considerations

### Obsidian API

The Obsidian API (`obsidian` package) is proprietary but explicitly allows plugin development:

- ✅ OK to use Obsidian types and API
- ✅ OK to distribute plugins that use Obsidian API
- ❌ Cannot redistribute Obsidian itself
- ❌ Cannot include Obsidian source code

### Bundling

When bundling with esbuild:

- Dependencies are included in the bundle
- Licence compliance applies to all bundled code
- Consider adding LICENCE file with attribution for dependencies

## Quick Reference

### Safe to Add

```bash
# These are always safe
npm install lodash          # MIT
npm install moment          # MIT
npm install axios           # MIT
npm install uuid            # MIT
```

### Always Check First

```bash
# Always verify licence before adding
npm view <package> license
```

### Never Add

```bash
# Avoid packages with these licences
# GPL-2.0, GPL-3.0, AGPL-3.0, SSPL
```

## Compliance Checklist

Before merging changes that add dependencies:

- [ ] New dependency licence checked and approved
- [ ] Transitive dependencies checked
- [ ] No GPL/AGPL/SSPL licences introduced
- [ ] Caution-category licences documented and justified
- [ ] package-lock.json reviewed for new additions
