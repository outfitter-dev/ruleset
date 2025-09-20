# Rulesets Project Language Specification

This document provides terminology guidance for consistent language in Rulesets documentation, code, and community communication. See the [changelog](#changelog) for recent updates to the terminology.

## Key Terminology

| Term | Definition | Usage Examples |
|------|------------|----------------|
| **Source rules** | Source files defining rules for AI assistants, written in Rulesets Notation | "Write your code standards in a source rules file." |
| **Compiled rules** | Rules files generated from source rules for each destination | "Compile your source rules into compiled rules for each destination." |
| **Destination** | A supported tool (e.g., Cursor, Claude Code) | "Each destination has specific formatting requirements." |
| **Marker** | Element using `{{...}}` notation | "Use markers to direct the compiler." |
| **Section** | Delimited blocks marked with `{{section}}...{{/section}}` | "Define a section for agent instructions." |
| **Section Content** | The content between opening and closing section markers | "The section content contains the actual instructions for the AI assistant." |
| **Section Name** | The kebab-case or snake_case identifier after the opening `{{` | "Use a descriptive section name like {{user-instructions}}." |
| **Import** | A reference to another source rules file or section | "Import common guidelines into multiple files." |
| **Import Scope** | Selective filtering of sections during import | "Use import scope with `{{> my-rules#(my-section) }}` to import specific sections." |
| **Variable** | Dynamic values replaced during compilation | "Use variables to include dynamic data." |
| **System Variable** | Built-in variables provided by the compiler | "The `$destination` system variable contains the current destination ID." |
| **Variable Substitution** | The process of replacing variables with their values | "Variable substitution happens automatically during compilation." |
| **Mixin** | Reusable components stored in `.rulesets/src/_mixins` | "Import commonly used components as mixins." |
| **Property** | A configuration applied to sections or imports | "Apply the tag-omit property to remove XML tags in compiled rules." |
| **Scope** | A destination-specific context for properties | "Use destination:property to apply properties in a specific scope." |
| **Scoped Value** | A property value that applies only to specific destinations | "The destination:code-javascript is a destination-scoped value." |
| **Property Family** | The prefix part before the hyphen in properties (e.g., `code-` in `code-javascript`) | "The code- family includes language-specific formatting properties." |
| **Property Value** | Value enclosed in parentheses after a property family | "The code-javascript defines JavaScript-specific formatting." |
| **Property Group** | A collection of related properties that serve a common purpose, regardless of prefix | "The formatting property group includes properties like code-javascript, indent-4, and wrap-80." |
| **Modifier** | Special symbol that changes inclusion/exclusion | "Use the + modifier to include content for a destination." |

## Linguistic Conventions

### General Principles

- Prefer clear, specific terminology over vague descriptions
- Be consistent with capitalization and hyphenation
- Use declarative present tense when describing functionality

### Specific Terminology Patterns

#### Compilation Process

- ✅ "Compile source rules into compiled rules"
- ✅ "Generate destination-specific rules files"
- ✅ "Transform source rules into compiled rules"
- ❌ "Render artifacts" (outdated)

#### Compilation Results

- ✅ "Compiled rules" (as a noun for the compilation result)
- ✅ "Compiled rules are written to their respective locations"
- ✅ "The source rules file is compiled into rules for each destination"
- ✅ "Compilation artifacts" (for referring to files generated during compilation)
- ❌ "The rendered artifact" (outdated)

#### Compilation Logical Flow

- ✅ "Source rules → compilation → compilation artifacts → compiled rules" (for describing the complete process)
- ✅ "Source rules → compilation → compiled rules" (simplified version)

#### Content Display

- ✅ "Formatted as" (when describing how content appears)
- ✅ "Displayed as" (for visual presentation)
- ✅ "Converted to" (for transformation descriptions)
- ❌ "Rendered as" (avoid when possible)

#### Properties Terminology

- ✅ "Apply properties to" (when adding configuration to sections)
- ✅ "Scope properties to" (when applying properties to specific destinations)
- ✅ "Include with `+`" (when referring to inclusion)
- ✅ "Exclude with `!`" (when referring to exclusion)
- ✅ "Property family" (for the prefix part of properties, like `code-` or `h-`)
- ✅ "Property group" (for collections of related properties serving a common purpose)
- ✅ "Property pattern" (for consistent naming conventions like `prefix-*`)
- ✅ "Destination-scoped properties" (for properties applied to specific destinations)
- ✅ "Property value" (for values in parentheses like `name-("destination-rules")`)
- ❌ "Property settings" (use "property values" instead)
- ❌ "Destination-specific properties" (use "destination-scoped properties" instead)
- ❌ "Attribute" (use "property" for Rulesets directives, "XML attribute" for compiled rules)

#### XML Generation

- ✅ "Converted to XML tags"
- ✅ "Translated to XML"
- ✅ "Compiled as XML notation"
- ✅ "Rulesets compiles rules into pure Markdown, XML, or a combination of the two"
- ❌ "Renders as XML" (outdated)
- ❌ "Outputs XML notation" (outdated)
- ❌ "The compiler generates XML" (myopic, as XML is just one potential output format)

## File and Directory Structure

| Entity Type | Naming Convention | Example |
|-------------|-------------------|---------|
| Source Rules files | `kebab-case.ruleset.md` | `coding-standards.ruleset.md` |
| Directory | `kebab-case` | `_mixins` |
| Config files | `kebab-case.config.json` | `rulesets.config.json` |
| Section markers | `kebab-case` | `{{user-instructions}}` |
| XML Tags in compiled rules | `snake_case` | `<user_instructions>` |

### Distribution Directory Structure

The `.rulesets/dist/` directory stores compiled rules, compilation artifacts, and related data:

| Path | Purpose |
|------|---------|
| `.rulesets/dist/latest/` | Symlink to the latest compilation |
| `.rulesets/dist/runs/` | Directory for all compilations and their artifacts |
| `.rulesets/dist/runs/run-<timestamp>/` | Directory containing specific compiled rules and artifacts |
| `.rulesets/dist/runs/run-<timestamp>.json` | Compilation metadata for each run |
| `.rulesets/dist/logs/` | Log files for all compilations |
| `.rulesets/dist/logs/run-<timestamp>.log` | Compilation log for each run |

### Destination Directories

"Destination Directory" refers to a specific rules directory for a particular destination. For example:

- `.cursor/rules` is a destination directory for Cursor
- `.claude/commands` is a destination directory for Claude Code slash commands
- `CLAUDE.md` has no specific destination directory as it's placed at the project root

## Delimiter Usage

Rulesets uses specific delimiters consistently throughout the syntax:

| Delimiter | Role | Example | Purpose |
|-----------|------|---------|---------|
| `:` | Scope indicator | `destination:code-javascript` | Indicates that properties are scoped to a specific destination |
| `()` | Property value container | `name-("destination-rules")` | Contains value for a property family |
| `[]` | Property grouping | `destination:[property-1 property-2]` | Groups multiple properties for readability |
| `+` | Inclusion modifier | `+destination` | Indicates inclusion of a destination |
| `!` | Exclusion modifier | `!destination`, `!section-two` | Indicates exclusion of a destination or section on imports |
| `""` | XML attribute value | `priority="high"` | Contains custom XML attribute values |

## Markdown Formatting

- Headings (`#` notation)
  - Must be preceded and followed by blank lines
  - Must not end with `:`
- Code blocks
  - Use triple backticks to wrap, unless there is another code block nested, in which case increment the backticks by 1
  - Must include language identifier (fall back to `text` if no language is appropriate)
  - Must be preceded and followed by blank lines
  - Use the indentation level of the preceding content to determine the level of the code block
- Use bullet lists for collections of related items
  - Use two spaces for indentation
  - Lists must be preceded and followed by blank lines
  - Never add blank lines in between list items
  - Use sublist items for additional details
- Use numbered lists for sequential steps
  - When adding list items within a numbered list, use three spaces for the indentation start
- Prefer tables for structured data comparison
- Use GitHub-style admonitions for additional information. `> [!TIP|INFO|WARNING|CAUTION|DANGER]\n>Helpful information`

## Version References

When referring to compilation versions:

- Full version format: "Rulesets v0.1.0"
- Major version format: "Rulesets v0"
- Release candidate format: "Rulesets v0.1.0-rc1"

## Terminology Best Practices

- Be consistent with terminology across all documentation and code
- Align new terminology with the music production theme when appropriate
- When new terms are introduced, add them to this language spec
- Prefer clarity over cleverness in technical documentation
- Use examples liberally to illustrate abstract concepts
- Avoid using previous terminology (mix, track, snippet, target, output, etc.)

## Changelog

- **2025-05-20:**
  - Renamed "mix" to "source rules"
  - Renamed "track" to "section"
  - Renamed "snippet" to "mixin"
  - Renamed "target" to "destination"
  - Renamed "output" to "compiled rules"
  - Renamed "option" to "property"
  - Standardized on "compile/compilation" for transformation process
  - Updated directory naming: `.rulesets/mixes/` → `.rulesets/src/`
  - Updated directory naming: `.rulesets/mixes/_snippets/` → `.rulesets/src/_mixins/`
  - Updated directory naming: `.rulesets/output/` → `.rulesets/dist/` to align with software development conventions
  - Renamed references to "output" to "compiled rules"
  - Refined property terminology with "Property Family", "Property Value", and "Property Group" concepts
  - Updated property syntax to use hyphenated format `property-("value")`
  - Added detailed explanations for Section Content, Section Name, Import Scope, System Variables and Variable Substitution
  - Added Compilation Directory Structure and Destination Directories sections
  - Added logical compilation flow description
  - Updated terminology from "Rule Definition" to "source rules" for better alignment with development conventions

---

*This language spec is a living styleguide document and will evolve with Rulesets's development.*