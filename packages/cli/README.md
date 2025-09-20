# @rulesets/cli

Command-line interface for Rulesets - AI rules compiler.

## Installation

```bash
npm install -g @rulesets/cli
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

Compile source rules to destination formats.

```bash
rulesets compile [source] [options]

Arguments:
  source  Source file or directory (default: "./.ruleset/rules")

Options:
  -o, --output <dir>       Output directory (default: "./.ruleset/dist")
  -d, --destination <dest> Specific destination to compile for
  -w, --watch             Watch for changes and recompile
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

Sync installed rulesets to their destinations.

```bash
rulesets sync [options]

Options:
  -g, --global  Sync global rulesets
  -f, --force   Force sync even if up to date
```

## License

MIT © Outfitter
