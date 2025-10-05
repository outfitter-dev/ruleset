# Ruleset Examples - Before & After Comparison

This document shows the **dramatic simplification** achieved with the slots & variables system.

## The Challenge

Today, developers write rules in one of two ways:

1. **Manual duplication** - Copy-paste the same content across multiple tool configs
2. **Complex templating** - Use Handlebars with verbose conditionals and helpers

Both approaches are **painful** and **error-prone**.

## Example: Simple Project

### Before (Traditional Approach)

**Files needed:**
```
.cursor/rules.mdc         (200 lines)
.windsurf/rules.md        (200 lines, 90% duplicate)
CLAUDE.md                 (200 lines, 90% duplicate)
```

**Total:** 600+ lines, massive duplication

**Pain points:**
- Change TypeScript rules? Update 3 files
- Update team contact? Grep and replace
- Add new provider? Copy-paste everything again
- Version drift inevitable
- Hard to review changes

### After (Slots Approach)

**Files needed:**
```
.ruleset/
  config.yaml              (30 lines)
  rules/
    conventions.md         (25 lines)
    _typescript.md         (40 lines)
    _commits.md            (35 lines)
  partials/
    _team-contact.md       (4 lines)
```

**Total:** ~135 lines, **zero duplication**

**Benefits:**
- Change TypeScript rules? Edit one file
- Update team contact? Edit one 4-line file
- Add new provider? Update config.yaml
- Single source of truth
- Easy to review changes

### Side-by-Side: Main Rule File

**Before (.cursor/rules.mdc):**
```markdown
# Simple Project Development Guidelines

**Version:** 1.0.0

**Team:** Engineering
**Contact:** eng-team@example.com
**On-call:** Use PagerDuty rotation

---

<typescript_conventions>

# TypeScript Standards

## Type Safety

- Use `unknown` at boundaries, not `any`
- Use discriminated unions, not enums
- Use `satisfies` for constraint checking, not `as`

[... 150+ more lines ...]

</typescript_conventions>

<commit_conventions>

# Commit Conventions

[... 80+ more lines ...]

</commit_conventions>

---

## Getting Help

- Check project documentation
- Ask in team Slack channel
- Tag Matt Galligan for urgent issues
```

**After (.ruleset/rules/conventions.md):**
```markdown
---
ruleset:
  version: 0.4.0
---

# [[ $project.name ]] Development Guidelines

**Version:** [[ $project.version ]]

[[ team-contact ]]

---

[[ @_typescript.md ]]

---

[[ @_commits.md ]]

---

## Getting Help

- Check project documentation
- Ask in team Slack channel
- Tag [[ $user.name ]] for urgent issues
```

**Result:** 25 lines vs 200+ lines. **8x reduction**.

---

## Example: Monorepo Project

### Before (Traditional Approach)

**Files needed per package:**
```
packages/frontend/
  .cursor/rules.mdc        (250 lines)
  CLAUDE.md                (250 lines, similar)

packages/backend/
  .cursor/rules.mdc        (250 lines, mostly duplicate)
  CLAUDE.md                (250 lines, mostly duplicate)
```

**Total:** 1000+ lines across 4 files

**Pain points:**
- Copy-paste authentication example code
- Hardcode package names everywhere
- Manual updates when code changes
- No way to ensure examples stay current
- Massive duplication between packages

### After (Slots Approach)

**Files needed:**
```
.ruleset/
  config.yaml                    (60 lines)
  rules/
    architecture.md              (50 lines)
  partials/
    _auth-example.md             (45 lines)
    _team-info.md                (4 lines)

packages/
  frontend/src/auth.ts           (actual code, referenced)
  backend/src/auth.ts            (actual code, referenced)
```

**Total:** ~160 lines + live code references

**Benefits:**
- Code examples **automatically update** from source
- `$package.name` resolves per-package automatically
- Single rule definition for all packages
- Provider-specific rendering (Cursor: links, Claude: embeds)
- Security guardrails prevent accidents

### Side-by-Side: Code Inclusion

**Before:**
```markdown
# Authentication Implementation

## Example Code

Here's how we do authentication:

```typescript
// Manually copy-pasted from src/auth.ts
// (hope it doesn't drift!)

export async function authenticate(
  email: string,
  password: string
): Promise<AuthResult> {
  // ... 40 lines of manually copied code ...
}
```

> **Warning:** Remember to update this when auth.ts changes!
```

**After:**
```markdown
# Authentication Implementation

## Example Code

This is **live code** from the repository:

[[ @../../packages/frontend/src/auth.ts ]]
```

**Result:**
- **Automatic updates** when code changes
- **Security validated** (can't reference secrets)
- **Wrapped automatically** in ```typescript blocks
- **Single line** vs manual copy-paste

---

## Migration Path

### Step 1: Create Structure

```bash
mkdir -p .ruleset/rules .ruleset/partials
```

### Step 2: Extract Common Content

Move duplicated content into partials:

```bash
# TypeScript rules (appears in all 3 files)
.cursor/rules.mdc (lines 20-80) → .ruleset/rules/_typescript.md

# Commit rules (appears in all 3 files)
.cursor/rules.mdc (lines 90-150) → .ruleset/rules/_commits.md

# Team contact (appears in all 3 files)
.cursor/rules.mdc (lines 5-8) → .ruleset/partials/_team-contact.md
```

### Step 3: Write Main Rule with Slots

`.ruleset/rules/conventions.md`:
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

### Step 4: Configure

`.ruleset/config.yaml`:
```yaml
project:
  name: "My Project"
  version: "1.0.0"

slots:
  team-contact: partials/_team-contact.md
  typescript:
    file: rules/_typescript.md
    wrap: xmlTag
  commits:
    file: rules/_commits.md
    wrap: xmlTag

providers:
  cursor:
    enabled: true
  claude:
    enabled: true
  windsurf:
    enabled: true
```

### Step 5: Build

```bash
rules build
```

**Output:**
- `.cursor/rules/conventions.mdc` (with XML tags)
- `AGENTS.md` (aggregated)
- `.windsurf/rules/conventions.md` (clean markdown)

### Step 6: Delete Old Files

```bash
rm .cursor/rules.mdc
rm CLAUDE.md
rm .windsurf/rules.md
```

**Done!** You now have:
- ✅ Single source of truth
- ✅ Automatic build process
- ✅ Provider-specific outputs
- ✅ Zero duplication

---

## Complexity Comparison

### Traditional Approach

| Task | Effort |
|------|--------|
| Add TypeScript rule | Edit 3 files (20 min) |
| Update team contact | Find/replace across 3 files (10 min) |
| Add new provider | Copy-paste everything (30 min) |
| Keep in sync | Constant vigilance + diff checking |
| Review changes | Scroll through 600+ line diffs |

**Total maintenance:** High, ongoing, error-prone

### Slots Approach

| Task | Effort |
|------|--------|
| Add TypeScript rule | Edit `_typescript.md` (5 min) |
| Update team contact | Edit 4-line file (1 min) |
| Add new provider | Add 3 lines to config.yaml (2 min) |
| Keep in sync | Automatic on build |
| Review changes | Review focused diffs in source files |

**Total maintenance:** Low, automated, reliable

---

## Key Takeaways

1. **Write once, compile everywhere** - DRY principle applied to rules
2. **Variables eliminate hardcoding** - `[[ $project.name ]]` updates everywhere
3. **Slots enable composition** - Build complex rules from simple parts
4. **Provider-specific rendering** - Same source, different outputs
5. **Live code inclusion** - Examples stay current automatically
6. **Security by default** - Safe guardrails prevent mistakes

## Try the Examples

```bash
# Simple project (basic slots)
bun run sandbox:setup simple-project

# Monorepo (advanced features)
bun run sandbox:setup monorepo-project

# Experiment freely!
cd examples/sandbox/simple-project
rules build
```

See individual template READMEs for more details.
