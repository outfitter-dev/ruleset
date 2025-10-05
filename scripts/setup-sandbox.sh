#!/usr/bin/env bash
set -e

# Setup Sandbox - Create a temporary workspace from a template
# Usage: ./scripts/setup-sandbox.sh <template-name> [workspace-name]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TEMPLATE_NAME="${1:-basic}"
WORKSPACE_NAME="${2:-$TEMPLATE_NAME}"

TEMPLATE_DIR="$PROJECT_ROOT/examples/templates/$TEMPLATE_NAME"
WORKSPACE_DIR="$PROJECT_ROOT/examples/sandbox/$WORKSPACE_NAME"

echo "Rulesets Sandbox Setup"
echo "======================"
echo ""

# Validate template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo "Error: Template not found: $TEMPLATE_NAME"
    echo ""
    echo "Available templates:"
    ls -1 "$PROJECT_ROOT/examples/templates" 2>/dev/null || echo "  (none)"
    exit 1
fi

# Check if workspace already exists
if [ -d "$WORKSPACE_DIR" ]; then
    echo "Warning: Workspace already exists: $WORKSPACE_NAME"
    read -p "Remove and recreate? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    rm -rf "$WORKSPACE_DIR"
fi

# Create workspace directory
mkdir -p "$WORKSPACE_DIR"

# Copy template to workspace
echo "Creating workspace from template '$TEMPLATE_NAME'..."
cp -r "$TEMPLATE_DIR"/* "$WORKSPACE_DIR/"
cp -r "$TEMPLATE_DIR"/.[!.]* "$WORKSPACE_DIR/" 2>/dev/null || true

echo ""
echo "✓ Workspace created: examples/sandbox/$WORKSPACE_NAME"
echo ""
echo "Next steps:"
echo "  cd examples/sandbox/$WORKSPACE_NAME"
echo "  rules build"
echo "  rules build --watch"
echo ""
echo "Clean up with:"
echo "  bun run sandbox:clean"
echo ""
