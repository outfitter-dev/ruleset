# Rulesets Development Workflows

Quick reference guide for common development workflows in the Rulesets project. Each workflow file contains detailed commands and step-by-step instructions.

## Core Development

### [Build](./workflows/build.md)

Commands for building the project, packages, and managing build artifacts.

### [Test](./workflows/test.md)

Testing commands including unit tests, integration tests, coverage, and watch mode.

### [Lint & Format](./workflows/lint.md)

Code quality tools for linting, formatting, and type checking.

### [Development](./workflows/development.md)

Daily development commands for dependency management and dev server operations.

## Rules Compilation

### [Compile Rules](./workflows/compile.md)

Compile source rules into provider-specific formats for Cursor, Claude Code, Windsurf, and more.

### [Provider Plugin Development](./workflows/provider-plugin.md)

Create and test new provider plugins for additional AI tools.

## Version Control

### [Git](./workflows/git.md)

Essential git commands for branching, committing, and managing changes.

### [Pull Request](./workflows/pull-request.md)

GitHub PR workflow from creation through review to merge.

### [Release](./workflows/release.md)

Manage releases with changesets, versioning, and npm publishing.

## CI/CD & Deployment

### [CI/CD](./workflows/ci-cd.md)

Continuous integration commands for GitHub Actions and deployment.

## Documentation

### [Documentation](./workflows/documentation.md)

Generate, preview, and maintain project documentation.

## Setup & Troubleshooting

### [Setup](./workflows/setup.md)

Initial project setup and environment configuration.

### [Troubleshooting](./workflows/troubleshooting.md)

Common issues and their solutions for build, test, and runtime problems.

### [Debugging](./workflows/debugging.md)

Advanced debugging techniques for development and production issues.

## Complete Workflows

### [Feature Implementation](./workflows/feature-implementation.md)

End-to-end workflow for implementing new features from planning to merge.

### [Bug Fix](./workflows/bug-fix.md)

Systematic approach to investigating, fixing, and deploying bug fixes.

## Quick Reference

### Most Common Commands

```bash
# Development
bun install               # Install dependencies
bunx turbo run dev        # Start dev mode
bunx turbo run build      # Build all packages
bunx turbo run test       # Run all tests

# Code Quality
bun run lint            # Run linter
bun run format          # Format code
bun run typecheck       # Check types

# Rules Compilation
bun run compile         # Compile all rules
bun run compile --watch # Watch mode

# Git
git checkout -b feature/name            # New feature branch (compatible everywhere)
# or
git switch -c feature/name              # Modern alternative
git add -A && git commit -m "feat: description"  # Commit
git push -u origin HEAD          # Push current branch
gh pr create -f -B main          # Create PR against main

# Quick Checks
bun run ci:local        # Full CI check locally
```

## Workflow Categories

- **Daily Development**: build, test, lint, development
- **Feature Work**: feature-implementation, provider-plugin
- **Bug Fixes**: bug-fix, debugging, troubleshooting
- **Releases**: release, documentation
- **Maintenance**: setup, ci-cd
- **Collaboration**: git, pull-request

## Tips

1. Always work from a feature branch off `main`
2. Run `bun run ci:local` before creating PRs
3. Use conventional commit messages
4. Keep PRs focused on single features/fixes
5. Update tests and documentation with code changes
6. Tag `@coderabbitai` in PR comments for automated review
