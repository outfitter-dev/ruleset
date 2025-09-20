# AGENTS.md - AI Assistant Guide for Rulesets Project

This file provides comprehensive guidance for AI assistants (Claude Code, Cursor, Cline, etc.) working with the Rulesets codebase.

## IMPORTANT

Always read @SCRATCHPAD.md first, and keep it updated with your work as you go. This is your "working memory" file and we will use it to collaborate.

We are in the middle of a big @MIGRATION.md effort. Pay close attention to it.

As you complete major chunks of work, create a new log in `.agents/logs/` with `YYYYMMDDhhmm` as the filename prefix (use the date command) and then `-<brief description of work>.md` as the filename suffix.

## Overview

Rulesets is a CommonMark-compliant rules compiler that lets you author a single source rules file in Markdown and compile it into destination-specific rules files (`.cursor/rules.mdc`, `.roo/rules.md`, and more). Think of it as Terraform for AI rules: write once, compile for many destinations, your agents, no matter the tool, on the (literal) same page.

## Critical Instructions

- ✅ Always follow the language spec @.agents/docs/language.md
- ✅ Always ensure the `.gitignore` file is updated to exclude potentially sensitive information
- ✅ Always work from a feature branch off of `main` or a `fix/` branch off of a target feature branch
- ✅ Commit regularly, group commits logically, and use conventional commit messages. When committing, always check to see if there are unstaged changes
- ✅ When writing code, follow the SOLID principles, DRY principles, KISS principle, and include descriptive inline comments for future developers
- ❌ Never automatically create a PR for a feature branch without explicit user direction
- ✅ When creating PRs follow the instructions in `.claude/commands/create-pr.md`

## Project Structure for AI Agent Navigation

- `/docs`: Project documentation that AI agents should consult
  - `.agents/docs/language.md`: Terminology and language spec for consistent communication
  - `.agents/docs/overview.md`: Project overview and guidance
  - `.agents/docs/architecture.md`: Technical architecture details
  - `.agents/docs/notes/README.md`: Curated Rulesets research notes
- `/packages`: Monorepo packages where AI agents will implement code
  - `/core`: Core Rulesets library that AI agents should enhance iteratively
- `.ruleset/`: Project-local ruleset directory (contains `rules/`, `dist/`, and config files)

## Key Concepts

### Source Rules

- Source files defining rules, written in 100% previewable Markdown
- Use `.rule.md` extension (preferred); `.ruleset.md` remains supported for backward compatibility.
- Written in Rulesets notation and use `{{...}}` notation markers to direct the compiler
- Compiled into destination-specific rules files (for example, `.ruleset/dist/cursor/my-rule.md`).

### Destination

- A supported tool, such as cursor, windsurf, or claude-code
- Defines tool-specific criteria for compiling source rules to compiled rules files
- Delivered through destination providers

### Compiled Rules

- Destination-specific (tool) rules files, rendered from the source rules
- Examples for a source rules file called `project-conventions.md`:
  - Cursor → `.cursor/rules/project-conventions.mdc`
  - Claude Code → `./CLAUDE.md#project-conventions`
  - Windsurf → `.windsurf/rules/project-conventions.md`
- When placed in tool directories, referred to as "tool-ready rules"

### Notation Marker

- Syntax: `{{...}}`
- Fundamental building block of Rulesets notation
- Used to direct the compiler for various purposes (sections, imports, variables)
- All Rulesets directives use marker notation, but serve different functions
- Similar to `<xml-tags>`, but fully Markdown-previewable

### Section

- Syntax: `{{section-name}}...{{/section-name}}`
- A specific application of notation markers that creates delimited content blocks
- Translates directly to XML tags in compiled output: `<section_name>...</section_name>`
- Has opening and closing notation markers that surround content
- Can contain properties that control rendering behavior
- Example: `{{instructions}}This is instruction content{{/instructions}}`

### Import

- Syntax: `{{> my-rule }}`
- Embed content from another source rules file, section, mixin, or template

### Variable

- Syntax: `{{$key}}` or `$key` if used within a `{{...}}` marker
- Dynamic values replaced inline at compile time
- Examples: `{{$destination}}`, `{{$.front matter.key}}`, `{{$alias}}`

## Project Goals

| Goal                  | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| ✨ **Simplicity**     | Reduce bespoke format/structure for each tool to just one          |
| 🧹 **Lintability**    | Files must pass standard markdown-lint without hacks               |
| 👀 **Previewability** | Render legibly in GitHub, VS Code, Obsidian, etc                   |
| 🧩 **Extensibility**  | Advanced behaviors declared via attributes instead of new notation |

## Supported Destination Providers

| ID            | Tool               | Type              |
| ------------- | ------------------ | ----------------- |
| `cursor`      | Cursor             | IDE               |
| `windsurf`    | Windsurf           | IDE               |
| `claude-code` | Claude Code        | CLI               |
| `roo-code`    | Roo Code           | VS Code Extension |
| `cline`       | Cline              | VS Code Extension |
| `codex-cli`   | OpenAI Codex CLI   | CLI               |
| `codex-agent` | OpenAI Codex Agent | Web agent         |

## Rulesets Notation Reference

### Basic Example

```markdown
{{instructions +cursor -claude-code}}

- IMPORTANT: You must follow these coding standards...
  {{/instructions}}
```

### Imports

```markdown
{{> @legal}} <!-- Embeds `/_mixins/legal.md` -->
{{> partials/footer }} <!-- Loads a partial from `.ruleset/partials/footer.*` -->
```

> [!NOTE]
> Prefer partials for reusable content. Section-level filters/imports inside compiled rules have been removed for simplicity.

### Variables

```markdown
Alias: {{$alias}}
Source rules file version: {{$file.version}}
Current destination: {{$destination}}
Destination ID: {{$destination.id}}
```

### Destination Scoped Properties

```markdown
{{instructions cursor?name="cursor_instructions"}}
...
{{/instructions}}
```

### Output Options

```markdown
{{instructions output="tag:omit"}}
Content without surrounding XML tags
{{/instructions}}

{{> @code-example output="code:javascript"}}
```

### Raw Notation

```markdown
{{{examples}}} <!-- Triple braces preserve Rulesets notation -->
{{example}}

- Instructions
- Rules
  {{/example}}
  {{{/examples}}}
```

### Placeholders

```markdown
[requirements] <!-- Instruction placeholder for AI to fill -->
{requirements} <!-- Alternative placeholder notation -->
```

## Front Matter Example

```yaml
---
# .ruleset/rules/my-rule.rule.md
rulesets:
  version: 0.1.0 # version number for the Rulesets format used
  compiler: handlebars # optional: opt into Handlebars renderer
description: 'Rules for this project' # useful for tools that use descriptions
globs: ['**/*.{txt,md,mdc}'] # globs re-written based on destination-specific needs
# Destination filter examples:
destination:
  include: ['cursor', 'windsurf']
  exclude: ['claude-code']
  path: './custom/output/path'
# Destination-specific front matter:
cursor:
  alwaysApply: false
  destination:
    path: './custom/.cursor/rules'
# Additional metadata:
name: my-rule # defaults to filename
version: 2.0 # version number for this file
---
```

## Naming Conventions

- Source rules files: `kebab-case.rule.md` (preferred) (e.g., `coding-standards.rule.md`); `.ruleset.md` remains supported for compatibility.
- Directories: `kebab-case` (e.g., `_mixins`)
- Config files: prefer TOML (e.g., `.ruleset/config.toml`); JSON, JSONC, and YAML are accepted.
- Section names: `kebab-case` (e.g., `{{user-instructions}}`)
- XML output tags: `snake_case` (e.g., `<user_instructions>`)

## Coding Conventions for AI Agents

### General Conventions for Agents.md Implementation

- Use TypeScript for all new code generated by AI agents
- AI agents should follow the existing code style in each file
- Agents.md requires meaningful variable and function names in AI agent output

### Code Quality Standards for AI Agents

- AI agents should follow SOLID, DRY, and KISS principles as specified in Agents.md
- Keep functions small and focused in all AI agent implementations
- Agents.md requires proper TypeScript typing in all AI agent code
- AI agents must include descriptive inline comments for future developers

## Testing Requirements for AI Agents

AI agents should run tests with the following commands:

```bash
# Run all tests in the monorepo
bun run test

# Run tests for specific package
bun run test --filter=@rulesets/core

# Run tests with coverage
bun run test --coverage

# Lint all packages
bun run lint

# Type check all packages
bun run typecheck
```

## Development Workflow for AI Agents

### Branch Management for AI Agents

- AI agents should work from feature branches off `main`
- Use conventional commit messages for all AI agent commits
- Agents.md requires checking for unstaged changes before committing
- AI agents should commit regularly with logical groupings

### Pull Request Guidelines for AI Agents

When AI agents help create a PR, please ensure it:

1. Includes a clear description of changes as guided by Agents.md
2. References any related issues that AI agents are addressing
3. Ensures all tests pass for code generated by AI agents
4. Follows the PR template in `.claude/commands/create-pr.md`
5. Keeps PRs focused on a single concern as specified in Agents.md
6. Never automatically creates PRs without explicit user direction

## Programmatic Checks for AI Agents

Before submitting changes generated by AI agents, run:

```bash
# Lint check for AI agent code
bun run lint

# Type check for AI agent TypeScript
bun run typecheck

# Build check for AI agent implementations
bun run build

# Test all AI agent changes
bun run test
```

All checks must pass before AI agent generated code can be merged. Agents.md helps ensure AI agents follow these requirements.

## Package Management

- As a monorepo, we use Bun for everything
- Run `bun install` to install dependencies
- Use workspace commands for monorepo operations

## Workflow Guidance

- Each time after writing a major feature, module, function, etc. you should commit
- Group related changes into logical commits
- Use conventional commit messages
- Work from feature branches off `main`
- Never create PRs automatically without user direction

## Essential Documentation for AI Agents

AI agents must consult these documents regularly:

- `@.agents/docs/language.md`: Terminology spec for consistent communication
- `@.agents/docs/overview.md`: Project overview and architecture
- `@.agents/docs/architecture.md`: Technical architecture details
- `@.agents/docs/notes/README.md`: Curated research notes
- Legacy references are archived under `.agents/notes/.archive/` if historical context is required
- `.claude/commands/create-pr.md`: PR creation guidelines
