#!/usr/bin/env bash
set -e

# Rulesets CLI Binary Uninstaller
# Removes the compiled binary from /usr/local/bin

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="rules"

echo "Rulesets CLI Binary Uninstaller"
echo "================================"
echo ""

# Check if binary exists
if [ ! -f "$INSTALL_DIR/$BINARY_NAME" ]; then
    echo "Binary not found at $INSTALL_DIR/$BINARY_NAME"
    echo "Nothing to uninstall."
    exit 0
fi

# Check if we need sudo
if [ ! -w "$INSTALL_DIR" ]; then
    echo "Removing from $INSTALL_DIR (requires sudo)..."
    sudo rm -f "$INSTALL_DIR/$BINARY_NAME"
    sudo rm -f "$INSTALL_DIR/rulesets"
else
    echo "Removing from $INSTALL_DIR..."
    rm -f "$INSTALL_DIR/$BINARY_NAME"
    rm -f "$INSTALL_DIR/rulesets"
fi

echo ""
echo "✓ Successfully uninstalled $BINARY_NAME from $INSTALL_DIR"
echo ""