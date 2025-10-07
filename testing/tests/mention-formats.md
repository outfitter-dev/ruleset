# @Mention Format Tests

CONTEXT LABEL: 📝 Mention Formats (testing/tests/mention-formats.md)

This file tests different ways to @mention files.

## Inline Format

Please load the rules from @../src/config.toml for configuration.

## List Format

Dependencies:
- @../src/AGENTS.md
- @../docs/CLAUDE.md

## Code Block Format

```
@../src/utils.js
```

## Different Paths

- Subdirectory: @../docs/AGENTS.md
- Nested chain: @../a/chain-a.md
- Parent: @../../RULES_HANDLING.md
