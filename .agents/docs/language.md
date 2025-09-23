# Rulesets Project Language Specification

Consistent language keeps Rulesets documentation and tooling aligned. This guide reflects the v0.2.0 authoring model: Markdown source files with YAML front matter, provider-focused outputs, and optional Handlebars templating.

## Key Terminology

| Term | Definition | Usage Example |
|------|------------|---------------|
| **Source rules** | Plain Markdown files with YAML front matter that describe canonical guidance. | "Add security guidance to the source rules." |
| **Rule metadata** | Fields declared in the front matter under the `rule` object (e.g., `rule.version`, `rule.template`). | "Set `rule.template: true` to enable templating." |
| **Provider** | Package that turns source rules into tool-ready outputs (e.g., `provider-cursor`, `provider-claude`). | "Each provider writes to its own output path." |
| **Provider output** | Files emitted by a provider, usually stored in `.ruleset/dist/<provider>/` or a provider-specific directory. | "Inspect the Cursor provider output before committing." |
| **Compiled rules** | The provider output that agents consume. | "Compiled rules live under `.cursor/rules/`." |
| **Partial** | Reusable Markdown fragment located in `.ruleset/partials/`; available to Handlebars templates. | "Create a partial for your legal disclaimer." |
| **Project config** | The canonical configuration file (`.ruleset/config.yaml`) that sets workspace defaults. | "Update the project config to enable the AGENTS provider." |
| **Preset** | A packaged set of rules installable via `rules install` and `rules update`. | "Install the onboarding preset to bootstrap a new project." |
| **AGENTS composer** | Shared provider that aggregates outputs for multiple tools. | "The AGENTS composer ensures IDE and CLI instructions stay in sync." |
| **Rulesets CLI** | Thin wrapper over `@rulesets/core` exposing commands such as `rules init`, `rules compile`, and preset management. | "Run `rules compile` after editing your source rules." |

## Retired Terminology

| Retired Term | Replace With | Rationale |
|--------------|--------------|-----------|
| Marker, Section, Property | Standard Markdown concepts (heading, list, paragraph) or "rule metadata" | Rules no longer use bespoke `{{section}}` syntax. |
| Destination | Provider (note: provider ≈ tool, but shared providers exist). | Provider language aligns with package naming. |
| Mix, Track, Stem, Snippet | Source rules, section, partial | Removes music metaphors. |
| Render, Artifact | Compile, provider output, compiled rules | Clarifies the build process. |

## Usage Guidelines

### Authoring Rules

- Prefer "author" or "write" when describing the act of creating rules.
- Refer to headings, lists, and paragraphs using Markdown terminology.
- Mention front matter explicitly when discussing metadata: "The front matter declares `rule.version` and provider overrides."

### Metadata & Configuration

- Use `rule.*` when referring to file-scoped metadata (`rule.version`, `rule.template`, `rule.globs`).
- Use `<provider>.*` for provider overrides (e.g., `cursor.enabled`, `claude.output_path`).
- Describe pass-through metadata generically: "Unknown keys are forwarded to providers."

### Providers & Outputs

- Refer to providers by package-friendly names (`provider-cursor`, `provider-windsurf`).
- Call the generated files "provider outputs" or "compiled rules"; avoid "artifacts" unless discussing intermediate build files.
- When documenting AGENTS, clarify that it composes other providers.

### Handlebars (Optional)

- Describe the feature as "opt-in templating." Mention the activation switch (`rule.template: true`).
- Make it clear that Handlebars runs in strict mode with HTML escaping enabled; instruct authors to escape braces (for example, `\{{`) or enable templating when `{{` appears.
- Refer to `{{ ... }}` constructs as "Handlebars expressions" rather than "markers." Only mention them when templating is enabled.
- Encourage reuse via partials: "Drop Markdown fragments into `.ruleset/partials/` and reference them with `{{> partial-name }}`." 

### CLI & Workflow Language

- Use the wording "Run `rules compile`" or "Use `rules install <preset>`" for commands.
- Frame CLI functionality as delegating to `@rulesets/core`.
- State that `rules sync` and `rules diff` are backlog features when relevant.

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

- Use "Rulesets v0.2.0" for the upcoming release.
- Refer to prereleases as "Rulesets v0.2.0-beta.n".
- When describing the project generally, "Rulesets v0.x" is acceptable.

## Changelog

- **2025-09-23:**
  - Documented Handlebars opt-in behaviour, strict-mode defaults, and partial discovery order.
  - Replaced bespoke marker terminology with Markdown-focused language.
  - Introduced provider-centric vocabulary and clarified AGENTS composer.
  - Highlighted preset workflow terminology.

This specification evolves with the project. Update it whenever terminology or workflows shift.
