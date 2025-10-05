# Examples Summary

## What We Built

Two complete example projects demonstrating the **slots & variables** system:

### 1. `simple-project/` - The Basics

**Goal:** Show how simple and DRY rules can be.

**Files created:**
- `README.md` - Template overview
- `BEFORE.md` - Traditional approach (what users do today)
- `.ruleset/config.yaml` - Project config with slots
- `.ruleset/rules/conventions.md` - **25 lines** (vs 200+ traditional)
- `.ruleset/rules/_typescript.md` - Reusable TypeScript rules
- `.ruleset/rules/_commits.md` - Reusable commit conventions
- `.ruleset/partials/_team-contact.md` - Team info partial

**Key demonstrations:**
```markdown
# Variables (no pre-declaration needed)
[[ $project.name ]]
[[ $project.version ]]
[[ $user.name ]]

# File composition
[[ @_typescript.md ]]
[[ @_commits.md ]]

# Named slots
[[ team-contact ]]
```

**Result:** **8x code reduction** - from 600+ lines (duplicated) to ~135 lines (DRY)

---

### 2. `monorepo-project/` - Advanced Features

**Goal:** Show provider-specific rendering and dynamic code inclusion.

**Files created:**
- `README.md` - Advanced template overview
- `package.json` - Monorepo root
- `packages/frontend/package.json` - `@org/frontend`
- `packages/backend/package.json` - `@org/backend`
- `packages/frontend/src/auth.ts` - **Real code** (referenced in rules)
- `packages/backend/src/auth.ts` - **Real code** (referenced in rules)
- `.ruleset/config.yaml` - Advanced config with security
- `.ruleset/rules/architecture.md` - Main rule with code refs
- `.ruleset/partials/_auth-example.md` - Example with live code
- `.ruleset/partials/_team-info.md` - Team info

**Key demonstrations:**

```yaml
# Security configuration
security:
  allowedPaths: [packages/**/src/**]
  denyPatterns: ['**/.env*', '**/*.key']
  maxFileSizeKb: 500

# Provider-specific rendering
slots:
  auth-example:
    cursor:
      mode: reference      # `@file`
    claude:
      mode: embed          # Full content
      wrap: xmlTag.example
```

```markdown
# Package-aware variables
[[ $package.name ]]  # Resolves to @org/frontend or @org/backend

# Live code inclusion
[[ @../../packages/frontend/src/auth.ts ]]
```

**Result:** Code examples **automatically update** when source changes!

---

## The Big Picture

### Before (Traditional)

**Per project:**
- `.cursor/rules.mdc` (200 lines)
- `.windsurf/rules.md` (200 lines, 90% duplicate)
- `CLAUDE.md` (200 lines, 90% duplicate)

**Total:** 600+ lines, massive duplication

**Problems:**
- Change TypeScript rules → update 3 files
- Add provider → copy-paste everything
- Code examples drift from reality
- Version skew inevitable

### After (Slots)

**Per project:**
- `.ruleset/config.yaml` (30 lines)
- `.ruleset/rules/conventions.md` (25 lines)
- `.ruleset/rules/_typescript.md` (40 lines)
- `.ruleset/rules/_commits.md` (35 lines)
- `.ruleset/partials/_team-contact.md` (4 lines)

**Total:** ~135 lines, zero duplication

**Benefits:**
- Change TypeScript rules → edit one file
- Add provider → 3 lines in config
- Code examples auto-update from source
- Single source of truth

---

## What Users Will Love

1. **Simplicity** - `[[ $project.name ]]` just works
2. **DRY** - Write once, compile everywhere
3. **Live code** - Examples stay current automatically
4. **Provider-aware** - Same source, different outputs
5. **Security** - Can't accidentally include secrets
6. **Maintainability** - Change once, propagate everywhere

---

## Migration Path (For Users)

### Step 1: Extract Common Content

```bash
# Move duplicated rules into partials
mv .cursor/rules.mdc .ruleset/rules/_old-cursor.md

# Extract sections
# TypeScript rules (lines 20-80) → _typescript.md
# Commit rules (lines 90-150) → _commits.md
# Team contact (lines 5-8) → _team-contact.md
```

### Step 2: Write Main Rule

```markdown
---
ruleset:
  version: 0.4.0
---

# [[ $project.name ]] Guidelines

[[ team-contact ]]
[[ @_typescript.md ]]
[[ @_commits.md ]]
```

### Step 3: Configure

```yaml
project:
  name: "My Project"
  version: "1.0.0"

slots:
  team-contact: partials/_team-contact.md

providers:
  cursor: { enabled: true }
  claude: { enabled: true }
```

### Step 4: Build & Verify

```bash
rules build

# Check outputs
diff .cursor/rules/conventions.mdc .ruleset/rules/_old-cursor.md

# If good, delete old files
rm .ruleset/rules/_old-cursor.md
```

**Done!** Now maintaining rules is 10x easier.

---

## File Structure Overview

```
examples/
  COMPARISON.md              # Before/after guide
  SUMMARY.md                 # This file

  templates/
    simple-project/
      README.md              # Template docs
      BEFORE.md              # Traditional approach example
      .ruleset/
        config.yaml          # Project config
        rules/
          conventions.md     # Main rule (25 lines!)
          _typescript.md     # Partial
          _commits.md        # Partial
        partials/
          _team-contact.md   # Reusable content

    monorepo-project/
      README.md              # Advanced template docs
      package.json           # Monorepo root
      packages/
        frontend/
          package.json       # @org/frontend
          src/auth.ts        # Real code (referenced)
        backend/
          package.json       # @org/backend
          src/auth.ts        # Real code (referenced)
      .ruleset/
        config.yaml          # Advanced config
        rules/
          architecture.md    # Main rule
        partials/
          _auth-example.md   # Live code example
          _team-info.md      # Team info
```

---

## Key Innovations

1. **Direct variable usage** - No frontmatter required
2. **Smart package resolution** - `$package.name` finds nearest package.json
3. **Live code inclusion** - Reference actual source files safely
4. **Provider modes** - Same slot, different rendering per tool
5. **Security guardrails** - Can't include secrets/gitignored files
6. **Automatic wrapping** - Code blocks, XML tags applied automatically

---

## What's Next

Users can now:

1. **Try examples** - `bun run sandbox:setup simple-project`
2. **See the difference** - Read `COMPARISON.md`
3. **Migrate gradually** - Start with one rule file
4. **Scale up** - Add more partials as needed
5. **Go advanced** - Try code inclusion when ready

The examples make it **obvious** why slots are better than manual duplication or complex Handlebars templates.
