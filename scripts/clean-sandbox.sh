#!/usr/bin/env bash
set -e

# Clean Sandbox - Remove all temporary workspaces
# Usage: ./scripts/clean-sandbox.sh [workspace-name]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WORKSPACE_NAME="${1:-}"
TEMP_DIR="$PROJECT_ROOT/examples/sandbox"

echo "Rulesets Sandbox Cleanup"
echo "========================"
echo ""

# If specific workspace provided, clean only that
if [ -n "$WORKSPACE_NAME" ]; then
    WORKSPACE_DIR="$TEMP_DIR/$WORKSPACE_NAME"
    if [ ! -d "$WORKSPACE_DIR" ]; then
        echo "Workspace not found: $WORKSPACE_NAME"
        exit 1
    fi

    echo "Removing workspace: $WORKSPACE_NAME"
    rm -rf "$WORKSPACE_DIR"
    echo "✓ Removed examples/sandbox/$WORKSPACE_NAME"
    exit 0
fi

# Clean all temp workspaces
if [ ! -d "$TEMP_DIR" ]; then
    echo "No temp directory found. Nothing to clean."
    exit 0
fi

# Count workspaces
WORKSPACE_COUNT=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')

if [ "$WORKSPACE_COUNT" -eq 0 ]; then
    echo "No temporary workspaces found."
    exit 0
fi

echo "Found $WORKSPACE_COUNT temporary workspace(s):"
ls -1 "$TEMP_DIR" 2>/dev/null | sed 's/^/  - /'
echo ""

read -p "Remove all temporary workspaces? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

rm -rf "$TEMP_DIR"/*
echo ""
echo "✓ Cleaned all temporary workspaces"
echo ""