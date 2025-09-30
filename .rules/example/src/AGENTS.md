---
ruleset:
  version: 0.4.0
name: AGENTS
output: .agents/AGENTS.md
providers:
  all: true
  cursor: false
---

# Rulesets - AI Assistant Guide

This document aggregates project rules for AI assistants working with the Rulesets codebase.

```yaml
file: core.md
heading: true
mode: embed
```

## Conventions

```yaml
file:
  glob: conventions/*.md
  tags: public,!internal
heading:
  text: title
  level: inherit
mode: embed
```

## Workflows

```yaml
file:
  glob: workflows/*.md
  tags: public
heading:
  text: title
  level: inherit
mode:
  claude: mention
  agents: embed
```
