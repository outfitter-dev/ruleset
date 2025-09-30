# Rulesets Examples & Testing Sandbox

This directory contains example projects and a testing sandbox for Rulesets.

## Structure

```
examples/
  templates/          # Example projects (tracked in git)
    basic/            # Minimal ruleset project
  sandbox/            # Testing workspaces (gitignored)
    basic/            # Created from templates/basic
    my-test/          # Custom test workspaces
```

## Quick Start

```bash
# Create a sandbox from the 'basic' template
bun run sandbox:setup basic

# This creates: examples/sandbox/basic/

# Work in the sandbox
cd examples/sandbox/basic
rules compile
rules compile --watch

# Clean up all sandbox workspaces
bun run sandbox:clean
```

## Templates

### `basic/`
Minimal project demonstrating:
- Single rules file (coding-standards.rule.md)
- One partial (license.md)
- Multi-provider configuration
- Expected output structure

## Usage Patterns

### Manual Testing
```bash
# Create workspace from template
bun run sandbox:setup basic

# Or with custom name
bun run sandbox:setup basic my-custom-test

# Test compilation
cd examples/sandbox/basic
rules compile

# Test watch mode
rules compile --watch

# Edit files and observe recompilation
```

### Agent Testing
Agents can use the sandbox for automated testing:

```bash
# 1. Create isolated environment
bun run sandbox:setup basic agent-test

# 2. Compile and verify
cd examples/sandbox/agent-test
rules compile
[ -f .cursor/rules/coding-standards.mdc ] && echo "✓ Cursor output exists"
[ -f AGENTS.md ] && echo "✓ AGENTS.md exists"

# 3. Clean up
cd ../../..
bun run sandbox:clean agent-test
```

### Creating New Templates

1. Create new directory: `examples/templates/my-template/`
2. Add `.ruleset/` structure with:
   - `config.yaml` - Provider configuration
   - `rules/` - Source rules files
   - `partials/` - Reusable content (optional)
3. Add README.md explaining the template
4. Use with: `bun run sandbox:setup my-template`

## Notes

- **Templates are tracked** - Commit improvements and new templates
- **Sandbox is gitignored** - Safe for experiments, no cleanup needed before commits
- **Sandbox matches template names** - `templates/basic/` → `sandbox/basic/`
- **Independent workspaces** - Each sandbox is isolated
- **Persistent by default** - Sandbox persists between sessions (manual cleanup)

## Available Scripts

```bash
bun run sandbox:setup <template> [name]  # Create sandbox workspace
bun run sandbox:clean [name]             # Remove sandbox workspace(s)
```