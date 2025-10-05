# Basic Template

This is a minimal Ruleset template demonstrating the basic structure and workflow.

> **Note:** This is a template. Use `bun run sandbox:setup basic` to create a working sandbox from this template. See [examples/README.md](../../README.md) for details.

## Structure

```
.ruleset/
  config.yaml           # Project configuration
  rules/                # Source rules files
    coding-standards.rule.md
  partials/             # Reusable content fragments
    license.md
  dist/                 # Compiled outputs (gitignored)
```

## Usage

```bash
# Build rules for all enabled providers
rules build

# Watch for changes
rules build --watch

# Build for specific providers
rules build --provider cursor --provider claude-code

# View detailed diagnostics
rules build --why
```

## Expected Outputs

After building, you'll see:
- `.cursor/rules/coding-standards.mdc` - Cursor rules
- `CLAUDE.md` - Claude Code rules
- `.windsurf/rules/coding-standards.md` - Windsurf rules
- `AGENTS.md` - Shared agent rules

## Next Steps

- Add more rules in `.ruleset/rules/`
- Create reusable partials in `.ruleset/partials/`
- Customize provider settings in `.ruleset/config.yaml`
- See [documentation](https://ruleset.md) for advanced features