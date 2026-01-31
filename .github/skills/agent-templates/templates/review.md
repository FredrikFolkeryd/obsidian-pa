# Template: Review Findings

**Agent:** review
**Creates:** `review.md`
**Location:** `.github/work/current/<feature-name>/review.md`

---

```markdown
# Review Findings

## Overview

Brief summary of what was reviewed and the overall outcome.

**Reviewed:** <deliverable type and scope>
**Verdict:** <Approved / Request Changes / Blocked>
**Date:** <review date>

## Summary

<High-level assessment of the deliverable quality and key findings>

## Quality Assessment

### Consistency

- [ ] Aligns with existing patterns and conventions
- <findings and observations>

### Efficiency

- [ ] Implementation is optimal without premature optimisation
- <findings and observations>

### Maintainability

- [ ] Can be easily understood and modified
- <findings and observations>

### Fitness for Purpose

- [ ] Solves the actual problem as specified
- <findings and observations>

### End-User Success

- [ ] Users will find this intuitive and useful
- <findings and observations>

### Clarity

- [ ] Code/documentation is clear and self-explanatory
- <findings and observations>

### Compliance

- [ ] Follows project standards and engineering baseline
- <findings and observations>

### Security

- [ ] No security concerns or vulnerabilities
- <findings and observations>

### Values Alignment

- [ ] Reflects IKEA values in approach and outcome
- <findings and observations>

## Issues Found

### Critical

| Location | Issue | Recommended Fix |
|----------|-------|-----------------|
| `<file:line>` | <description> | <action> |

### Major

| Location | Issue | Recommended Fix |
|----------|-------|-----------------|
| `<file:line>` | <description> | <action> |

### Minor

| Location | Issue | Recommended Fix |
|----------|-------|-----------------|
| `<file:line>` | <description> | <action> |

### Suggestions

- <optional improvement or alternative approach>

## Positive Observations

What was done well:

- <positive finding>
- <positive finding>

## Acceptance Criteria Check

| Criterion | Met | Notes |
|-----------|-----|-------|
| <criterion from plan> | Yes/No/Partial | <observation> |

## Follow-up Required

- [ ] <action item for author>
- [ ] <action item for author>

## Review Complete

- [ ] All deliverables examined
- [ ] Quality dimensions evaluated
- [ ] Issues documented with severity
- [ ] Feedback is actionable
- [ ] Verdict provided
- [ ] Author notified
```
