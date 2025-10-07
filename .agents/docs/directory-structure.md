# Ruleset Directory Structure & Output Behavior

## Directory Conventions

Ruleset follows a strict directory convention for organizing rule sources and compilation outputs.

### Default Structure: `.rules/`

```
project/
├── .rules/
│   ├── config.yaml           # Project configuration
│   ├── src/                  # Source rules (authored)
│   │   ├── conventions.md
│   │   ├── _typescript.md    # Partial (prefix with _)
│   │   └── _security.md
│   └── dist/                 # Compiled rules (generated)
│       ├── cursor/
│       │   └── conventions.md
│       ├── claude-code/
│       │   └── conventions.md
│       └── windsurf/
│           └── conventions.md
├── .cursor/
│   └── rules/
│       └── conventions.mdc   # Written only with --write flag
├── CLAUDE.md                 # Written only with --write flag
└── .windsurf/
    └── rules/
        └── conventions.md    # Written only with --write flag
```

### Alternative Structure: `.agents/rules/`

For projects that prefer the `.agents/` convention:

```
project/
├── .agents/
│   └── rules/
│       ├── config.yaml
│       ├── src/             # Source rules
│       │   └── ...
│       └── dist/            # Compiled rules
│           └── ...
```

**Configuration:**
```yaml
# .agents/rules/config.yaml
rulesPath: ".agents/rules"  # Override default
```

### Advanced: Custom Path

For advanced use cases, specify any custom path:

```
project/
├── rules/                   # Custom location
│   ├── config.yaml
│   ├── src/
│   └── dist/
```

**Configuration:**
```yaml
# rules/config.yaml
rulesPath: "./rules"  # Relative to project root
```

Or via CLI:
```bash
rules build --rules-path ./rules
```

## Directory Purposes

### `src/` - Source Rules

**Purpose:** Author your rules here in Markdown with slot syntax.

**Characteristics:**
- Human-authored, version-controlled files
- Use `[[ ]]` slot syntax (or configured delimiter)
- Support YAML front matter for metadata
- Partials prefixed with `_` (e.g., `_typescript.md`)

**Example:**
```markdown
---
ruleset:
  version: 0.4.0
---

# [[ $project.name ]] Guidelines

[[ @_typescript.md ]]
[[ @_security.md ]]
```

### `dist/` - Distribution (Compiled)

**Purpose:** Staging area for compiled rules before final output.

**Characteristics:**
- **Auto-generated** - Never edit manually
- Gitignored by default
- Organized by provider: `dist/<provider>/`
- Contains fully resolved content (slots replaced, imports expanded)

**Example structure:**
```
dist/
├── cursor/
│   └── conventions.md       # Compiled for Cursor
├── claude-code/
│   └── conventions.md       # Compiled for Claude Code
└── windsurf/
    └── conventions.md       # Compiled for Windsurf
```

### Provider-Specific Paths (Final Output)

**Purpose:** Tool-ready files in their expected locations.

**Characteristics:**
- Written **only with `--write` flag**
- Each provider defines its own path convention
- Version-controlled (optional, user's choice)

**Common paths:**
| Provider | Output Path | Format |
|----------|-------------|--------|
| Cursor | `.cursor/rules/*.mdc` | MDC (Markdown with front matter) |
| Claude Code | `CLAUDE.md` | Markdown |
| Windsurf | `.windsurf/rules/*.md` | Markdown |
| Codex CLI | `AGENTS.md` | Markdown |

## Build Behavior & Flags

### Default: `rules build`

**Behavior:**
- ✅ Compiles `src/` → `dist/<provider>/`
- ❌ Does NOT write to provider-specific paths
- Shows "skipped" status for provider paths

**Output:**
```
✓ Compiled conventions.md → .rules/dist/cursor/conventions.md (staged)
⊘ Skipped .cursor/rules/conventions.mdc (use --write to output)
✓ Compiled conventions.md → .rules/dist/claude-code/conventions.md (staged)
⊘ Skipped CLAUDE.md (use --write to output)
```

**Use case:** Preview compilation, verify slots resolve correctly, CI/CD validation

### With `--write` Flag: `rules build --write`

**Behavior:**
- ✅ Compiles `src/` → `dist/<provider>/`
- ✅ Writes `dist/<provider>/` → provider-specific paths

**Output:**
```
✓ Compiled conventions.md → .rules/dist/cursor/conventions.md (staged)
✓ Wrote .cursor/rules/conventions.mdc
✓ Compiled conventions.md → .rules/dist/claude-code/conventions.md (staged)
✓ Wrote CLAUDE.md
```

**Use case:** Final deployment, update actual tool configuration files

### With `--dry-run` Flag: `rules build --dry-run`

**Behavior:**
- ✅ Parses and validates source rules
- ✅ Resolves all slots
- ❌ Does NOT write to `dist/`
- ❌ Does NOT write to provider paths

**Output:**
```
✓ Validated conventions.md (dry run)
✓ Validated _typescript.md (dry run)
✓ All slots resolved successfully (dry run)
```

**Use case:** Validation only, pre-commit hooks, syntax checking

**Note:** Cannot combine `--write` and `--dry-run` (mutual exclusion).

## Gitignore Recommendations

### Recommended `.gitignore`

```gitignore
# Ruleset compiled outputs (staging area)
.rules/dist/
.agents/rules/dist/

# Provider-specific outputs (optional - your choice)
# Uncomment if you prefer to generate these on-demand:
# .cursor/rules/
# CLAUDE.md
# .windsurf/rules/
# AGENTS.md
```

**Philosophy:**
- **Always ignore `dist/`** - It's a build artifact, like `node_modules/`
- **Provider paths are optional** - Some teams commit them, others generate on-demand
  - Commit: Ensures everyone has the same rules immediately
  - Generate: Ensures rules always match source (via `rules build --write`)

### Example Workflow: Generate On-Demand

**Setup:**
```gitignore
.rules/dist/
.cursor/rules/
CLAUDE.md
.windsurf/rules/
AGENTS.md
```

**Team workflow:**
```bash
git clone repo
rules build --write  # Generate all provider files locally
# Now tools have their rules
```

**Benefits:**
- Source of truth is `src/`
- No merge conflicts in generated files
- Always up-to-date with latest compilation logic

### Example Workflow: Commit Provider Files

**Setup:**
```gitignore
.rules/dist/  # Only ignore staging area
```

**Team workflow:**
```bash
# Author makes changes
vim .rules/src/conventions.md
rules build --write
git add .rules/src/ .cursor/rules/ CLAUDE.md
git commit -m "Update coding conventions"
git push

# Team pulls changes
git pull  # Rules files ready immediately
```

**Benefits:**
- No setup required (rules already present)
- Works even if `rules` CLI not installed
- Explicit diffs in pull requests

## Configuration Examples

### Minimal Configuration

```yaml
# .rules/config.yaml
ruleset:
  version: 0.4.0

providers:
  cursor: { enabled: true }
  claude-code: { enabled: true }
```

Defaults:
- Source: `.rules/src/`
- Dist: `.rules/dist/`
- Delimiter: `[[ ]]`

### Custom Path Configuration

```yaml
# .agents/rules/config.yaml
ruleset:
  version: 0.4.0

rulesPath: ".agents/rules"

providers:
  cursor: { enabled: true }
  claude-code: { enabled: true }
```

Paths:
- Source: `.agents/rules/src/`
- Dist: `.agents/rules/dist/`

### Advanced Custom Path

```yaml
# docs/rules/config.yaml
ruleset:
  version: 0.4.0

rulesPath: "./docs/rules"

providers:
  cursor:
    enabled: true
    outputPath: ".cursor/rules"  # Override default
  claude-code:
    enabled: true
    outputPath: "docs/CLAUDE.md"  # Custom location
```

## CLI Reference

### Build Commands

```bash
# Default: compile to dist/ only
rules build

# Write to provider-specific paths
rules build --write

# Dry run: validate only
rules build --dry-run

# Custom rules path
rules build --rules-path ./docs/rules

# Specific provider only
rules build --provider cursor

# Watch mode
rules watch  # Implies default build behavior
rules watch --write  # Auto-write on changes
```

### Init Command

```bash
# Create default .rules/ structure
rules init

# Create .agents/rules/ structure
rules init --path .agents/rules

# Custom path
rules init --path ./docs/rules
```

Creates:
```
.rules/
├── config.yaml
├── src/
│   └── conventions.md  # Template file
└── .gitignore          # Ignores dist/
```

## Watch Mode Behavior

```bash
rules watch
```

**Default behavior:**
- Monitors `src/**/*.md` for changes
- Recompiles to `dist/<provider>/`
- Does NOT write to provider paths

```bash
rules watch --write
```

**Write behavior:**
- Monitors `src/**/*.md` for changes
- Recompiles to `dist/<provider>/`
- Writes to provider paths (`.cursor/rules/`, `CLAUDE.md`, etc.)

**Output:**
```
👀 Watching .rules/src/ for changes...

[14:23:45] Changed: conventions.md
✓ Recompiled → .rules/dist/cursor/conventions.md (staged)
⊘ Skipped .cursor/rules/conventions.mdc (use --write)

[14:24:12] Changed: _typescript.md
✓ Recompiled → .rules/dist/cursor/conventions.md (staged)
✓ Recompiled → .rules/dist/claude-code/conventions.md (staged)
⊘ Skipped .cursor/rules/conventions.mdc (use --write)
⊘ Skipped CLAUDE.md (use --write)
```

## Best Practices

1. **Always keep `src/` under version control**
   - This is your source of truth
   - Review changes in pull requests

2. **Never commit `dist/`**
   - It's a build artifact
   - Always regenerate from source

3. **Choose a gitignore strategy for provider files**
   - Commit them: Convenient, explicit diffs
   - Generate them: No merge conflicts, always current

4. **Use `--dry-run` in pre-commit hooks**
   - Validates syntax before commit
   - Catches slot resolution errors early

5. **Use `--write` sparingly**
   - Default build validates without side effects
   - Only write when you intend to deploy/commit

6. **Prefer `.rules/` over custom paths**
   - Standard convention aids discoverability
   - Works with zero configuration
   - Use `.agents/rules/` if integrating with AGENTS.md ecosystem

## Migration from `.ruleset/`

If you have an existing project using `.ruleset/`:

```bash
# Rename directory
mv .ruleset .rules

# Update config if it references old path
sed -i '' 's/\.ruleset/.rules/g' .rules/config.yaml

# Update gitignore
sed -i '' 's/\.ruleset/.rules/g' .gitignore

# Rebuild
rules build --write
```

## Related Documentation

- `language.md` - Terminology and conventions
- `swapping_handlebars_for_custom.md` - Custom delimiter configuration
- `COMPOSER_CONCEPT.md` - Slots & variables system

---

**Status:** Active specification
**Version:** v0.4.0
**Last updated:** 2025-10-06
