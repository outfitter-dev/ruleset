# @rulesets/cli

Command-line interface for Rulesets - AI rules compiler.

## Installation

```bash
bun add --global @rulesets/cli

# Or run without installing
bunx @rulesets/cli --help
```

## Usage

```bash
# Initialize Rulesets in your project
rulesets init

# Compile rules to AI tool formats
rulesets compile

# List installed rulesets
rulesets list

# Install a ruleset package
rulesets install <package>

# Sync installed rulesets
rulesets sync
```

## Commands

### init

Initialize Rulesets in the current project.

```bash
rulesets init [options]

Options:
  -g, --global  Initialize global configuration
```

### compile

Compile source rules to provider formats.

```bash
rulesets compile [source] [options]

Arguments:
  source  Source file or directory (default: "./rules")

Options:
  -o, --output <dir>     Output directory (default: "./.ruleset/dist")
  -p, --provider <id>    Specific provider to compile for
      --destination <id> Deprecated alias for --provider
  -w, --watch            Watch for changes and recompile
```

### list

List installed rulesets.

```bash
rulesets list [options]

Options:
  -g, --global  List global rulesets
  -l, --local   List local project rulesets
```

### install

Install a ruleset from npm or GitHub.

```bash
rulesets install <package> [options]

Arguments:
  package  Package name or GitHub URL

Options:
  -g, --global  Install globally
  -d, --dev     Save as development dependency
```

### sync

Sync installed rulesets to their providers.

```bash
rulesets sync [options]

Options:
  -g, --global  Sync global rulesets
  -f, --force   Force sync even if up to date
```

## License

MIT © Outfitter
