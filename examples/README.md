# Ruleset Examples & Testing Sandbox

Real-world examples showing the **dramatic simplification** achieved with slots & variables.

## 📚 Start Here

**[COMPARISON.md](./COMPARISON.md)** - See before/after examples with **8x code reduction**

## Structure

```
examples/
  COMPARISON.md           # Before/after comparison guide
  templates/              # Example projects (tracked in git)
    simple-project/       # Basic slots & variables (recommended start)
    monorepo-project/     # Advanced: code inclusion, provider modes
  sandbox/                # Testing workspaces (gitignored)
    simple-project/       # Created from templates
    my-test/              # Custom test workspaces
```

## Quick Start

```bash
# Create sandbox from template
bun run sandbox:setup simple-project

cd examples/sandbox/simple-project

# Build for all providers
rules build

# Check outputs
ls -la .cursor/rules/
cat AGENTS.md

# Clean up when done
bun run sandbox:clean
```

## Templates

### `simple-project/` (Recommended Start)

**What it shows:**
- Variables: `[[ $project.name ]]`, `[[ $package.name ]]`
- File composition: `[[ @_typescript.md ]]`
- Smart wrapping: XML tags auto-applied
- Provider-specific outputs

**Key files:**
- `BEFORE.md` - Traditional approach (600+ lines, lots of duplication)
- `.ruleset/rules/conventions.md` - Slots approach (25 lines, zero duplication)

**Result:** **8x code reduction**, single source of truth

### `monorepo-project/` (Advanced)

**What it shows:**
- Dynamic code inclusion from source files
- Security guardrails (gitignore, deny patterns, size limits)
- Provider-specific modes (Cursor: reference, Claude: embed)
- Package-aware variables (`$package.name` resolves per-package)
- Nested wrapping (code → XML → callout)

**Key features:**
- Live code examples that auto-update
- Monorepo-aware variable resolution
- Advanced security configuration

## Usage Patterns

### Manual Testing
```bash
# Create workspace from template
bun run sandbox:setup basic

# Or with custom name
bun run sandbox:setup basic my-custom-test

# Test build
cd examples/sandbox/basic
rules build

# Test watch mode
rules build --watch

# Edit files and observe rebuild
```

### Agent Testing
Agents can use the sandbox for automated testing:

```bash
# 1. Create isolated environment
bun run sandbox:setup basic agent-test

# 2. Build and verify
cd examples/sandbox/agent-test
rules build
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