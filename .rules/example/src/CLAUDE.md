---
ruleset:
  version: 0.4.0
name: CLAUDE
output: CLAUDE.md
providers: [claude-code]
---

# Rulesets - Claude Code Instructions

Project instructions for Claude Code CLI assistant.

```yaml
file: core.md
heading: Core Instructions
mode: embed
```

## Development Standards

See these files for detailed conventions:

```yaml
file:
  glob: conventions/*.md
heading: false
mode: mention
```

## Common Workflows

```yaml
file: workflows/development.md
heading: Development Workflow
mode: embed
```

For additional workflows, see:

```yaml
file:
  glob: workflows/*.md
  tags: "!development"
heading: false
mode: mention
```
