# Ruleset Project Language Specification

Consistent language keeps Ruleset documentation and tooling aligned. This guide reflects the v0.4.0 authoring model: Markdown source files with YAML front matter, provider-focused outputs, and the slots & variables composition system.

## Key Terminology

| Term | Definition | Usage Example |
|------|------------|---------------|
| **Source rules** | Plain Markdown files with YAML front matter authored in `.rules/src/` that describe canonical guidance. | "Add security guidance to the source rules." |
| **Rule metadata** | Fields declared in the front matter under the `ruleset` object (e.g., `ruleset.version`, `ruleset.delimiter`). | "Set `ruleset.version: 0.4.0` in front matter." |
| **Provider** | Package that turns source rules into tool-ready outputs (e.g., `provider-cursor`, `provider-claude`). | "Each provider writes to its own output path." |
| **Provider output** | Files emitted by a provider, stored in `.rules/dist/<provider>/` (staging) and optionally written to provider-specific paths. | "Inspect the Cursor provider output before committing." |
| **Compiled rules** | The final provider output that agents consume in their expected locations. | "Compiled rules are written to `.cursor/rules/` with `--write` flag." |
| **Partial** | Reusable Markdown fragment located in `.rules/src/` (prefixed with `_`); available via slot imports. | "Create a partial for your legal disclaimer at `.rules/src/_legal.md`." |
| **Slot** | A placeholder in rule files using `[[ ]]` syntax for composition, variables, or named content. | "Use `[[ @_typescript.md ]]` to import a partial." |
| **Variable** | Dynamic values interpolated with `[[ $key ]]` syntax, sourced from config or context. | "Reference project name with `[[ $project.name ]]`." |
| **Import** | File composition using `[[ @file.md ]]` syntax to embed content from other files. | "Import shared conventions with `[[ @_conventions.md ]]`." |
| **Project config** | The canonical configuration file (`.rules/config.yaml` or `.agents/rules/config.yaml`) that sets workspace defaults. | "Update the project config to enable the AGENTS provider." |
| **Staging area** | The `dist/` directory where compiled rules are written before final output. | "Check `.rules/dist/cursor/` to preview compiled output." |
| **Preset** | A packaged set of rules installable via `rules install` and `rules update`. | "Install the onboarding preset to bootstrap a new project." |
| **AGENTS composer** | Shared provider that aggregates outputs for multiple tools. | "The AGENTS composer ensures IDE and CLI instructions stay in sync." |
| **Ruleset CLI** | Thin wrapper over `@rulesets/core` exposing commands such as `rules init`, `rules build`, and preset management. | "Run `rules build` after editing your source rules." |

## Retired Terminology

| Retired Term | Replace With | Rationale |
|--------------|--------------|-----------|
| Marker, Section, Property | Slot, standard Markdown concepts, or "rule metadata" | v0.4.0 uses `[[ ]]` slots instead of `{{section}}` markers. |
| Handlebars expression | Slot | v0.4.0 replaces Handlebars with native slot syntax. |
| Template mode | Slots & variables | Composition is now built-in, not opt-in templating. |
| Destination | Provider (note: provider ≈ tool, but shared providers exist). | Provider language aligns with package naming. |
| Mix, Track, Stem, Snippet | Source rules, section, partial | Removes music metaphors. |
| Render, Artifact | Compile, provider output, compiled rules | Clarifies the build process. |

## Usage Guidelines

### Authoring Rules

- Prefer "author" or "write" when describing the act of creating rules.
- Refer to headings, lists, and paragraphs using Markdown terminology.
- Mention front matter explicitly when discussing metadata: "The front matter declares `rule.version` and provider overrides."

### Metadata & Configuration

- Use `ruleset.version` when referring to the Ruleset format version in front matter.
- Use `<provider>.*` for provider overrides (e.g., `cursor.enabled`, `claude.output_path`).
- Describe pass-through metadata generically: "Unknown keys are forwarded to providers."
- Reference config values with `project.*`, `user.*`, `package.*` in variable context.

### Providers & Outputs

- Refer to providers by package-friendly names (`provider-cursor`, `provider-windsurf`).
- Call the generated files "provider outputs" or "compiled rules"; avoid "artifacts" unless discussing intermediate build files.
- When documenting AGENTS, clarify that it composes other providers.

### Slots & Variables (Composition)

- Describe composition using "slots & variables" or simply "slots."
- Use `[[ ]]` double bracket syntax for all composition operations.
- Three primary slot types:
  - **Variables**: `[[ $project.name ]]` - Dynamic values from config or context
  - **Imports**: `[[ @file.md ]]` - File composition (relative paths supported)
  - **Named slots**: `[[ slot-name ]]` - Content defined in config
- Encourage reuse via partials: "Create reusable content in `.rules/src/` with `_` prefix and import with `[[ @_partial.md ]]`."
- When referencing syntax, always use `[[ ]]` not `{{ }}`.
- Slots work everywhere by default—no opt-in flag required (unlike v0.2.0 Handlebars).
- Partials live in `.rules/src/` alongside rules (no separate `partials/` directory). 

### CLI & Workflow Language

- Use the wording "Run `rules build`" or "Use `rules install <preset>`" for commands.
- Frame CLI functionality as delegating to `@rulesets/core`.
- State that `rules sync` and `rules diff` are backlog features when relevant.
- Describe default behavior: "`rules build` compiles to staging area (`.rules/dist/`)"
- Describe write behavior: "`rules build --write` outputs to provider-specific paths"
- Describe dry-run: "`rules build --dry-run` validates without writing"

### Documentation Tone

- Present tense, directive voice: "Compile the rules" instead of "The rules should be compiled."
- Prefer concrete nouns: "provider output" over vague pronouns.
- Avoid metaphors; remain literal and tool-agnostic.

## Formatting Conventions

- Headings and lists follow GitHub-flavoured Markdown norms.
- Tables should include header separators (`|---|`).
- Inline code uses single backticks (for example, `code`).
- Use callouts sparingly (`> [!NOTE]`).
- When quoting YAML, include language hints (` ```yaml `) for clarity.

## Referencing Versions

- Use "Ruleset v0.4.0" for the current release.
- Refer to prereleases as "Ruleset v0.4.0-next.n".
- When describing the project generally, "Ruleset v0.x" is acceptable.
- Legacy v0.2.0 used Handlebars; v0.4.0 uses native slots & variables.

## Changelog

- **2025-10-06:**
  - Updated for v0.4.0 slots & variables system.
  - Replaced Handlebars `{{ }}` syntax with native `[[ ]]` slots.
  - Added terminology for imports, variables, and named slots.
  - Clarified that composition is built-in, not opt-in.

- **2025-09-23:**
  - Documented Handlebars opt-in behaviour, strict-mode defaults, and partial discovery order.
  - Replaced bespoke marker terminology with Markdown-focused language.
  - Introduced provider-centric vocabulary and clarified AGENTS composer.
  - Highlighted preset workflow terminology.

This specification evolves with the project. Update it whenever terminology or workflows shift.
