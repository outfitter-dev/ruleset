# OpenCode Rules System

OpenCode (v0.18+, April 2025) consumes Markdown guidance stored in your repository. Rules give the assistant the same project context every time you invoke it.

## Key Features

- **Rule Types:** Global project guidance and scoped folder overrides
- **Default Files:** Root `AGENTS.md` plus `.opencode/rules/**/*.md`
- **Prompt Integration:** Rules render in the sidebar and are injected into prompts automatically
- **File Format:** Markdown with optional YAML headings (ignored by the runtime)
- **Extensibility:** Supports multiple workspace rule sets through directory mirroring

## Canonical Locations & Precedence

```text
<repo-root>/AGENTS.md               # Root guidance
<repo>/.opencode/rules/**/*.md      # Folder-level rules (mirrors repo layout)
```

OpenCode loads rules from root to leaf: the root file first, then nested directories with the closest match winning when conflicts occur.

## Directory Structure Example

```text
project/
├── AGENTS.md
├── .opencode/
│   └── rules/
│       ├── backend/standards.md
│       └── frontend/ui.md
└── packages/
    └── core/
        └── .opencode/rules/testing.md
```

## Content Recommendations

- Outline coding conventions, review checklists, deployment runbooks, and architectural context.
- Use headings to group guidance by topic; OpenCode surfaces these directly.
- Keep paragraphs short and action oriented; the agent reads the file verbatim.
- Avoid duplication—link to deeper docs where needed.

## Workflow Tips

1. Compile rules with the OpenCode provider (`rules compile --providers opencode`).
2. Copy generated files into `.opencode/rules/` or keep them in `.ruleset/dist`; the compiler now emits both the rendered rule and a sibling `AGENTS.md` for each directory so you can choose whichever layout fits your workflow.
3. Commit rule files so teammates inherit the same guidance.
4. Reload OpenCode or restart the workspace to pick up the updates.

## Best Practices

- Pair rule files with unit tests or lint checks where relevant.
- Keep a short "Quickstart" section at the top of `AGENTS.md`.
- Split large domain knowledge into subdirectories for focused consumption.
- Monitor file size (~4–6 KB is a safe target) to stay within context budgets.

## Version Information

| Aspect                | Details             |
| --------------------- | ------------------- |
| Last verified release | v0.18 (Apr 2025)    |
| Root filename         | `AGENTS.md`         |
| Nested directory path | `.opencode/rules/`  |

## Rulesets Integration

Configure `opencode.outputPath` when you need to publish directly into `.opencode/rules/`. If you prefer to manage artifacts manually, use the default `.ruleset/dist/opencode/…` outputs—the provider now emits both the original filename and a canonical `AGENTS.md` in each directory so you can sync either form during your build or CI step.
