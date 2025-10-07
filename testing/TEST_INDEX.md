# Test Index

CONTEXT LABEL: 📋 Test Index (testing/TEST_INDEX.md)

This file catalogs all test files and their purposes.

## Core Tests

- `AGENTS.md` / `CLAUDE.md` - Main test harness files (root)
- `docs/AGENTS.md` / `docs/CLAUDE.md` - Documentation context
- `src/AGENTS.md` / `src/CLAUDE.md` - Code context

## File Type Tests

- `src/utils.js` - JavaScript file (🟨)
- `src/config.toml` - TOML configuration (⚙️)
- `.config/settings.yml` - Hidden YAML config (🔒)

## Discovery Tests

- `tests/.hidden-rules.md` - Hidden file discovery
- `tests/.testyrc` - Dotfile without extension
- `tests/MANIFEST` - No extension file
- `tests/secrets.md` - Gitignored file (🔐)

## @Mention Tests

- `tests/references.md` - Tests @mentions to various locations
- `tests/mention-formats.md` - Different @mention syntaxes
- `a/chain-a.md` → `a/b/chain-b.md` → `a/b/c/chain-c.md` - Nested directory chains (🔗)
- `tests/circular-1.md` ↔ `tests/circular-2.md` - Circular references (♻️)
- `tests/order-1.md` → `tests/order-2.md` → `tests/order-3.md` - Load order (1️⃣ 2️⃣ 3️⃣)

## Special Cases

- `tests/comments.md` - CONTEXT LABEL in HTML comment (💬)
- `a/AGENTS.md` → `a/b/c/d/e/deep.md` - Deeply nested file (5 levels, 🗂️)
