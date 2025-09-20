# Mixdown Compiler Implementation Patterns

TLDR: Essential patterns and structures needed for the mixdown compiler implementation
TLDR: Guidelines for transforming Source Rules files into destination-specific rules files

This document outlines key implementation patterns that the Mixdown compiler needs to handle based on analysis of various destination systems. These patterns represent the diverse ways AI assistants manage rules across different tools.

The Mixdown compiler needs to convert a single source format (Source Rules files) into tool-specific rules files for different AI assistant platforms. Each destination has unique requirements for file location, format, activation mechanisms, and content organization that must be handled appropriately.

## File Location and Loading Patterns

### Hierarchical Loading

**Tools**: Claude Code, Cursor, Windsurf

Claude Code implements a sophisticated hierarchical loading system:

```text
$HOME/.claude/CLAUDE.md                   # Global user preferences
<repo-root>/CLAUDE.md                     # Project-wide rules
<current-directory>/CLAUDE.md             # Directory-specific rules
<parent-directories>/CLAUDE.md            # Parent directory rules (if navigating deeper)
```

Claude Code's unique `@file` syntax resolves paths relative to the current file location and processes imports recursively.

Cursor (v0.50+) supports nested rule directories with automatic scoping:

```text
project/
├── .cursor/                       # Project root rules
│   └── rules/
│       ├── always-style.mdc
│       └── api-conventions.mdc
├── frontend/
│   ├── .cursor/                  # Subdirectory-specific rules
│   │   └── rules/
│   │       └── react-standards.mdc  # Only loaded when working in frontend/
```

### Mode-Specific Organization

**Tools**: Roo Code

Roo Code organizes rules by AI operational mode:

```text
<repo-root>/.roo/rules/                   # Common rules (all modes)
<repo-root>/.roo/rules-{mode}/            # Mode-specific rules (architect, debug, etc.)
```

Specific modes include architect, debug, and docs-writer, with each having specialized content tailored to the AI's behavior in that mode. Content is loaded based on which mode is currently active.

### Manual Loading

**Tools**: Aider

Aider requires explicit inclusion at startup:

```bash
aider --memory-file .aider.memory.md
```

## Content Organization Patterns

### Import Mechanisms

**Tools**: Claude Code

Claude Code's `@file` syntax for modular content:

```markdown
# Project Guidelines

See @docs/ARCHITECTURE.md for the system overview.
```

### Front-matter Control

**Tools**: Cursor

Cursor uses YAML front-matter for rule behavior:

```yaml
---
description: React Component Standards
globs: ['**/components/**/*.tsx']
alwaysApply: false
---
```

## Activation Mechanisms

### Always Apply

**Tools**: Cursor, Windsurf

Cursor example:

```yaml
---
alwaysApply: true
---
```

Windsurf example (v1.9+):

```yaml
---
trigger: always_on
---
```

### Pattern-Based (Glob) Activation

**Tools**: Cursor, Windsurf

Cursor example:

```yaml
---
globs: ['**/*.py', '**/*.ipynb']
---
```

Windsurf example (v1.9+):

```yaml
---
trigger: glob
globs: '**/*.tsx'
---
```

Both tools support file pattern matching to apply rules only to relevant files.

### Model Decision Activation

**Tools**: Windsurf, Cursor

Windsurf implements this through the `model_decision` trigger type with a description field:

```yaml
---
trigger: model_decision
description: 'USE WHEN working with database schema'
---
```

Cursor implements this through "Agent-Requested" rules with a description field:

```yaml
---
description: 'USE WHEN working with database schema'
---
```

In both tools, the AI sees these descriptions and can fetch the full rule content if deemed relevant to the user's query.

### Manual Activation

**Tools**: Windsurf, Aider, Cursor

Rules that are only applied when explicitly selected by the user.

Windsurf example (v1.9+):

```yaml
---
trigger: manual
---
```

These are activated only when the user types `@rule-name` in Windsurf.

## Resource Management

### Character Limits

**Tools**: Windsurf

Windsurf implements strict character limits:

- 6K characters per rule file
- 12K characters total across all rules

## File Formats

### Standard Markdown (.md)

**Tools**: Claude Code, Roo Code, Aider, Windsurf

Example from Aider:

```markdown
# Project Context

This project is a React application with a Node.js backend.

# Coding Standards

- Use functional components for all new React code
- Follow ESLint rules in .eslintrc
```

### Markdown with Front-matter (.mdc)

**Tools**: Cursor

```markdown
---
description: 'Database Schema'
---

# Database Structure

Tables and relationships...
```

## Destination-Specific Requirements

### GitHub Copilot

- Repository-level instructions at `.github/copilot-instructions.md`
- Task-specific prompt files (`*.prompt.md`) inserted on reference
- Personal rules configured in GitHub UI (not local files)
- Plain Markdown with no special syntax or front matter
- Each line treated as discrete instruction
- Deduplicates identical lines
- Later scopes override earlier ones in conflicts
- Rules get automatic hot-reload when instructions file is saved

### Cursor

- Supports nested rules in subdirectories (v0.50+)
- Uses .mdc files with YAML front-matter in `.cursor/rules/` directories
- Supports glob patterns for file matching with some limitations (no brace expansion)
- File referencing with `@filename` syntax to include external content
- Four rule types based on activation mechanism:
  - **Always Apply**: Rules always included (alwaysApply: true)
  - **Auto-Attached**: Rules that apply when matching file patterns (globs pattern)
  - **Agent-Requested**: Rules that the AI fetches by relevance (description field)
  - **Manual**: Rules applied only when explicitly referenced
- Two-stage rule processing: injection followed by activation
- Shows which rules are active in the context panel
- UI integration for rule management (Cmd+Shift+P > "New Cursor Rule")
- Recommends keeping rules under ~500 lines for optimal performance
- Legacy support for .cursorrules at project root (deprecated)

### Claude Code

- Hierarchical loading from multiple directories
- Import mechanism with @file syntax for modular organization
- Plain markdown format (.md)
- Combines global + project + directory-specific rules
- Path resolution for imports relative to current file
- Processes imports recursively
- Uses clear heading structure for organization

### Windsurf

- YAML-ish front-matter with explicit `trigger` field (v1.9+, May 2025)
- Four activation modes via trigger types: `always_on`, `glob`, `model_decision`, `manual`
- Character limits (6K per file, 12K total across all rules)
- UI integration for toggling and editing rules
- Dedicated UI with visual indicators for active rules
- File referencing with `@relative/path.ext` syntax
- Global rules at `~/.config/windsurf/global_rules.md`
- Project rules at `<repo-root>/.windsurf/rules/*.md`
- Nested module rules at `<repo>/<sub>/.windsurf/rules/*.md`
- Front-matter fields: `trigger`, `description`, `globs`, `name`
- Legacy support for `.windsurfrules` at project root (deprecated)

### Roo Code

- Mode-specific rules folders (.roo/rules-{mode}/)
- Common rules for all modes (.roo/rules/)
- One folder per AI operational mode (architect, debug, docs-writer, etc.)
- No global user file for personal preferences
- Mode selection determines which rules are loaded
- Clear heading structure and section organization

### Aider

- Manual inclusion via command-line flag
- Session-based persistence
- No built-in scoping

## Compiler Implementation Considerations

### Path Resolution

The compiler must handle:

- Relative paths for imports
- Path mapping for different destination output locations
- Hierarchical directory structures

### Content Transformation

The compiler must support:

- Converting Mixdown notation to destination-specific formats
- Generating appropriate YAML front-matter for destinations that require it
- Preserving plain markdown content for most destinations

### Destination Configuration

Each destination needs configuration for:

- Output location and file naming conventions
- Format requirements (plain .md vs .mdc with front-matter)
- Character or token limitations
- Activation mechanism support

### Stem Handling

Stems must be appropriately processed for:

- Tools that use XML-like formats (wrapping with appropriate tags)
- Tools that use heading-based organization (converting to headings)
- Tools that require specific activation modes (adding appropriate attributes)

### Variable Substitution

Variables need to handle:

- Destination-specific values (`{{$destination}}`, `{{$destination.id}}`)
- Path-related values
- Front-matter values

### Import Processing

The compiler must process imports:

- Resolving paths correctly
- Filtering stems as specified
- Handling nested imports
- Managing circular references

## Example Files

### Cursor (.mdc)

```yaml
---
description: React Component Standards
globs: ['**/components/**/*.tsx']
alwaysApply: false
---
# React Component Guidelines
- Use functional components with hooks
- Follow naming pattern: ComponentName.tsx
```

### Claude Code (@file syntax)

```markdown
# Project Guidelines

See @docs/ARCHITECTURE.md for the system overview.

# Coding Standards

- Follow RESTful principles for API endpoints
- Document all functions with JSDoc comments
```

### Windsurf (.md) with Front-matter (v1.9+)

```markdown
---
trigger: model_decision
description: 'TypeScript best practices for the project'
globs: '**/*.ts?(x)'
---

# TypeScript Best Practices

## Typing

- Always use explicit return types for functions
- Prefer interfaces over types for objects
- Use union types for values with finite potential values

## Error Handling

- Use specific error types instead of generic Error
- Implement proper error boundaries
- Always type error objects
```

### Roo Code (mode-specific .md)

```markdown
# Debugging Guidelines

## Common Error Patterns

- Description of error pattern 1 and how to fix
- Description of error pattern 2 and how to fix

## Debugging Process

1. Step 1 of the debugging process
2. Step 2 of the debugging process
3. Step 3 of the debugging process

## Testing Recommendations

- Unit test guidelines
- Integration test guidelines
```

### GitHub Copilot (.md)

```markdown
# Repository Custom Instructions

Use Bazel for Java dependencies.  
Always format JavaScript with double quotes and tabs.  
Reference Jira issue keys (e.g., JIRA-123) in commit messages.
```
