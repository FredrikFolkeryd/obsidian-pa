# Documentation Notes

## Overview

**Feature/Fix:** add-security-policy
**Documentation Type:** external
**Status:** complete

## Scope

### Documentation to Create

- [x] `SECURITY.md` — Security policy for responsible vulnerability reporting

### Documentation to Update

- [ ] None required

### Terminology/UI Review

- [x] Confirmed use of "GitHub Security Advisories" as the private reporting channel

## Audit of Existing Docs

### Current State

No `SECURITY.md` existed. The `CONTRIBUTING.md` included a brief security note advising reporters to contact maintainers privately, but provided no structured process or contact method.

### Gaps Identified

- No formal vulnerability reporting procedure
- No supported versions table
- No response timeline expectations
- No scope definition (in/out of scope)

### Inconsistencies Found

- None — this is a new document

## Documentation Plan

### Structure

Standard GitHub `SECURITY.md` format recognised by GitHub's native security policy feature.

### Target Audience

External contributors and security researchers who discover vulnerabilities in the plugin.

### Key Terms

| Term | Definition | Usage Notes |
|------|------------|-------------|
| GitHub Security Advisories | GitHub's private vulnerability disclosure mechanism | Primary reporting channel |

## Progress

### Completed

- [x] Created `SECURITY.md` at repository root
- [x] Defined supported versions table
- [x] Linked to GitHub Security Advisories for private reporting
- [x] Defined response timeline
- [x] Defined in-scope and out-of-scope items
- [x] Added language preference (English or Swedish)

### In Progress

- None

### Blocked

- None

## Technical Accuracy Notes

- Verified that the GitHub Security Advisories URL pattern is correct for this repository
- Threat model (`docs/threat-model.md`) reviewed to identify appropriate in-scope items
- Out-of-scope items aligned with what Obsidian and AI providers handle themselves

## Terminology Decisions

| Context | Decision | Rationale |
|---------|----------|-----------|
| Report channel | GitHub Security Advisories | Built-in private reporting; no email address needed |
| Version support | "Latest only" | Personal project; no LTS or backport capacity |

## Review Findings

### Issues Found

None.

### Recommendations

- Consider enabling GitHub's private vulnerability reporting feature in repository settings if not already active

## Completion Checklist

- [x] All planned documentation created/updated
- [x] Technical accuracy verified
- [x] Terminology consistency checked
- [x] Links validated
- [x] Formatting consistent
- [x] Ready for review
