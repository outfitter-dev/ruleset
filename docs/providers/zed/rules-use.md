# Zed Rules System

Zed (2025.2+) introduces "Project Rules" that live alongside your code and steer the AI assistant. Rules are plain Markdown files; Zed automatically ingests them when you open a workspace.

## Key Features

- **Rule Types:** Global `AGENTS.md` plus `.zed/rules/**` for scoped overrides
- **File Format:** Markdown; headings show up inside the Zed command palette
- **Prompt Integration:** Rules load on project open and are referenced whenever files inside the associated directory are active
- **Character Guidance:** Keep each file short (≈3–5 KB) to avoid prompt truncation

## Canonical Locations & Precedence

```text
<repo-root>/.zed/rules/AGENTS.md          # Canonical project rule file
<repo-root>/AGENTS.md                     # Optional alias
<repo>/.zed/rules/**/AGENTS.md            # Nested folder rules
```

Zed merges rules from the root outward: the workspace file first, followed by the deepest matching subdirectory.

## Directory Structure Example

```text
project/
├── .zed/
│   └── rules/
│       ├── AGENTS.md
│       ├── api/overview.md
│       └── web/ui.md
├── packages/
│   └── shared/
│       └── .zed/rules/testing.md
└── AGENTS.md (optional legacy)
```

## Authoring Guidelines

- Start with quick-start steps and mission-critical conventions.
- Break out feature-specific guidance into nested directories.
- Use numbered or bulleted lists for decision trees and review checklists.
- Provide links to architecture docs for deeper dives.

## Workflow Tips

1. Run the Rulesets Zed provider to emit `.ruleset/dist/zed/...` artifacts.
2. Copy the generated files into `.zed/rules/` (or point `zed.outputPath` directly there). The compiler now includes a canonical `AGENTS.md` alongside each rendered artifact to simplify publishing.
3. Commit the files and push; teammates inherit the same guardrails automatically.
4. Reopen the workspace so Zed reindexes the rule files.

## Best Practices

- Keep headings unique—Zed surfaces them in selection menus.
- Coordinate rule names with other IDE providers to maintain parity across tooling.
- Avoid embedding secrets or tokens; files are plain text in the repo.
- Update rules when workflows change; stale guidance is worse than none.

## Version Information

| Aspect                | Details           |
| --------------------- | ----------------- |
| Last verified release | 2025.2 (Feb 2025) |
| Primary path          | `.zed/rules/`     |
| Fallback filename     | `AGENTS.md`       |

## Rulesets Integration

Set `zed.outputPath` to target `.zed/rules/AGENTS.md` (or any nested path). Otherwise, consume the default `.ruleset/dist/zed/...` outputs—the provider emits both the rendered filename and a sibling `AGENTS.md`, giving you flexibility when copying files during your build or CI step.
