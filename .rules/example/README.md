# Rulesets v0.4 Example

This directory demonstrates the proposed v0.4 structure and composition system.

## Structure

```
.rules/example/
├── .ruleset.yaml           # Config (would be in project root)
├── README.md               # This file
└── src/
    ├── core.md             # Core instructions (rule file)
    ├── AGENTS.md           # Composition file (aggregates rules)
    ├── CLAUDE.md           # Composition file (Claude-specific)
    ├── conventions/
    │   ├── typescript.md   # TypeScript conventions (rule file)
    │   └── bun.md          # Bun conventions (rule file)
    └── workflows/
        └── development.md  # Development workflow (rule file)
```

## Design Decisions & Justifications

### 1. No Special File Naming (`.rule.md`, `_prefix.md`)

**Decision:** Use standard `.md` extension for all files. Detect type via content (frontmatter + YAML blocks).

**Justification:**
- **Simpler mental model** - Users don't need to remember special naming conventions
- **Flexibility** - Any file can be a rule, composition, or both simultaneously
- **Backwards compatible** - Works with existing markdown tooling/previews
- **Less friction** - No need to rename files when converting between rule/composition
- **Cleaner filesystem** - No visual clutter from prefixes/suffixes
- **Real-world example** - Your existing `.agents/rules/*.md` files already use plain `.md`

**Trade-off:** Requires reading file content to determine type (acceptable cost for cleaner UX).

### 2. Single `file:` Key (not `file:` + `files:`)

**Decision:** Use `file:` for both single files and globs, with string/object duality.

**Justification:**
- **Consistency** - One mental model: "`file:` includes content"
- **Progressive disclosure** - Simple case (`file: core.md`) doesn't require learning object syntax
- **Less API surface** - Fewer keywords to remember (`file` vs `file`+`files`)
- **Natural upgrade path** - String form → object form when you need filtering
- **Follows common patterns** - Similar to Docker `volume:` (string or object)

**Comparison:**
```yaml
# Rejected: Multiple keywords
file: core.md
files: conventions/*.md

# Accepted: Single keyword, dual form
file: core.md
file:
  glob: conventions/*.md
```

### 3. Relative Paths from `src/` (not absolute or config-driven)

**Decision:** All `file:` paths are relative to `.rules/src/` by default.

**Justification:**
- **Predictability** - Users know where to look without checking config
- **Portable** - Compositions work across projects without path adjustments
- **Matches mental model** - "Rules live in src, compositions reference them"
- **Reduces noise** - No need for `../` or absolute paths in most cases
- **Convention over configuration** - Smart default reduces decision fatigue

**Real-world validation:** Your existing structure has rules in `.agents/rules/` with relative references working naturally.

### 4. Glob-Like Tag Syntax (not array)

**Decision:** Use comma-separated string with wildcards/negation: `tags: public,!internal`

**Justification:**
- **More expressive** - Wildcards (`*security*`) enable pattern matching
- **Negation support** - `!internal` is clearer than `exclude-tags: [internal]`
- **Familiar syntax** - Matches `.gitignore`, glob patterns, CSS selectors
- **Compact** - `tags: public,!draft` vs `tags: [public], exclude-tags: [draft]`
- **Single field** - No need for parallel `tags`/`exclude-tags` arrays

**Comparison:**
```yaml
# Rejected: Multiple arrays
tags: [public, onboarding]
exclude-tags: [internal, draft]

# Accepted: Glob-like string
tags: public,onboarding,!internal,!draft
```

### 5. Provider-Specific Modes (not global only)

**Decision:** Allow `mode:` to be string (global) or object (per-provider).

**Justification:**
- **Addresses core problem** - Different tools have different conventions (AGENTS = one file, Cursor = many files)
- **Flexibility without complexity** - Simple case is still simple (`mode: embed`)
- **Real need** - Your existing `.agents/rules/` shows @mentions pattern that CLAUDE.md uses
- **Solves duplication** - Single source can render as @mention in Claude, full content in AGENTS
- **Progressive disclosure** - Start with `mode: embed`, add provider specificity when needed

**Real-world example from your files:**
```markdown
# In current AGENTS.md - you manually write:
See @.agents/docs/language.md

# With compositions, this becomes:
file: .agents/docs/language.md
mode:
  claude: mention  # Renders as @...
  agents: embed    # Renders full content
```

### 6. Hybrid `heading:` Syntax (boolean | string | object)

**Decision:** Three forms - `heading: true`, `heading: "Text"`, `heading: { text, level, normalize }`

**Justification:**
- **Matches user intent** - 90% of cases need boolean or string
- **Progressive disclosure** - Advanced users get full control without forcing complexity on everyone
- **Reduces repetition** - `heading: title` (use file's title) vs `heading: { text: title }`
- **Intuitive semantics** - Boolean = "use default", String = "use this", Object = "full control"
- **Real-world pattern** - Docker, Kubernetes, Terraform use similar duality (string vs object)

**Comparison:**
```yaml
# Simple cases stay simple
heading: true
heading: "Custom Title"

# Complex cases available when needed
heading:
  text: title
  level: inherit
  normalize: true
```

### 7. Composition Files in `src/` (not separate directory)

**Decision:** AGENTS.md, CLAUDE.md live alongside rule files in `src/`.

**Justification:**
- **Discoverability** - All source content in one place
- **Clear relationship** - Compositions are source files too, not output
- **Simpler structure** - No extra directory layer to understand
- **Flexibility** - Files can be both rule and composition (hybrid use case)
- **Your existing pattern** - Current `AGENTS.md` and `CLAUDE.md` are at root, treating them as source makes sense

**Rejected alternative:** `src/rules/` + `src/compositions/` (too rigid, unnecessary separation)

### 8. Two Composition Approaches (YAML blocks AND root config)

**Decision:** Support both `.md` files with YAML blocks AND `.ruleset.yaml` compositions.

**Justification:**
- **Different use cases** - YAML blocks for complex/narrative, root config for simple aggregation
- **Not mutually exclusive** - Users can mix both approaches
- **YAML blocks win for prose** - When you need headings/explanations between inclusions
- **Root config wins for lists** - When you just want "aggregate these 10 files"
- **Migration path** - Power users can move to root config, others stick with YAML blocks

**Example split:**
```yaml
# Root config for simple aggregation
compositions:
  - name: INDEX
    sections:
      - file: { glob: "*.md" }

# YAML blocks for complex narrative
# src/AGENTS.md with prose between inclusions
```

### 9. Tags in Frontmatter (not filename encoding)

**Decision:** Tags declared in frontmatter: `tags: [public, conventions]`

**Justification:**
- **Explicit** - Clear intent, no parsing ambiguity
- **Multiple tags** - Files can have many tags without filename explosion
- **Standard practice** - Jekyll, Hugo, Obsidian all use frontmatter tags
- **Easy to query** - No regex parsing of filenames
- **Your current pattern** - Existing files already use frontmatter for metadata

### 10. Mode Options: `embed`, `mention`, `link`

**Decision:** Three distinct inclusion modes with clear semantics.

**Justification:**
- **Addresses real needs** - Your AGENTS.md uses @mentions, others need full content
- **Clear semantics** - embed=inline, mention=reference, link=hyperlink
- **Provider-specific** - Tools have different conventions (Claude supports @mentions, others don't)
- **Extensible** - Future modes can be added (e.g., `summary`, `toc`)

**Real-world validation:**
```markdown
# Your current AGENTS.md manually does:
See @.agents/docs/language.md    # mention
See [Overview](overview.md)      # link
[Full content here]              # embed

# Compositions make this explicit:
mode: mention  # @...
mode: link     # [text](path)
mode: embed    # full content
```

### 11. Content-Based Detection (not file extension)

**Decision:** Detect rule files by `ruleset:` frontmatter key, compositions by YAML blocks.

**Justification:**
- **Explicit intent** - Presence of `ruleset:` key clearly marks a file as a rule
- **Standard markdown** - Works with all markdown tools/previews
- **Flexible** - Files can be both rule and composition
- **No special tooling** - Any text editor can create rule files
- **Familiar pattern** - Jekyll, Hugo, Obsidian use frontmatter for file type

### 12. Nested Directory Structure (not flat)

**Decision:** `src/conventions/`, `src/workflows/` subdirectories.

**Justification:**
- **Organization** - Groups related rules logically
- **Scalability** - Projects with 50+ rules need hierarchy
- **Glob patterns** - `conventions/*.md` selects a category
- **Your existing pattern** - Current `.agents/rules/` has subdirectories
- **Clear intent** - Directory name describes content category

### Summary: Design Principles

1. **Convention over configuration** - Smart defaults, override when needed
2. **Progressive disclosure** - Simple syntax for common cases, power for advanced
3. **Content over names** - Detect via frontmatter, not filename patterns
4. **Flexibility without complexity** - Hybrid types (string|object) keep API small
5. **Real-world driven** - Solutions address actual pain points from your existing structure
6. **Markdown-first** - Works with standard tooling, no special file types
7. **Single source of truth** - One rule, multiple outputs via mode routing

## Key Concepts Demonstrated

### 1. Content-Based Detection

No special naming required:
- **Rule file**: Any `.md` with `ruleset:` frontmatter
- **Composition file**: Any `.md` with YAML code blocks
- Files can be both

### 2. Simple Rule Files

See `src/core.md`:
```yaml
---
ruleset:
  version: 0.4.0
name: Core Project Instructions
tags: [core, public]
---

# Content here
```

### 3. Composition Files

See `src/AGENTS.md` for full composition syntax:
```yaml
---
ruleset:
  version: 0.4.0
name: AGENTS
output: .agents/AGENTS.md
---

# Heading

```yaml
file: core.md
heading: true
mode: embed
```
```

### 4. YAML Block Syntax

**Simple file inclusion:**
```yaml
file: core.md
mode: embed
```

**Advanced filtering:**
```yaml
file:
  glob: conventions/*.md
  tags: public,!internal
heading:
  text: title
  level: inherit
mode:
  claude: mention
  agents: embed
```

### 5. Mode Options

- `embed` - Include full content inline
- `mention` - Render as @mention (e.g., `@conventions/typescript`)
- `link` - Render as markdown link

Provider-specific modes:
```yaml
mode:
  claude: mention
  agents: embed
  cursor: link
```

### 6. Tag-Based Filtering

Glob-like pattern for tags:
- `tags: public` - exact match
- `tags: public,onboarding` - has ANY of these
- `tags: *security*` - wildcard match
- `tags: public,!internal` - include public, exclude internal

## Comparison with Current Structure

**Current (`.agents/rules/`):**
- Flat structure with separate files
- Manual aggregation
- No composition system
- Duplicated content across providers

**Proposed (`.rules/src/`):**
- Source files with metadata
- Composition files for aggregation
- Provider-specific routing (mention vs embed vs link)
- Single source of truth

## Example Output

**For `agents` provider** (`AGENTS.md`):
- Core embedded
- All conventions embedded
- All workflows embedded

**For `claude` provider** (`CLAUDE.md`):
- Core embedded
- Conventions as @mentions
- Development workflow embedded
- Other workflows as @mentions

**For `cursor` provider** (`.cursor/rules/*.mdc`):
- Individual files (not aggregated)
- Standard Cursor format

## Next Steps

This example validates the design. Implementation requires:
1. Config migration (`.ruleset/config.*` → `.ruleset.yaml` at root)
2. YAML block parser
3. Composition renderer
4. Mode routing logic
5. Tag filtering
6. Build manifest (`.rules/history.json`)
