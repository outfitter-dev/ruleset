# Ruleset

Write AI assistant rules once in Markdown and build them for every tool you use. Ruleset v0.2.0 embraces a simple workflow: Markdown + YAML metadata, optional Handlebars templating, and provider-specific outputs managed through a single CLI.

## Install

```bash
# Install globally
npm install -g @ruleset/cli@latest

# OR run ad-hoc
npx @ruleset/cli@latest --help
```

## Quick Start

```bash
# 1. Scaffold a project (creates .ruleset/config.yaml, sample rule, partials)
rulesets init

# 2. Edit .ruleset/rules/example.rule.md
#    (front matter lives under the `rule` namespace)

# 3. Build for all providers configured in .ruleset/config.yaml
rulesets build
```

Every rule file begins with YAML front matter:

```yaml
---
rule:
  version: '0.2.0'
  template: false
cursor:
  enabled: true
  output_path: .cursor/rules
---
# Project Rules

Use Markdown headings, lists, and paragraphs as usual.
```

Project-wide defaults live in `.ruleset/config.yaml`. YAML is the canonical format; JSON/JSONC/TOML are still accepted when specified explicitly.

## CLI Commands (v0.2.0)

| Command | Description |
|---------|-------------|
| `rulesets init` | Scaffold `.ruleset/` (config, sample rule, starter partials). |
| `rulesets build` | Build rule files for the enabled providers. |
| `rulesets list` | Show discovered rules and provider enablement. |
| `rulesets install --preset <name>` | Install rules from a preset into your project. |
| `rulesets update` | Refresh installed presets. |
| `rulesets import <file>` | Copy a Markdown file into `.ruleset/rules/` (auto-detect templating). |
| `rulesets promote <rule>` | Extract a rule’s body into a reusable partial. |

> `rulesets sync` and `rulesets diff` are planned for a future release; they remain disabled in v0.2.0.

## Providers

Ruleset ships provider packages for common tools (Cursor, Windsurf, Claude Code, AGENTS, GitHub Copilot, Codex). Each provider decides where outputs land (for example `.cursor/rules/`, `.codex/AGENTS.md`). Shared behaviour is exposed through `@rulesets/core` so you can build custom providers or workflows.

## Documentation

- [Overview](.agents/docs/OVERVIEW.md)
- [Front Matter Schema](.agents/docs/SCHEMA.md)
- [Quick Start Guide](docs/QUICKSTART.md)
- [Configuration Reference](docs/CONFIGURATION.md)
- [Provider Notes](docs/providers/)

## Contributing

- Bun ≥ 1.1 and Node ≥ 18 are required.
- Use Graphite (`gt`) for stacked PRs.
- Run `bun install`, then lint/typecheck/test via:
  ```bash
  bun run lint
  bun run typecheck
  bun run --filter @rulesets/core test
  bun run build
  ```

Please record notable changes in `MIGRATION.md` and keep `DECISIONS.md` up to date when making strategic adjustments.
