# Security Policy

## Supported Versions

Only the latest released version of Obsidian PA is actively supported with security fixes.

| Version | Supported |
| ------- | --------- |
| Latest  | ✅        |
| Older   | ❌        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Use [GitHub Security Advisories](https://github.com/FredrikFolkeryd/obsidian-pa/security/advisories/new) to report vulnerabilities privately. This keeps details confidential until a fix is ready.

### What to Include

A useful vulnerability report includes:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce the issue
- The plugin version and Obsidian version where you observed it
- Any proof-of-concept code or screenshots (optional but helpful)

### Response Timeline

| Milestone | Target |
| --------- | ------ |
| Acknowledgement | Within 5 business days |
| Initial assessment | Within 10 business days |
| Fix or mitigation | Depends on severity |

After a fix is released, a [GitHub Security Advisory](https://github.com/FredrikFolkeryd/obsidian-pa/security/advisories) will be published giving credit to the reporter (unless anonymity is preferred).

## Scope

### In Scope

- Vulnerabilities in plugin source code (`src/`)
- Issues that allow unauthorised access to vault files
- Prompt injection attacks that bypass user confirmation
- Credential or token exposure
- Dependency vulnerabilities with a realistic exploit path

### Out of Scope

- Vulnerabilities in Obsidian itself — report those to [Obsidian](https://obsidian.md/security)
- Vulnerabilities in third-party AI providers — report those to the relevant provider
- Issues that require physical access to the user's device
- Theoretical vulnerabilities without a realistic exploit

## Preferred Languages

Reports may be submitted in English or Swedish.
