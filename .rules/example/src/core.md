---
ruleset:
  version: 0.4.0
name: Core Project Instructions
tags: [core, public]
---

# Core Project Instructions

This document establishes baseline guidance for AI assistants working with the Rulesets codebase.

## Critical Instructions

- Always read @SCRATCHPAD.md first and keep it updated
- Review @REFACTOR.md and @PLAN.md before making changes
- Follow @CODE-REVIEW.md instructions before pushing code
- Work from feature branches off `main`
- Use conventional commit messages
- Commit regularly with logical groupings
- Never automatically create PRs without explicit user direction

## Project Overview

Rulesets is a CommonMark-compliant rules compiler that lets you author single-source rules files and compile them into provider-specific formats. Think of it as Terraform for AI rules: write once, compile for many providers.

## Essential Documentation

Consult these regularly:
- @.agents/docs/language.md - Terminology spec
- @.agents/docs/overview.md - Project overview
- @PLAN.md - Rewrite execution checklist
- @REFACTOR.md - Architecture blueprint

## Quality Gates

Before submitting changes:

```bash
bun run lint        # Lint check
bun run typecheck   # Type check
bun run build       # Build check
bun run test        # Test all changes
```

All checks must pass before merging.
