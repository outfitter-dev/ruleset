# Rulesets

> AI rules compiler - Write once, compile for all AI tools

Rulesets is a universal rules compiler that lets you write AI assistant rules once in Markdown and compile them for multiple AI tools like Cursor, Windsurf, Claude Code, and more.

## Quick Start

```bash
# Install globally
npm install -g @rulesets/cli@latest

# Initialize in your project
rulesets init

# Write your rules in ./.ruleset/rules
# Then compile them
rulesets compile
```

## Features

- **Universal Format**: Write rules once in Markdown, use everywhere
- **Multi-Tool Support**: Cursor, Windsurf, Claude Code, and more
- **Simple CLI**: Easy-to-use command line interface
- **Extensible**: Plugin system for adding new AI tools
- **Type-Safe**: Built with TypeScript for reliability

## Installation

Requires Node.js 18+.

Note: For local development in this monorepo you'll also need Bun ≥1.1. End users running the published CLI only need Node.js.

```bash
# Install globally (handy for day-to-day use)
npm install -g @rulesets/cli@latest

# Or run ad-hoc without installing
npx -y @rulesets/cli@latest --help
```

### Local Development (Monorepo)

```bash
bun install
bun run lint
bun run typecheck
bun run test --coverage
bun run build
```

## Usage

### Initialize a Project

```bash
rulesets init
```

This creates:

- `.ruleset/config.toml` – Project configuration (JSON/JSONC/YAML also supported)
- `.ruleset/rules/` – Directory for your rule files
- Example rule file to get started

### Write Rules

Create Markdown files in `.ruleset/rules/`:

```markdown
# .ruleset/rules/coding-standards.rule.md
---
name: coding-standards
destinations:
  include: ['cursor', 'windsurf', 'claude-code']
---

# Coding Standards

## TypeScript

- Use strict mode
- Prefer const over let
- Use type inference where possible

## Testing

- Write tests for all features
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
```

### Compile Rules

```bash
# Compile all rules
rulesets compile

# Compile specific directory
rulesets compile ./.ruleset/rules

# Compile for specific destination
rulesets compile -d cursor

# Watch mode
rulesets compile -w
```

### List Rulesets

```bash
# Lists rules discovered in your configured sources (not npm-installed packs)
rulesets list
```

## Destinations

Rulesets compiles to these AI tool formats:

| Tool           | Output Location                     | Format            |
| -------------- | ----------------------------------- | ----------------- |
| Cursor         | `.ruleset/dist/cursor/*.md`        | Markdown          |
| Windsurf       | `.ruleset/dist/windsurf/*.{md,xml}` | Markdown (or XML) |
| Claude Code    | `.ruleset/dist/claude-code/*.md`   | Markdown          |
| AGENTS.md      | `.ruleset/dist/agents-md/AGENTS.md` | Markdown          |
| GitHub Copilot | `.ruleset/dist/copilot/*.md`       | Markdown          |

Windsurf defaults to Markdown but can emit XML when `format: "xml"` is specified in destination config (for example, in `.ruleset/config.toml`: `destinations = { windsurf = { format = "xml" } }`).

Note: `rulesets compile` writes to `.ruleset/dist/…`. Add these paths to `.gitignore` to avoid committing compiled artefacts. A future `rulesets sync` may copy outputs into tool‑specific locations.

```gitignore
# Rulesets build output
.ruleset/dist/
# e.g.
# .ruleset/dist/cursor/
# .ruleset/dist/windsurf/
# .ruleset/dist/claude-code/
# .ruleset/dist/agents-md/
# .ruleset/dist/copilot/
```

## Handlebars Safety

Some destination providers opt into Handlebars-templated compilation when you set `destinations.<provider>.handlebars` in frontmatter or project config. Rulesets enables Handlebars strict mode and HTML escaping by default to avoid leaking unexpected data or emitting unescaped markup. Only disable these safeguards (`force: true`, `strict: false`, or `noEscape: true`) when you fully control the template inputs, and prefer partials over helpers for sharing content across destinations.

## Project Structure

```text
your-project/
├── .ruleset/
│   ├── config.toml      # Rulesets configuration (JSON / JSONC / YAML also supported)
│   ├── rules/           # Source rule files
│   │   ├── coding-standards.rule.md
│   │   ├── git-workflow.rule.md
│   │   └── project-conventions.rule.md
│   └── dist/            # Compiled output
│       ├── cursor/      # Cursor-specific rules
│       ├── windsurf/    # Windsurf-specific rules
│       ├── claude-code/ # Claude Code rules
│       ├── agents-md/   # AGENTS.md rules
│       └── copilot/     # GitHub Copilot rules
└── package.json
```

## Configuration

`.ruleset/config.toml`:

```toml
version = "0.1.0"
sources = ["./.ruleset/rules"]
output = "./.ruleset/dist"
destinations = ["cursor", "windsurf", "claude-code", "agents-md", "copilot"]
```

Note: `version` refers to the Rulesets config schema, not your package.json version.

When `rulesets.compiler` is set to `handlebars`, source files are rendered through the Handlebars engine, unlocking helper-based templates across providers.

### Handlebars partial discovery

When the Handlebars compiler is enabled, Rulesets automatically loads reusable partials before compiling each destination. Partials are discovered in the following order (later entries override earlier ones when names collide):

1. **Global partials:** `${RULESETS_HOME:-~/.config/ruleset}/partials/**/*.hbs` (any file extension listed below works)
2. **Project config partials:** `./.config/ruleset/partials/**/*`
3. **Project partials:** `./.ruleset/partials/**/*`
4. **Inline rule partials:** files inside `./.ruleset/rules/` whose filename starts with `@` (e.g. `@footer.rule.md`)

Supported extensions include `.rule.md`, `.ruleset.md`, `.md`, `.mdc`, `.hbs`, `.handlebars`, and `.txt`. Partial names are derived from the relative path with extensions removed—for example, `partials/email/footer.hbs` registers as `partials/email/footer`. Inline rule partials have their leading `@` stripped (so `@layout.rule.md` becomes `layout`).

This shared discovery mechanism replaces section-level imports; prefer extracting shared content into partials instead of pulling sections from other rules.

Global configuration lives under the XDG base directory by default (for example `~/.config/ruleset/`), with platform specific fallbacks on macOS (`~/Library/Application Support/ruleset`) and Windows (`%APPDATA%\ruleset`).

front matter example using the supported object form:

```yaml
---
rulesets:
  version: '0.1.0'
  compiler: handlebars
destinations:
  include: ['cursor', 'windsurf', 'agents-md']
---
```

### Known Limitations

- **Array Form for Destinations (front matter only)**: In v0.1.0, the simple array form is not supported in per-file front matter. Use the object form with `include`/`exclude` (see the "Write Rules" example above). The array form is supported in project configuration (TOML/JSON/JSONC/YAML) such as `.ruleset/config.toml`.

  - Incorrect front matter:

    ```yaml
    ---
    destinations: ['cursor', 'windsurf']
    ---
    ```

  - Correct front matter:

    ```yaml
    ---
    destinations:
      include: ['cursor', 'windsurf']
    ---
    ```

- **Resource Limits**: Files exceeding the following limits will be skipped:
  - Maximum pack file size: 10MB
  - Maximum ruleset file size: 5MB
  - Maximum nesting depth in front matter: 10 levels

## CLI Commands

| Command                      | Description                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `rulesets init`              | Initialize Rulesets in current project                                          |
| `rulesets compile [source]`  | Compile source rules to destinations                                            |
| Flags (compile)              | `-d, --destination <name>` filter destinations; `-w, --watch` watch for changes |
| `rulesets list`              | List discovered (local) rulesets                                                |
| `rulesets install <package>` | Install a ruleset package (placeholder)                                         |
| `rulesets sync`              | Sync installed rulesets (placeholder)                                           |

## Development

This is a monorepo using Bun workspaces (Bun ≥1.1 required; Node.js ≥18 if you want to test the built CLI locally):

```bash
# Clone the repository
git clone https://github.com/outfitter-dev/rulesets.git
cd rulesets

# Install dependencies
bun install

# Build all packages
bun run build

# Lint, typecheck, and run tests with coverage
bun run lint
bun run typecheck
bun run test --coverage
```

### Packages

- `@rulesets/core` - Core compiler and parser
- `@rulesets/cli` - Command line interface

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © Outfitter

## Roadmap

- [ ] v0.1.0 - Initial release with basic compilation
- [ ] v0.2.0 - Pack system for bundled rulesets
- [ ] v0.3.0 - npm package distribution
- [ ] v0.4.0 - Advanced templating and variables
- [ ] v1.0.0 - Stable API with full documentation

## Support

- [GitHub Issues](https://github.com/outfitter-dev/rulesets/issues)
- [Documentation](https://github.com/outfitter-dev/rulesets/wiki)

---

Built with ❤️ by [Outfitter](https://github.com/outfitter-dev)
