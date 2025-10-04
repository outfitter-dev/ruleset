# Ruleset v0.2.0 - Project Overview

Ruleset is a universal AI rules compiler that enables you to author AI assistant rules once in Markdown and compile them for multiple AI tools. This document provides a comprehensive overview of the v0.2.0 architecture, workflows, and key concepts.

## Core Philosophy

Ruleset v0.2.0 embraces simplicity and standards:
- **Plain Markdown**: Rules are standard Markdown documents with YAML front matter
- **Opt-in complexity**: Advanced features like Handlebars templating are explicitly enabled
- **Provider-centric**: Each AI tool has a dedicated provider that understands its specific requirements
- **Configuration over convention**: Clear, documented configuration options replace implicit behaviors

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Ruleset CLI                             │
├─────────────────────────────────────────────────────────────┤
│                  @rulesets/core                            │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │   Parser    │  Compiler   │   Linter    │   Loader    │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Providers                               │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │   Cursor    │  Windsurf   │Claude Code  │ AGENTS.md   │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Discovery**: CLI discovers rule files based on front matter presence
2. **Parsing**: Core parser extracts YAML front matter and Markdown content
3. **Compilation**: Core compiler processes rules through enabled providers
4. **Provider Processing**: Each provider transforms rules to tool-specific format
5. **Output**: Compiled rules are written to `.ruleset/dist/` or provider-specific paths

## Key Concepts

### Source Rules

Source rules are the canonical definition of your AI assistant guidance:

- **Format**: Standard Markdown files with YAML front matter
- **Location**: `.ruleset/rules/` and `.agents/rules/` by default (configurable via project config)
- **Extensions**: Any extension works, but `.rule.md` is preferred for clarity
- **Identification**: Must contain `rule:` block in front matter to be processed

**Example Structure:**
```yaml
---
rule:
  version: '0.2.0'
  template: false
description: Engineering guidelines for the project
cursor:
  enabled: true
  priority: high
windsurf:
  enabled: false
---

# Engineering Guidelines

Use present-tense, actionable language.
```

### Providers

Providers are packages that transform source rules into tool-specific outputs:

- **Purpose**: Handle tool-specific formatting, metadata, and output requirements
- **Location**: `packages/provider-*` in the monorepo
- **Interface**: Implement standardized provider interface from `@rulesets/core`
- **Output**: Write compiled rules to appropriate provider outputs

**Current Providers:**
- `cursor` → `.cursor/rules/` (Cursor IDE)
- `windsurf` → `.windsurf/rules/` (Windsurf IDE)
- `claude-code` → `CLAUDE.md` (Claude Code CLI)
- `agents-md` → `AGENTS.md` (Multi-tool aggregation)
- `copilot` → `.copilot/rules/` (GitHub Copilot)

### Configuration Hierarchy

Configuration flows from multiple sources with increasing precedence:

1. **Global Config**: `~/.config/ruleset/config.yaml`
2. **Project Config**: `.ruleset/config.yaml`
3. **Rule Front Matter**: Per-rule YAML front matter
4. **Provider Overrides**: Provider-specific settings in front matter

### Front Matter Schema

The front matter uses a structured namespace approach:

```yaml
---
# Core rule metadata
rule:
  version: '0.2.0'       # Required: Ruleset format version
  template: false        # Optional: Enable Handlebars templating
  globs: ['**/*.ts']     # Optional: File patterns for this rule

# Standard metadata (passed through to providers)
description: 'Rule description'
name: 'rule-name'        # Defaults to filename
version: '1.0.0'         # Rule content version

# Provider-specific configuration
cursor:
  enabled: true          # Enable/disable for this provider
  priority: 'high'       # Provider-specific settings
  outputPath: '.cursor/rules/custom.mdc'

windsurf:
  enabled: false

# Legacy support (emits warnings)
destinations:
  include: ['cursor']    # Deprecated: use provider blocks instead
---
```

## Templating System (Handlebars)

Templating is opt-in and disabled by default:

### Activation
```yaml
rule:
  template: true  # Enable for this rule
```

Or in project config:
```yaml
rule:
  template: true  # Enable for all rules by default
```

### Safety Features
- **Strict Mode**: Undefined template variables throw errors
- **HTML Escaping**: Output is HTML-escaped by default
- **Override Protection**: Safety features require explicit `force: true` to disable

### Partials Discovery
Partials are loaded from multiple locations in order:

1. **Global**: `~/.config/ruleset/partials/**/*`
2. **Project Config**: `./.config/ruleset/partials/**/*`
3. **Project**: `./.ruleset/partials/**/*`
4. **Inline**: `./.ruleset/rules/@*.md` files

### Context Variables
Templates have access to:
- `{{provider}}` - Current provider information
- `{{rule}}` - Rule metadata from front matter
- `{{file}}` - File-level information
- Custom variables from front matter

## Project Structure

```
your-project/
├── .ruleset/
│   ├── config.yaml           # Project configuration
│   ├── rules/                # Source rule files
│   │   ├── coding-standards.rule.md
│   │   ├── git-workflow.rule.md
│   │   └── @footer.md        # Inline partial (template: true)
│   ├── partials/            # Reusable template fragments
│   │   ├── welcome.md
│   │   └── legal.md
│   └── dist/                # Compiled output (gitignore recommended)
│       ├── cursor/
│       ├── windsurf/
│       ├── claude-code/
│       ├── agents-md/
│       └── copilot/
└── package.json
```

## CLI Commands

### Core Commands
- `rulesets init` - Initialize `.ruleset/` structure with examples
- `rulesets compile [source]` - Compile rules to provider outputs
- `rulesets list` - Show discovered rules and provider status

### Import/Export
- `rulesets import <file>` - Import external Markdown with standard front matter
- `rulesets promote <rule>` - Convert rule to reusable partial

### Flags
- `--destination|-d <provider>` - Compile only specified provider
- `--watch|-w` - Watch for changes and recompile
- `--verbose|-v` - Detailed logging output

## Workflow Patterns

### Basic Workflow
1. `rulesets init` - Set up project structure
2. Edit/create rules in `.ruleset/rules/`
3. `rulesets compile` - Generate provider outputs
4. Commit source rules, optionally commit outputs

### Development Workflow
1. Create feature branch
2. Modify/add rules with appropriate front matter
3. Test compilation with `rulesets compile`
4. Lint rules (built-in linting via compilation)
5. Commit changes using conventional commits
6. Create PR with stack using Graphite (`gt`)

### Template Development
1. Enable templating: `rule.template: true`
2. Create partials in `.ruleset/partials/`
3. Reference with `{{> partial-name }}`
4. Test with multiple providers to ensure compatibility

## Migration from v0.1.x

### Breaking Changes
- **Section markers removed**: Convert `{{section}}` to Markdown headings
- **Provider configuration changed**: Use `cursor:`, `windsurf:` instead of `destinations.include`
- **Template opt-in**: Handlebars now requires explicit `rule.template: true`
- **Config location**: `.ruleset/config.yaml` is now default (was `.ruleset/config.toml`)

### Migration Steps
1. Replace `{{section-name}}...{{/section-name}}` with `## Section Name` headings
2. Move `destinations.include: [cursor]` to `cursor: {enabled: true}`
3. Add `rule.template: true` to files using `{{variables}}` or `{{> partials}}`
4. Rename config file from `.toml` to `.yaml` if needed

## Development Guidelines

### For Rule Authors
- Use semantic versioning in `rule.version` for content changes
- Keep rules focused on single concerns
- Prefer Markdown headings over custom markup
- Document provider-specific behaviors in rule comments

### For Providers
- Implement the standard provider interface from `@rulesets/core`
- Handle unknown front matter gracefully (pass-through or ignore)
- Use shared utilities from core for common operations
- Test against multiple rule configurations

### For Contributors
- Follow conventional commit messages
- Use Graphite for stacked PRs
- Maintain backwards compatibility where possible
- Update this overview when adding new features

## Future Considerations

### Planned Features
- `rulesets sync` - Copy outputs to tool-specific locations
- `rulesets diff` - Compare rule versions and outputs
- Rule packs/presets system for sharing common rule sets
- MCP server integration for real-time rule serving

### Extension Points
- Custom providers for new AI tools
- Additional template engines beyond Handlebars
- Rule transformation plugins
- Custom linting rules

This overview reflects the current v0.2.0 architecture. As features evolve, this document will be updated to maintain accuracy and completeness.
