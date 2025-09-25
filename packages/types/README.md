# @rulesets/types

Shared type definitions, diagnostics primitives, capability registry, and JSON Schema artifacts for the Rulesets v0.4 toolchain.

## What's Included
- Strongly typed AST, diagnostics, and compile/contracts shared across packages
- Versioned capability registry (`RULESET_CAPABILITIES`) with helper utilities for provider negotiation
- Ergonomic error/result helpers (`createRulesetError`, `createResultOk`, `isResultErr`, etc.)
- Zod-powered config/frontmatter schemas that emit JSON Schema files under `dist/schemas/`

## Scripts
- `bun run build` – emit ESM, type declarations, and JSON Schema artifacts into `dist/`
- `bun run typecheck` – validate the source without emitting artifacts
- `bun run lint` – run Biome linting against `src/`
- `bun run test` – execute Bun-based unit tests for the shared helpers

## Publishing
All workspace packages share the `0.4.0-next` prerelease line. Ensure Changesets is updated before publishing new builds.
