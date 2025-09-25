# @rulesets/parser

Rulesets v0.4 parser pipeline. The current implementation is a stub that echoes the source document so the new package layout can compile. Replace this with the real Markdown + front matter parser during the orchestrator implementation.

## Scripts

- `bun run build` – emits compiled output to `dist/`
- `bun run typecheck` – validates the package without emitting
- `bun run lint` – runs Biome linting
- `bun run test` – reserved for parser-specific tests
