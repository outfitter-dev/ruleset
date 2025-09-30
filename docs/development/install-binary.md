# Installing Rulesets CLI Binary

This guide shows how to install the Rulesets CLI as a system-wide binary.

## Quick Install

```bash
# 1. Build the binary
bun run build:binary

# 2. Install to /usr/local/bin (may require sudo)
bun run install:binary
```

The binary will be installed as:
- `rules` - Primary command
- `rulesets` - Alias (symlinked to `rules`)

## Manual Installation

If you prefer to install manually or to a custom location:

```bash
# Build the binary
bun run build:binary

# Copy to your preferred location
cp apps/cli/dist/rulesets /usr/local/bin/rules
chmod +x /usr/local/bin/rules

# Optional: Create rulesets alias
ln -s /usr/local/bin/rules /usr/local/bin/rulesets
```

## Custom Install Location

To install to a custom directory:

```bash
# Build the binary
bun run build:binary

# Set custom install location
export INSTALL_DIR="$HOME/.local/bin"

# Install
bun run install:binary
```

## Uninstalling

```bash
bun run uninstall:binary
```

Or manually:

```bash
rm /usr/local/bin/rules
rm /usr/local/bin/rulesets
```

## Verifying Installation

```bash
# Check version
rules --version

# View help
rules --help

# Compile rules
rules compile

# Watch mode
rules compile --watch
```

## Notes

- The binary is compiled with Bun and includes all dependencies
- Size: ~57MB (includes Bun runtime)
- Supports macOS (arm64/x64) and Linux (x64)
- Windows support coming soon

## Troubleshooting

### Permission denied

If you get "permission denied" when running `rules`:

```bash
chmod +x /usr/local/bin/rules
```

### Command not found

Ensure `/usr/local/bin` is in your PATH:

```bash
echo $PATH
```

If not, add to your shell rc file (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
export PATH="/usr/local/bin:$PATH"
```