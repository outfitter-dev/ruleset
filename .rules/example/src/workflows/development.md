---
ruleset:
  version: 0.4.0
name: Development Workflow
tags: [workflows, public]
---

# Development Workflow

Daily development commands for the Rulesets project.

## Setup

```bash
bun install               # Install dependencies
bun run build:libs        # Build library packages
bun run typecheck         # Verify types
```

## Development Cycle

```bash
# Start development mode
bun run dev

# Watch tests
bun test --watch

# Run specific package tests
bun run test --filter=@rulesets/core
```

## Quality Checks

```bash
bun run lint            # Run linter
bun run format          # Format code
bun run typecheck       # Check types
bun run test            # Run all tests
```

## Build & Compile

```bash
bun run build           # Build all packages
bun run compile         # Compile rules
bun run compile --watch # Watch mode
```

## Common Patterns

### Feature Branch Workflow

```bash
git checkout main
git pull origin main
git checkout -b feature/[name]

# Make changes...
bun run lint && bun run typecheck && bun run test

git add -A
git commit -m "feat: description"
git push -u origin HEAD
```

### Quick CI Check

```bash
bun run ci:local        # Full CI check locally
```
