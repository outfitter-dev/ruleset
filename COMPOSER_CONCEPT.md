# Ruleset Composition System – Slots & Variables

> [!NOTE]
> Handlebars is moving behind an explicit feature flag in v0.4+. The default path—and the focus of this doc—is the Ruleset composer syntax (`[[ … ]]`). You only opt into Handlebars when you truly need advanced logic.

## Core Philosophy: Simplicity First

The Ruleset composition system is designed around a single principle: **make simple things simple, complex things possible**.

Instead of requiring users to learn complex configuration hierarchies, profiles, and targets upfront, Ruleset provides:

1. **Direct variable interpolation** – Use `[[ $project.name ]]` inline without pre-declaration
2. **Intuitive slot syntax** – Reference files with `[[ @file.md ]]` to compose content
3. **Smart defaults** – Sensible behavior out of the box, with escape hatches for customization
4. **Minimal markup** – Valid, previewable Markdown that compiles to provider-specific outputs

### Relationship to Handlebars

Ruleset supports **two templating approaches**, but the Handlebars path is now an opt-in, advanced feature:

**Ruleset Slots (Simple)** – Built-in `[[ ]]` syntax for:
- Variable interpolation: `[[ $project.name ]]`
- File composition: `[[ @conventions.md ]]`
- Simple, declarative, no logic required
- **Default for 99% of use cases**

**Handlebars (Advanced, Feature-Flagged)** – Enable via `ruleset.template: true` (or future `--enable-handlebars`) when you need:
- Conditional logic: `{{#if}}...{{/if}}`
- Loops: `{{#each}}...{{/each}}`
- Custom helpers: `{{myHelper arg}}`
- Provider-specific branching that slots/config cannot express

If you do not supply the flag, Handlebars blocks are ignored to keep the authoring surface consistent. Slots always compile.

## Terminology

| Term | Definition | Example |
|------|------------|---------|
| **Slot** | Placeholder in Markdown that gets replaced during compilation | `[[ team-contact ]]` |
| **Variable** | Dynamic value interpolated at compile time | `[[ $project.name ]]` |
| **Mode** | How a file reference renders (embed, reference, mention, link) | `mode: embed` |
| **Wrap** | Formatting applied around slot content (XML tags, code blocks, callouts) | `wrap: xmlTag` |
| **Slug** | Identifier derived from filename or frontmatter | `typescript_conventions` |

## Slot Syntax

### Slot Reference

```markdown
[[ key ]]                # Named slot (defined in frontmatter/config)
[[ @file.md ]]          # Import entire file
[[ $var.path ]]         # Variable interpolation
```

### Rules

1. **Slots are NOT headings** – Don't add headings before slots unless the content itself has no heading
2. **Variables resolve first** – Before slot expansion, all `[[ $... ]]` are replaced
3. **Undefined slots collapse** – Missing slots remove themselves and normalize whitespace
4. **No loops** – Circular references are detected and blocked

## Variables

### Built-in Variable Scopes

Variables are resolved from configuration files and project metadata automatically:

```markdown
[[ $project.name ]]      # From .ruleset/config.yaml
[[ $package.name ]]      # From nearest package.json
[[ $cargo.name ]]        # From nearest Cargo.toml
[[ $user.name ]]         # From ~/.config/rulesets/config.yaml or git config
[[ $file.name ]]         # Current file being compiled
[[ $this.file.name ]]    # File being imported (within a slot)
[[ $provider.id ]]       # Current provider (cursor, claude, etc.)
```

### Variable Reference Table

| Variable | Source | Example Value |
|----------|--------|---------------|
| `$project.name` | `.ruleset/config.yaml` | `"My Project"` |
| `$project.version` | `.ruleset/config.yaml` | `"2.0.0"` |
| `$project.author` | `.ruleset/config.yaml` | `"Engineering Team"` |
| `$package.name` | Nearest `package.json` to output | `"@org/frontend"` |
| `$package.version` | `package.json` | `"1.2.3"` |
| `$package.license` | `package.json` | `"MIT"` |
| `$cargo.name` | Nearest `Cargo.toml` | `"my-crate"` |
| `$cargo.version` | `Cargo.toml` | `"0.1.0"` |
| `$user.name` | Global config or `git config user.name` | `"Matt Galligan"` |
| `$user.email` | Global config or `git config user.email` | `"matt@example.com"` |
| `$user.github` | `~/.config/rulesets/config.yaml` | `"galligan"` |
| `$file.name` | Current file context | `"conventions.md"` |
| `$file.path` | Relative from project root | `"rules/conventions.md"` |
| `$file.slug` | Frontmatter or derived | `"conventions"` |
| `$this.file.name` | Slot source file (when inside slot) | `"_typescript.md"` |
| `$this.file.path` | Slot source path | `"rules/_typescript.md"` |
| `$this.file.slug` | Slot source slug | `"typescript_conventions"` |
| `$provider.id` | Current compile target | `"cursor"` |
| `$provider.name` | Display name | `"Cursor"` |

### Configuration Files

**.ruleset/config.yaml** (project-level):
```yaml
project:
  name: "My Awesome Project"
  version: "2.0.0"
  author: "Engineering Team"

slots: {}
```

**~/.config/rulesets/config.yaml** (user-level):
```yaml
user:
  name: "Matt Galligan"
  email: "matt@example.com"
  github: "galligan"
```

### Variable Scope Rules

**At top level (not in a slot):**
- `$file.name` = current file
- `$this.file.name` = same as `$file.name`

**Inside a slot expansion:**
- `$file.name` = parent file (the one importing)
- `$this.file.name` = slot source file (the one being imported)

**Example:**

```markdown
<!-- main.md -->
# [[ $project.name ]] Guidelines

Author: [[ $file.name ]]    <!-- "main.md" -->

[[ @_typescript.md ]]
```

```markdown
<!-- _typescript.md -->
# TypeScript Standards

From: [[ $this.file.name ]]   <!-- "_typescript.md" -->
Parent: [[ $file.name ]]       <!-- "main.md" -->
```

### Package Resolution

**Smart resolution based on output path:**

For monorepos, `$package.*` variables resolve to the **nearest package.json** relative to where the compiled output will be written.

```
project/
  package.json                    # { name: "monorepo-root" }
  .ruleset/
    rules/
      conventions.md
  packages/
    frontend/
      package.json                # { name: "@org/frontend" }
    backend/
      package.json                # { name: "@org/backend" }
```

**When compiling for Cursor:**
- Output: `packages/frontend/.cursor/rules/conventions.md`
- `[[ $package.name ]]` → `@org/frontend`

**When compiling for backend:**
- Output: `packages/backend/.cursor/rules/conventions.md`
- `[[ $package.name ]]` → `@org/backend`

## Slots Configuration

### Simple Slots (Named References)

```yaml
# Frontmatter or .ruleset/config.yaml
slots:
  team-contact: _team.md
  security-notice: _security.md
```

```markdown
Contact: [[ team-contact ]]

[[ security-notice ]]
```

### File Imports

```markdown
[[ @_typescript.md ]]
```

No configuration needed – directly references file.

### Slot Configuration Options

```yaml
slots:
  # Simple file reference
  conventions: _conventions.md

  # With heading
  typescript:
    file: _typescript.md
    heading: "TypeScript Standards"

  # With wrapping
  security:
    file: _security.md
    wrap: xmlTag  # Uses slot key as tag name

  # Custom XML tag
  auth:
    file: _auth.md
    wrap:
      xmlTag: authentication

  # Code wrapping
  example:
    file: ../src/auth.ts
    wrap: typescript  # Shorthand for wrap: { code: typescript }

  # Code with annotation
  config:
    file: ../config/app.yaml
    wrap:
      code: yaml
      annotation: "Application Configuration"

  # Nested wrapping (inside-out order)
  secure-example:
    file: ../src/example.ts
    wrap:
      - typescript           # innermost
      - xmlTag.example       # middle
      - xmlTag.security      # outermost

  # Callout wrapping
  warning:
    file: _warning.md
    wrap:
      callout: warning
      title: "Security Notice"

  # Provider-specific
  shared:
    file: _shared.md
    cursor: false            # Don't include in Cursor output

  multi-provider:
    file: _conventions.md
    cursor:
      mode: reference        # `@file` in Cursor
    claude:
      mode: embed            # Inline content in Claude
      wrap: xmlTag.instructions
    windsurf:
      mode: link             # [](./file) in Windsurf
```

### Heading Behavior

**Auto-heading (from slot content):**
```yaml
slots:
  conventions:
    file: _conventions.md
    heading: true
```

**Resolution priority:**
1. Frontmatter `slug` value
2. First heading in content
3. Derived from filename (`_conventions.md` → `Conventions`)

**Custom heading text:**
```yaml
heading: "Team Conventions"
```

**Prepend mode (preserve original headings):**
```yaml
heading:
  text: "Overview"
  prepend: true  # Keeps original headings, shifts them +1
```

**Example:**

_security.md:
```markdown
# Security Rules

## Authentication
## Authorization
```

With `heading: { text: "Security Overview", prepend: true }`:
```markdown
## Security Overview

### Security Rules

#### Authentication
#### Authorization
```

**Without prepend:**
```markdown
## Security Overview

Authentication
Authorization
```

## Wrapping

### XML Tags

```yaml
wrap: xmlTag              # Uses slot key as tag: <slot-key>...</slot-key>
wrap: xmlTag.custom_name  # Custom tag: <custom_name>...</custom_name>
wrap:
  xmlTag: my_tag          # Explicit: <my_tag>...</my_tag>
```

**Output:**
```markdown
<typescript_conventions>
# TypeScript Standards
...
</typescript_conventions>
```

### Code Blocks

```yaml
wrap: typescript          # Shorthand
wrap: code                # Default to markdown
wrap: true                # Auto-detect from file extension

wrap:
  code: typescript
  annotation: "From src/auth.ts"
```

**Output:**
````markdown
```typescript From src/auth.ts
// code here
```
````

**Backtick auto-increment:**

If content contains backticks, wrapper increments to prevent nesting issues:

Content has ` ```markdown ` → wrapper uses ` ```` `
Content has ` ```` ` → wrapper uses ` ````` `

### Callouts (GitHub-flavored)

```yaml
wrap:
  callout: warning
  title: "Important Notice"
```

**Output:**
```markdown
> [!WARNING] Important Notice
> Content here
```

**Supported types:** `note`, `tip`, `important`, `warning`, `caution`

### Nested Wrapping

```yaml
wrap:
  - typescript       # innermost
  - xmlTag.example
  - callout.note     # outermost
```

**Output:**
```markdown
> [!NOTE]
> <example>
> ```typescript
> // code
> ```
> </example>
```

## Provider-Specific Rendering

### Modes

| Mode | Description | Example Output |
|------|-------------|----------------|
| `embed` | Inline full content (default) | `<actual file content>` |
| `reference` | Backtick-wrapped mention | `` `@file.md` `` |
| `mention` | Bare mention | `@file.md` |
| `link` | Markdown hyperlink | `[file](./file.md)` |

### Configuration

```yaml
slots:
  "@conventions.md":
    cursor:
      mode: reference
    claude:
      mode: embed
      wrap: xmlTag.instructions
    windsurf:
      mode: link
```

**Usage:**
```markdown
[[ @conventions.md ]]
```

**Cursor output:**
```markdown
`@conventions.md`
```

**Claude output:**
```markdown
<instructions>
# Conventions

Content here...
</instructions>
```

**Windsurf output:**
```markdown
[conventions](./conventions.md)
```

### Disabling Providers

```yaml
slots:
  internal-docs:
    file: _internal.md
    cursor: false      # Skip in Cursor
    windsurf: false    # Skip in Windsurf
```

### Inheritance

**Slot source can define provider preferences:**

_conventions.md frontmatter:
```yaml
---
cursor: false
---
```

**Parent can override:**
```yaml
slots:
  "@_conventions.md":
    cursor: true  # Re-enable for this usage
```

## Dynamic Code Inclusion

### Direct File References

```yaml
slots:
  auth-implementation:
    file: ../src/auth.ts
    wrap: true  # Auto-detects typescript
```

**Security guardrails automatically applied:**
- Only relative paths allowed
- Cannot escape project root
- Respects `.gitignore`
- Blocks secret patterns (`.env`, `*.key`, etc.)
- File size limits (default 500KB)

### Security Configuration

**Defaults (hardcoded):**
```yaml
security:
  allowedPaths:
    - .ruleset/**
    - src/**
    - lib/**
    - packages/**
    - apps/**

  denyPatterns:
    - '**/.env*'
    - '**/*.key'
    - '**/*.pem'
    - '**/secrets/**'
    - '**/node_modules/**'

  respectGitignore: true
  allowAbsolutePaths: false
  maxFileSizeKb: 500
```

**Custom overrides (.ruleset/config.yaml):**
```yaml
security:
  allowedPaths:
    - .ruleset/**
    - src/**
    - examples/**      # Add custom path

  denyPatterns:
    - '**/.env*'
    - '**/internal/**' # Add custom deny

  maxFileSizeKb: 1000  # Increase limit
```

**Init stub (rules init):**

```yaml
# Security settings for code file inclusion
# Defaults shown below - uncomment to customize
#
# security:
#   allowedPaths:
#     - .ruleset/**
#     - src/**
#     - lib/**
#   denyPatterns:
#     - '**/.env*'
#     - '**/*.key'
#     - '**/secrets/**'
#   respectGitignore: true
#   maxFileSizeKb: 500
```

## File Organization

### Recommended Structure

```
.ruleset/
  config.yaml
  rules/
    conventions.md        # Main rule
    security.md           # Main rule
    _typescript.md        # Partial (leading _)
    _commits.md           # Partial
    _team-contact.md      # Partial
```

**Partial convention:**
- Leading `_` indicates "meant to be imported"
- Not enforced by compiler
- Visual signal for humans
- Any `.md` file can be imported

### Example: Composed Rule

**conventions.md:**
```markdown
---
ruleset:
  version: 0.4.0

slots:
  "@_typescript.md":
    wrap: xmlTag
  "@_security.md":
    wrap: xmlTag
---

# [[ $project.name ]] Development Guidelines

Built with [[ $package.name ]] v[[ $package.version ]]

[[ @_typescript.md ]]

[[ @_security.md ]]
```

**_typescript.md:**
```markdown
---
slug: typescript_conventions
---

# TypeScript Standards

- Strict mode required
- No `any` types
- Prefer `type` over `interface`
```

**_security.md:**
```markdown
---
slug: security_rules
---

# Security Guidelines

- JWT tokens only
- RBAC for authorization
```

**Output:**
```markdown
# My Project Development Guidelines

Built with @org/my-app v1.2.3

<typescript_conventions>
# TypeScript Standards

- Strict mode required
- No `any` types
- Prefer `type` over `interface`
</typescript_conventions>

<security_rules>
# Security Guidelines

- JWT tokens only
- RBAC for authorization
</security_rules>
```

## Undefined Slot Behavior

When a slot cannot be resolved:

```markdown
Before:
## Section 1

[[ undefined-slot ]]


## Section 2

After:
## Section 1

## Section 2
```

**Rules:**
1. Remove the `[[ undefined-slot ]]` marker
2. Collapse whitespace to maximum 1 blank line
3. Log warning (unless `--quiet`)
4. Never create orphaned headings

## Recursive Slots

Slots can reference other slots, with cycle detection:

```yaml
# a.md
slots:
  b: _b.md

# _b.md
slots:
  c: _c.md

# _c.md
slots:
  a: a.md  # Would create cycle
```

**Behavior:**
- Track resolution stack: `[a.md, _b.md, _c.md]`
- When cycle detected: stop expansion, emit warning
- `⚠ Cycle detected: a.md → _b.md → _c.md → a.md`
- Collapse the cyclic slot

## Implementation Architecture

### Execution Order

1. **Load rule file** (parse frontmatter + content)
2. **Interpolate variables** (in frontmatter AND content)
   - `[[ $project.name ]]` → `My Project`
   - `[[ $file.name ]]` → `conventions.md`
3. **Parse slots** (find all `[[ key ]]` and `[[ @file ]]` markers)
4. **Resolve slots recursively**
   - Load referenced files
   - Interpolate variables in imported content
   - Apply wrapping/heading configuration
   - Detect cycles
5. **Provider-specific transforms**
   - Apply mode (embed/reference/mention/link)
   - Provider overrides
6. **Emit final output**

### Variable Resolution Chain

```typescript
interface VariableResolver {
  resolve(path: string, context: CompileContext): Promise<string | undefined>
}

const resolvers = [
  new FileVariableResolver(),       // $file.*
  new ThisVariableResolver(),       // $this.file.*
  new ProjectVariableResolver(),    // $project.*
  new PackageVariableResolver(),    // $package.*
  new CargoVariableResolver(),      // $cargo.*
  new UserVariableResolver(),       // $user.*
  new ProviderVariableResolver(),   // $provider.*
  new DateVariableResolver(),       // $date.*
]
```

**Resolution example:**

```
[[ $package.name ]]
  → PackageVariableResolver.resolve("package.name", context)
  → Find nearest package.json to context.outputPath
  → Read package.json, extract "name" field
  → Return "@org/frontend"
```

### Security Validation

```typescript
async function validateFileAccess(
  filepath: string,
  config: SecurityConfig
): Promise<{ allowed: boolean, reason?: string }> {

  // 1. Block absolute paths
  if (path.isAbsolute(filepath) && !config.allowAbsolutePaths) {
    return { allowed: false, reason: 'Absolute paths not allowed' }
  }

  // 2. Block path traversal
  const resolved = path.resolve(projectRoot, filepath)
  if (!resolved.startsWith(projectRoot)) {
    return { allowed: false, reason: 'Path escapes project root' }
  }

  // 3. Check deny patterns (deny wins)
  for (const pattern of config.denyPatterns) {
    if (micromatch.isMatch(filepath, pattern)) {
      return { allowed: false, reason: `Matches deny pattern: ${pattern}` }
    }
  }

  // 4. Check gitignore
  if (config.respectGitignore && isGitignored(filepath)) {
    return { allowed: false, reason: 'File is gitignored' }
  }

  // 5. Check allowed patterns
  const allowed = config.allowedPaths.some(pattern =>
    micromatch.isMatch(filepath, pattern)
  )
  if (!allowed) {
    return { allowed: false, reason: 'Not in allowedPaths' }
  }

  // 6. Check file size
  const stats = await fs.stat(resolved)
  const sizeKb = stats.size / 1024
  if (sizeKb > config.maxFileSizeKb) {
    return {
      allowed: false,
      reason: `File too large: ${sizeKb.toFixed(1)}KB (max ${config.maxFileSizeKb}KB)`
    }
  }

  return { allowed: true }
}
```

## CLI Commands

```bash
# Initialize project with config stub
rules init

# Build with default settings
rules build

# Build with diagnostics
rules build --why

# Override provider mode
rules build --cursor-mode=reference

# Show resolved configuration
rules config show

# Get specific config value
rules config get project.name

# Set config value
rules config set project.name "My Project"
```

## Migration from Handlebars

### Before (Handlebars)

```yaml
---
ruleset:
  template: true
---

# {{project.name}} Guidelines

{{> partial-header}}

{{#if (eq provider "cursor")}}
Use `Cmd+K` for inline chat.
{{/if}}
```

### After (Slots)

```yaml
---
slots:
  header: _header.md
  cursor-tips:
    file: _cursor-tips.md
    cursor: { mode: embed }
    claude: false
---

# [[ $project.name ]] Guidelines

[[ header ]]

[[ cursor-tips ]]
```

**Benefits:**
- No template opt-in required
- Cleaner, more readable Markdown
- Provider logic in config, not content
- Still valid Markdown preview

### When to Use Handlebars

Use Handlebars when you need:
- **Conditional logic** (beyond provider-specific files)
- **Loops** (iterate over arrays)
- **Computed values** (string manipulation, math)
- **Custom helpers** (advanced transforms)

**Example valid Handlebars use case:**

```handlebars
{{#each team.members}}
- {{name}} ({{role}}) - {{email}}
{{/each}}
```

This **cannot** be done with slots. Use `ruleset.template: true` and Handlebars.

## Goals & Benefits

### What This System Achieves

1. **Simplicity** – Most rules need only variables and file imports
2. **Composability** – Build complex rules from small, focused files
3. **Provider-awareness** – Same source, different outputs per tool
4. **Security** – Safe code inclusion with sensible defaults
5. **Flexibility** – Escape hatches for advanced needs (Handlebars)
6. **Previewability** – Valid Markdown that renders correctly
7. **Maintainability** – Clear separation of content and configuration

### Design Principles

1. **Convention over configuration** – Smart defaults, minimal setup
2. **Progressive disclosure** – Simple things simple, complex things possible
3. **Self-documenting** – Intent visible in source files
4. **Non-destructive** – Import and customize without forking
5. **Fail gracefully** – Undefined slots collapse, don't break compilation

## Future Enhancements (Post-v0.4)

### Symbol Extraction

```yaml
slots:
  hash-function:
    file: ../src/crypto.ts
    symbol: hashPassword  # Extract specific function
    wrap: typescript
```

Parse TypeScript/JavaScript with AST, extract named exports/functions.

### Computed Variables

```yaml
variables:
  full_name: "[[ $user.name ]] <[[ $user.email ]]>"
  current_year: "{{ date.year }}"
```

### Directory-Level Configuration

```
.ruleset/
  rules/
    frontend/
      .context.yaml    # Applies to all files in frontend/
```

Auto-apply configuration based on file location.

## Complete Syntax Reference

### Slot References
```markdown
[[ key ]]                # Named slot
[[ @file.md ]]          # File import
[[ $var.path ]]         # Variable interpolation
```

### Configuration (Frontmatter or .ruleset/config.yaml)
```yaml
slots:
  # Simple
  key: _file.md

  # With config
  example:
    file: _example.md
    heading: true
    wrap: xmlTag

  # Custom heading
  standards:
    file: _standards.md
    heading: "Team Standards"

  # Prepend mode
  security:
    file: _security.md
    heading:
      text: "Overview"
      prepend: true

  # Code wrapping
  code-example:
    file: ../src/example.ts
    wrap: typescript

  # Code with annotation
  config:
    file: ../config.yaml
    wrap:
      code: yaml
      annotation: "App Config"

  # Nested wrapping
  secure:
    file: _auth.ts
    wrap:
      - typescript
      - xmlTag.example
      - callout.warning

  # Provider-specific
  multi:
    file: _shared.md
    cursor:
      mode: reference
    claude:
      mode: embed
      wrap: xmlTag.instructions
    windsurf: false
```

### Variables
```yaml
# Project (.ruleset/config.yaml)
project:
  name: "My Project"
  version: "1.0.0"

# User (global ~/.config/rulesets/config.yaml)
user:
  name: "Your Name"
  github: "username"

# Security
security:
  allowedPaths: [.ruleset/**, src/**]
  denyPatterns: ['**/.env*', '**/*.key']
  maxFileSizeKb: 500
```

## Summary

The Ruleset composition system provides a **simple, powerful way to build maintainable rules** that work across multiple AI coding tools.

**Key features:**
- ✅ Direct variable interpolation (`[[ $project.name ]]`)
- ✅ Intuitive file composition (`[[ @file.md ]]`)
- ✅ Provider-specific rendering (same source, different outputs)
- ✅ Flexible wrapping (XML, code blocks, callouts)
- ✅ Safe code inclusion (security guardrails)
- ✅ Graceful degradation (undefined slots collapse)
- ✅ Valid, previewable Markdown

**Philosophy:**
- Make simple things simple (variables + file imports)
- Make complex things possible (Handlebars for advanced logic)
- Prefer declarative configuration over markup
- Keep source files readable and maintainable

**Next steps:**
1. Implement variable interpolation engine
2. Build slot resolution system
3. Add wrapping transforms
4. Integrate provider-specific rendering
5. Ship v0.4.0 with core features
6. Iterate based on real-world usage
