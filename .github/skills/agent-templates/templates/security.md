# Template: Security Assessment

**Agent:** security
**Creates:** `security.md`
**Location:** `.github/work/current/<feature-name>/security.md`

---

```markdown
# Security Assessment

## Overview

**Feature/Fix:** <feature-name>
**Assessment Type:** <threat-model/security-review/privacy-assessment>
**Status:** <planning/in-progress/review/complete>
**Risk Level:** <critical/high/medium/low>

## Scope

### Assets to Protect

- [ ] User note content
- [ ] User credentials/tokens
- [ ] Plugin settings
- [ ] <other assets>

### Features Under Assessment

- <feature or component being assessed>
- <feature or component being assessed>

## Threat Model (STRIDE)

### Spoofing

| Threat | Likelihood | Impact | Risk | Mitigation |
|--------|------------|--------|------|------------|
| <threat description> | High/Med/Low | High/Med/Low | <L×I> | <mitigation> |

### Tampering

| Threat | Likelihood | Impact | Risk | Mitigation |
|--------|------------|--------|------|------------|
| <threat description> | High/Med/Low | High/Med/Low | <L×I> | <mitigation> |

### Repudiation

| Threat | Likelihood | Impact | Risk | Mitigation |
|--------|------------|--------|------|------------|
| <threat description> | High/Med/Low | High/Med/Low | <L×I> | <mitigation> |

### Information Disclosure

| Threat | Likelihood | Impact | Risk | Mitigation |
|--------|------------|--------|------|------------|
| <threat description> | High/Med/Low | High/Med/Low | <L×I> | <mitigation> |

### Denial of Service

| Threat | Likelihood | Impact | Risk | Mitigation |
|--------|------------|--------|------|------------|
| <threat description> | High/Med/Low | High/Med/Low | <L×I> | <mitigation> |

### Elevation of Privilege

| Threat | Likelihood | Impact | Risk | Mitigation |
|--------|------------|--------|------|------------|
| <threat description> | High/Med/Low | High/Med/Low | <L×I> | <mitigation> |

## Privacy Impact Assessment

### Data Flow

```
[User Vault] → [Plugin] → [AI Provider]
     ↑              ↓
[Local Storage] ← [Response]
```

### Data Exposure Analysis

| Data Type | Exposed To | Consent | Minimised | Retention |
|-----------|------------|---------|-----------|-----------|
| Note content | <provider> | Yes/No | Yes/No | <policy> |
| File names | <provider> | Yes/No | Yes/No | <policy> |
| <data type> | <recipient> | Yes/No | Yes/No | <policy> |

### Third-Party Impact

- [ ] Notes may reference individuals who have not consented
- [ ] Mitigation: <approach to protect third-party privacy>

## Secrets Management Review

### Credential Inventory

| Credential | Purpose | Storage Method | Secure? |
|------------|---------|----------------|---------|
| GitHub PAT | LLM access | <method> | Yes/No |
| <credential> | <purpose> | <method> | Yes/No |

### Recommendations

- [ ] <recommendation for secure credential handling>
- [ ] <recommendation for secure credential handling>

## Security Code Review

### Files Reviewed

- [ ] `<file-path>` - <status: clean/issues found>
- [ ] `<file-path>` - <status: clean/issues found>

### Findings

#### Critical

- **File:** `<file-path:line>`
- **Issue:** <description>
- **Fix:** <remediation>

#### High

- **File:** `<file-path:line>`
- **Issue:** <description>
- **Fix:** <remediation>

#### Medium

- **File:** `<file-path:line>`
- **Issue:** <description>
- **Fix:** <remediation>

#### Low

- **File:** `<file-path:line>`
- **Issue:** <description>
- **Fix:** <remediation>

## Residual Risks

| Risk | Likelihood | Impact | Accepted? | Rationale |
|------|------------|--------|-----------|-----------|
| <remaining risk after mitigations> | H/M/L | H/M/L | Yes/No | <why> |

## Recommendations Summary

### Must Fix (Before Release)

1. <critical security requirement>

### Should Fix (High Priority)

1. <important security improvement>

### Consider (Future Enhancement)

1. <security enhancement for later>

## Sign-off

- [ ] Threat model complete
- [ ] Privacy impact assessed
- [ ] Secrets management reviewed
- [ ] Code review complete (if applicable)
- [ ] Recommendations documented
- [ ] Residual risks accepted or mitigated

**Assessment Date:** <date>
**Assessor:** @security
```
