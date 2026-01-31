# Template: Test Planning and Progress

**Agent:** tester
**Creates:** `tester.md`
**Location:** `.github/work/current/<feature-name>/tester.md`

---

```markdown
# Test Planning and Progress

## Test Strategy

Brief description of the testing approach for this feature/fix.

### Risk Assessment

| Risk Area | Level | Mitigation |
|-----------|-------|------------|
| <area> | High/Medium/Low | <testing approach> |

### Test Types Required

- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Exploratory testing

## Test Scenarios

### Unit Tests

- [ ] <scenario description>
- [ ] <scenario description>

### Integration Tests

- [ ] <scenario description>
- [ ] <scenario description>

### Edge Cases

- [ ] <edge case scenario>
- [ ] <edge case scenario>

## Test Implementation

| Test File | Scenarios | Status |
|-----------|-----------|--------|
| `<file-path>` | <count> | Pending/Done |

## Coverage Analysis

| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| Line Coverage | >80% | <value> | <notes> |
| Branch Coverage | >70% | <value> | <notes> |

## Exploratory Testing Notes

### Session: <date/topic>

**Charter:** <what we're exploring>
**Duration:** <time spent>

**Observations:**
- <finding>
- <finding>

**Issues Found:**
- <issue description and severity>

## Issues Discovered

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| <description> | Critical/Major/Minor | Open/Reported | <notes> |

## Test Metrics

- **Total Tests:** <count>
- **Passing:** <count>
- **Failing:** <count>
- **Execution Time:** <duration>

## Completion Status

- [ ] Test strategy defined
- [ ] Risk assessment completed
- [ ] Test scenarios implemented
- [ ] All tests passing
- [ ] Coverage targets met
- [ ] Exploratory testing done (if planned)
- [ ] Issues documented
- [ ] Ready for review

## Notes

<additional observations, recommendations, or context>
```
