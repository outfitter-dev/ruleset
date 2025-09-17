# Rulesets

> AI rules compiler - Write once, compile for all AI tools

Rulesets is a universal rules compiler that lets you write AI assistant rules once in Markdown and compile them for multiple AI tools like Cursor, Windsurf, Claude Code, and more.

## Quick Start

```bash
# Install globally
npm install -g @rulesets/cli@latest

# Initialize in your project
rulesets init

# Write your rules in ./rules/
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
npm install -g @rulesets/cli@latest
```

Or use with npx:

```bash
npx @rulesets/cli@latest init
```

## Usage

### Initialize a Project

```bash
rulesets init
```

This creates:

- `.rulesets/config.json` - Configuration file
- `rules/` - Directory for your rule files
- Example rule file to get started


### Write Rules

Create Markdown files in the `rules/` directory:

```markdown
---
name: coding-standards
destinations:
  include: ["cursor", "windsurf", "claude-code"]
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
rulesets compile ./my-rules

# Compile for specific destination
rulesets compile -d cursor

# Watch mode
rulesets compile -w
```

### List Installed Rulesets

```bash
rulesets list
```

## Destinations

Rulesets compiles to these AI tool formats:

| Tool | Output Location | Format |
|------|----------------|--------|
| Cursor | `.rulesets/dist/cursor/*.md` | Markdown |
| Windsurf | `.rulesets/dist/windsurf/*.(md\|xml)` | Markdown (or XML\*) |
| Claude Code | `.rulesets/dist/claude-code/*.md` | Markdown |
| AGENTS.md | `.rulesets/dist/agents-md/AGENTS.md` | Markdown |
| GitHub Copilot | `.rulesets/dist/copilot/*.md` | Markdown |

\* Windsurf defaults to Markdown but can emit XML when `format: "xml"` is specified in destination config (for example, in `.rulesets/config.json`: `{ "destinations": { "windsurf": { "format": "xml" } } }`).

Note: `rulesets compile` writes to `.rulesets/dist/…`. Add these paths to `.gitignore` to avoid committing compiled artefacts. A future `rulesets sync` may copy outputs into tool‑specific locations.

```gitignore
# Rulesets build output
.rulesets/dist/
```

## Project Structure

```text
your-project/
├── .rulesets/
│   ├── config.json      # Rulesets configuration
│   └── dist/            # Compiled output
│       ├── cursor/      # Cursor-specific rules
│       ├── windsurf/    # Windsurf-specific rules
│       ├── claude-code/ # Claude Code rules
│       ├── agents-md/   # AGENTS.md rules
│       └── copilot/     # GitHub Copilot rules
├── rules/               # Source rule files
│   ├── coding-standards.md
│   ├── git-workflow.md
│   └── project-conventions.md
└── package.json
```

## Configuration

`.rulesets/config.json`:

```json
{
  "version": "0.1.0",
  "destinations": ["cursor", "windsurf", "claude-code", "agents-md", "copilot"],
  "sources": ["./rules"],
  "output": "./.rulesets/dist"
}
```

Frontmatter example using the supported object form:

```yaml
---
rulesets:
  version: "0.1.0"
destinations:
  include: ["cursor", "windsurf", "agents-md"]
---
```

### Known Limitations

- **Array Form for Destinations (frontmatter only)**: In v0.1.0, the simple array form is not supported in per‑file frontmatter. Use the object form with `include`/`exclude`. The array form is supported in `.rulesets/config.json` (see Configuration).
- **Resource Limits**: Files exceeding the following limits will be skipped:
  - Maximum pack file size: 10MB
  - Maximum ruleset file size: 5MB
  - Maximum nesting depth in frontmatter: 10 levels

## CLI Commands

| Command | Description |
|---------|-------------|
| `rulesets init` | Initialize Rulesets in current project |
| `rulesets compile [source]` | Compile source rules to destinations |
| Flags (compile) | `-d, --destination <name>` filter destinations; `-w, --watch` watch for changes |
| `rulesets list` | List installed rulesets |
| `rulesets install <package>` | Install a ruleset package (placeholder) |
| `rulesets sync` | Sync installed rulesets (placeholder) |

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

# Run tests
bun test
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
