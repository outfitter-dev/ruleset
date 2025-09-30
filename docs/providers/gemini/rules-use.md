# Gemini Code Assist Rules System

Gemini Code Assist (ChromeOS Studio 2025.1+) ships with repository-aware rules. The assistant looks for Markdown guidance files and merges them into the coding context whenever they exist.

## Key Features

- **Rule Types:** Workspace defaults plus directory-scoped overrides
- **Primary File:** `AGENTS.md` at the repository root (Gemini still recognises legacy `GEMINI.md`)
- **Nested Rules:** `.gemini/rules/**/AGENTS.md` for per-folder guidance
- **File Format:** Plain Markdown; headings are surfaced directly in the IDE panel
- **Prompt Integration:** Rules appear in the "Project guidance" drawer and are injected when relevant

## Canonical Locations & Precedence

```text
<repo-root>/AGENTS.md               # Canonical root guidance file
<repo-root>/GEMINI.md               # Optional alias (legacy clients)
<repo>/.gemini/rules/**/AGENTS.md   # Directory-specific rules (mirrors folder layout)
```

Gemini applies rules in this order: root file → nested directories (closest folder wins) → any manual rule selections.

## Directory Structure Example

```text
project/
├── GEMINI.md
├── .gemini/
│   └── rules/
│       ├── api/standards.md
│       └── web/ui.md
└── packages/
    └── data/
        └── .gemini/rules/testing.md
```

## Authoring Guidelines

- Start each file with an overview heading that summarizes the rule scope.
- Keep instructions actionable (style guides, setup steps, deployment checklists).
- Use smaller, topic-focused files rather than a single monolithic document.
- Cross-link to deeper documentation using relative Markdown links.

## Workflow Tips

1. Generate outputs with the Rulesets Gemini provider.
2. Copy or symlink the compiled artifacts into `AGENTS.md` / `.gemini/rules/**` as needed. The compiler now emits a canonical `AGENTS.md` beside each rendered artifact for convenience.
3. Reload Gemini Code Assist so the IDE reindexes the files.
4. Review the "Project guidance" drawer to confirm headings look correct.

## Best Practices

- Maintain a changelog section so teammates understand recent updates.
- Pair directory rules with matching glob patterns in other providers for parity.
- Keep sensitive credentials out of rule files—Gemini reads them verbatim.
- Trim outdated advice; large files increase load time and may be truncated.

## Version Information

| Aspect                | Details               |
| --------------------- | --------------------- |
| Last verified release | 2025.1 (Jan 2025)     |
| Root filename         | `AGENTS.md` (preferred) |
| Nested directories    | `.gemini/rules/**`    |

## Rulesets Integration

The Gemini provider emits Markdown artifacts under `.ruleset/dist/gemini/…` by default and mirrors each directory with a canonical `AGENTS.md`. Override `gemini.outputPath` to publish directly to `AGENTS.md`, `GEMINI.md`, or a specific rules directory when wiring into CI.
