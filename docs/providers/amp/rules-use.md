# Amp Rules System

Amp (December 2024+) introduces repository-scoped guidance through Markdown rules that live beside your code. Agents ingest the rendered files automatically when present, so well-structured content directly shapes the in-editor experience.

## Key Features

- **Rule Types:** Always-on project guidance plus folder-specific overrides
- **Scoping Mechanisms:** Root-level `AGENTS.md` with optional nested `.amp/rules/**/AGENTS.md`
- **File Format:** Plain Markdown; YAML front matter is ignored
- **Prompt Integration:** Applied to every session when discovered, with folder rules layered after the root file
- **Character Guidance:** Keep files focused (<5k characters recommended) to avoid truncation by the agent panel

## Canonical Locations & Precedence

```text
<repo-root>/AGENTS.md             # Primary project guidance
<repo>/.amp/rules/**/AGENTS.md    # Optional nested rules (subdirectories)
```

Amp loads rules in the following order:

1. Project root `AGENT.md`
2. Nested `.amp/rules/**/AGENT.md` files from deepest path to shallowest
3. Any manual selections inside the IDE session

If duplicate sections appear, the deeper directory wins.

## Directory Structure Example

```text
project/
├── AGENT.md
├── apps/
│   └── .amp/
│       └── rules/
│           └── mobile/AGENT.md
└── packages/
    └── api/
        └── .amp/
            └── rules/AGENT.md
```

## Rule Content Guidelines

- Lead with project primers, build instructions, and coding standards.
- Favor concise bullet lists over prose; Amp presents the file verbatim.
- Add section headings to help collaborators skim quickly.
- Avoid secrets—Amp mirrors the repository content as-is.

## Workflow Tips

1. Create `AGENTS.md` at the root.
2. Run the Rulesets compiler with the Amp provider to populate `.amp/rules/...` outputs (the compiler now emits both the canonical `AGENTS.md` and any per-directory files).
3. Commit generated files or automate copying into place via CI.
4. Restart Amp or reload the project so new guidance is ingested.

## Best Practices

- Keep root guidance evergreen; push experimental rules into nested folders.
- Use relative links for deeper docs so collaborators can explore further detail.
- When content grows large, split into topical nested rules instead of one huge file.
- Pair Amp rules with matching Cursor or Windsurf guidance for cross-tool consistency.

## Version Information

| Aspect                | Details            |
| --------------------- | ------------------ |
| Last verified release | 2024.12 (Dec 2024) |
| Default rule file     | `AGENTS.md`        |
| Nested support        | `.amp/rules/**`    |

## Rulesets Integration

Use the Rulesets Amp provider to emit the correct file layout. By default the compiler emits both per-source artifacts under `.ruleset/dist/amp/**` and a canonical `AGENTS.md` in each directory. Override `amp.outputPath` to publish directly to `AGENTS.md`, or target `.amp/rules/` directories for per-folder guidance.
