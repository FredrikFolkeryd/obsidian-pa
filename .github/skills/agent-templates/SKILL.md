---
name: agent-templates
description: >
  Provides standardised templates for agent work item files. Use this skill when
  creating or updating your agent's file in a folder-based work item at
  `.github/work/<status>/<feature-name>/`.

  Each agent has a dedicated template (e.g., architect.md, developer.md) that
  defines the structure for their contribution file. Invoke this skill to get
  your template, then create your file following that structure.

  No other files may be created or modified within a work item folder.
---

# Agent Work Item Templates

## Purpose

This skill provides standardised templates for agent work item files. When working on a feature or fix, each agent creates their own file in the work item folder following their designated template.

## Available Templates

| Agent | Template File | Creates | Purpose |
| ----- | ------------- | ------- | ------- |
| architect | `architect.md` | `architecture-notes.md` | Design decisions, patterns, integration considerations |
| developer | `developer.md` | `developer.md` | Implementation progress, technical decisions, blockers |
| tech-writer | `tech-writer.md` | `tech-writer.md` | Documentation progress, terminology decisions, review findings |
| reviewer | `reviewer.md` | `reviewer.md` | Quality assessment, issues found, approval verdict |
| team-lead | `team-lead.md` | `plan.md` | Work breakdown, task allocation, acceptance criteria |
| team-lead | `team-lead-final.md` | `final.md` | Completion summary, verification, lessons learned |
| tester | `tester.md` | `tester.md` | Test strategy, risk assessment, coverage, metrics |
| security | `security.md` | `security.md` | Threat model, privacy assessment, secrets management |
| pa | `pa.md` | `pa.md` | User feedback, bug reports, enhancement requests |

## Usage

### For Agents

1. Navigate to `.github/skills/agent-templates/templates/`
2. Find your agent's template file (e.g., `developer.md`)
3. Copy the template content
4. Create your file in the work item folder: `.github/work/current/<feature-name>/<agent-name>.md`
5. Fill in the template sections as you work

### File Path Convention

Work item files follow this structure:

```text
.github/work/current/<feature-name>/
├── plan.md               # Team lead's work plan
├── final.md              # Team lead's completion summary (when done)
├── architecture-notes.md # Architect's design decisions
├── developer.md          # Developer's implementation notes
├── reviewer.md           # Reviewer's quality assessment and findings
└── ...                   # Other agent files as needed
```

## Example Workflow

### Scenario: Developer Agent Creating Implementation Notes

1. Developer receives a task from `plan.md`
2. Developer reads template from `.github/skills/agent-templates/templates/developer.md`
3. Developer creates `.github/work/current/add-agent-ui/developer.md`
4. Developer fills in implementation approach, progress, and notes
5. Developer updates the file as work progresses

## Template Structure

Each template follows a consistent structure:

- **Heading** with document title
- **Checklist sections** for tracking progress
- **Notes sections** for decisions and observations
- **Completion criteria** for validation

## Maintaining Templates

When adding new agents:

1. Create a template file: `.github/skills/agent-templates/templates/<agent-name>.md`
2. Update the Available Templates table in this file
3. Ensure the agent's instructions reference this skill

## Template Content Guidelines

When creating or updating templates:

- Never include example credentials, API keys, or tokens (even fake ones)
- Avoid internal system names, IP addresses, or URLs
- Do not include sensitive business logic or proprietary algorithms
- Exclude personal data or PII in examples
- Use generic placeholders: `<description>`, `<value>`, `[item]`
- Keep templates focused on structure and guidance
- Maintain proper markdown heading hierarchy
- Include security checklists where relevant
