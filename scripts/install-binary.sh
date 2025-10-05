#!/usr/bin/env bash
set -e

# Rulesets CLI Binary Installer
# Installs the compiled binary to /usr/local/bin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BINARY_PATH="$PROJECT_ROOT/apps/cli/dist/rulesets"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="rules"

echo "Rulesets CLI Binary Installer"
echo "=============================="
echo ""

# Check if binary exists
if [ ! -f "$BINARY_PATH" ]; then
    echo "Error: Binary not found at $BINARY_PATH"
    echo "Please run: bun run build:binary"
    exit 1
fi

# Check if install directory exists and is writable
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Error: Install directory doesn't exist: $INSTALL_DIR"
    exit 1
fi

# Check if we need sudo
if [ ! -w "$INSTALL_DIR" ]; then
    echo "Installing to $INSTALL_DIR (requires sudo)..."
    sudo cp "$BINARY_PATH" "$INSTALL_DIR/$BINARY_NAME"
    sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"
else
    echo "Installing to $INSTALL_DIR..."
    cp "$BINARY_PATH" "$INSTALL_DIR/$BINARY_NAME"
    chmod +x "$INSTALL_DIR/$BINARY_NAME"
fi

echo ""
echo "✓ Successfully installed $BINARY_NAME to $INSTALL_DIR"
echo ""
echo "You can now run:"
echo "  $ rules --help"
echo "  $ rules build"
echo ""
echo "Note: The binary is also available as 'rulesets' command (alias)"
echo ""

# Optionally create rulesets alias
if [ ! -w "$INSTALL_DIR" ]; then
    sudo ln -sf "$INSTALL_DIR/$BINARY_NAME" "$INSTALL_DIR/rulesets"
else
    ln -sf "$INSTALL_DIR/$BINARY_NAME" "$INSTALL_DIR/rulesets"
fi

echo "✓ Created 'rulesets' alias"
echo ""
