# Template: Architect Design Notes

**Agent:** architect
**Creates:** `architecture-notes.md`
**Location:** `.github/work/current/<feature-name>/architecture-notes.md`

---

```markdown
# Architecture Notes

## Overview

Brief summary of the architectural scope and goals for this work item.

## Context Analysis

### Existing Patterns

- <pattern observed in current code>
- <pattern observed in current code>

### Integration Points

| Component | Purpose | Impact |
|-----------|---------|--------|
| `<file/module>` | <what it does> | <how this work affects it> |

## Design Decisions

### <Decision Title>

**Context:** <why this decision was needed>
**Options Considered:**
1. <option 1> - <pros/cons>
2. <option 2> - <pros/cons>

**Decision:** <what was decided>
**Rationale:** <why this approach was chosen>

## Proposed Structure

### File Organisation

```
src/
├── <new-or-modified>/
│   ├── <file>.ts        # <purpose>
│   └── <file>.ts        # <purpose>
```

### Key Interfaces

```typescript
interface <InterfaceName> {
  <property>: <type>;
  <method>(<params>): <return-type>;
}
```

## Integration Approach

How this design fits with existing code:

- <integration point and approach>
- <integration point and approach>

## Performance Considerations

- **Bundle size:** <impact and mitigation>
- **Runtime:** <considerations for efficiency>
- **Memory:** <resource management approach>

## Usability Considerations

- **Discoverability:** <how users find this feature>
- **Consistency:** <alignment with Obsidian patterns>
- **Feedback:** <status indicators and error handling>

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| <risk description> | Low/Medium/High | <impact> | <mitigation strategy> |

## Tasks for Developer

- [ ] <concrete implementation task>
- [ ] <concrete implementation task>
- [ ] <concrete implementation task>

## Open Questions

- [ ] <question needing resolution> - Status: <open/resolved>

## Sign-off Checklist

- [ ] Design addresses requirements
- [ ] Integration points identified
- [ ] Interfaces defined
- [ ] Performance considered
- [ ] Usability addressed
- [ ] Ready for implementation
```
