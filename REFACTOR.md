# Rulesets v0.4 Rewrite Blueprint

## Purpose

Deliver a reference-grade Rulesets platform that scales from CLI usage to library integrations, sets a gold standard for provider support, and positions the project for future registry and automation features. This rewrite replaces the v0.2.x architecture; no backward compatibility is required.

## Guiding Outcomes

- ✨ **End-user delight** – The CLI (`rules`) feels fast, predictable, and ergonomic across macOS, Linux, and Windows.
- 🧰 **Reusable core** – A modular TypeScript library stack powers editor integrations, automation, and future daemons.
- 🔐 **Safety & trust** – Default sandboxing (Bun subprocesses + strict renderers) keeps providers and templates isolated.
- 📈 **Operational excellence** – Strict typing, validation, logging, and telemetry make the system observable and maintainable.

## Architectural Pillars

### Modular Package Suite

All packages share a single semver (0.4.x) released via Changesets:

- `@rulesets/types` – AST, config, error/result primitives, capability registry (strict TS + Zod).
- `@rulesets/parser` – Pure Markdown/front matter parser yielding typed AST nodes + diagnostics.
- `@rulesets/validator` – Schema and lint validation powered by shared Zod schemas.
- `@rulesets/transform` – Optional AST transforms (partials, includes, dedupe) prepared for future extensibility.
- `@rulesets/renderer` – Rendering adapters (Handlebars, Markdown passthrough, XML tag helpers).
- `@rulesets/providers` – Provider SDK and first-party providers.
- `@rulesets/orchestrator` – Source→Parse→Validate→Transform→Render→Write pipeline with streaming events and incremental caching (`.ruleset/cache`).
- `@rulesets/lib` – High-level programmatic API surface; bundles orchestrator helpers for consumers.
- `apps/cli` – Bun-based CLI exposing the `rules` command (alias `rulesets`).

### Public Entry Points

- Library consumers start with `@rulesets/lib` (and optional `@rulesets/api` façade if we split orchestration helpers).
- CLI consumes orchestrator APIs; no business logic should live only in the CLI.
- Providers communicate through the versioned SDK with capability negotiation, default isolation, and structured logging.

### Rendering & Sandbox Strategy

- Default renderer: Handlebars in strict mode, curated helper whitelist, escaped output unless overridden.
- Secondary renderer: Markdown passthrough with XML section support.
- Future renderers (JSON/YAML) accommodated via capability flags, not implemented in v0.4.
- Provider execution occurs in Bun subprocesses by default; configs can relax isolation for trusted providers.

### Configuration & Telemetry

- Config files live under `.ruleset/config.*`; CLI flags can read/write the same schema and persist changes.
- Global operations maintain history in `${XDG_CONFIG_HOME}/ruleset/history.json`.
- Runtime validation uses Zod, emitting versioned JSON Schema artifacts for editor integration.
- OpenTelemetry instrumentation ships opt-in with clear disclosure and a simple disable path.

## Scope & Deliverables

1. **Repository restructuring** – Bun-native tooling, strict TypeScript defaults, Lefthook-enforced lint/format/type/test gates.
2. **Orchestrator pipeline** – AsyncIterable compile/watch APIs, persistent cache, dependency graph for incremental rebuilds.
3. **Provider SDK v1** – Capability registry, sandbox handshake, structured results, graceful degradation with opt-in hard failure.
4. **First-party providers** – Rebuild AGENTS.md, Cursor, Windsurf, Claude Code, Codex, AMP, Gemini, RooCode, OpenCode, Zed, GitHub Copilot (and any AGENTS-compatible variants) on the new SDK.
5. **CLI rewrite** – Commands: `init`, `compile`, `watch`, `install`, `update`, `import`; formal JSON output schema, `--format` switch, `--why/--explain` diagnostics, config editing helpers.
6. **Caching & watch** – `.ruleset/cache` persists hashes/graph, correctness-first watch mode with tunable performance knobs.
7. **Testing & QA** – High coverage across packages, cross-platform CI, CLAUDE-assisted rule authoring tests, Bun binary builds (macOS/Linux at launch, Windows queued).
8. **Docs & readiness** – Comprehensive Markdown docs under `docs/`, updated AGENTS guidance, launch notes, automated release labels (`release:major|minor|patch|hotfix`).

## Non-Goals for v0.4

- Registry sync/publishing features (deferred to ≥1.0, likely via shadcn-style registry service).
- Long-lived daemon/service mode (CLI + library only for launch; keep code ready for fast follow).
- Legacy schema compatibility or migration tooling (clean slate).
- Polyglot/FFI bindings beyond TypeScript/JavaScript consumers (future). 

## References

- Implementation sequencing lives in @PLAN.md.
- Day-to-day context and open questions live in @SCRATCHPAD.md.
- Historical decisions and scratchpads archived under `.agents/.archive/`.

## Next Steps

1. Land foundational repo restructuring (PLAN §1–2).
2. Progress through plan sections sequentially, recording decisions in SCRATCHPAD logs or, when finalized, back into this blueprint.
3. Gate merge on CI + manual quality review; release only when the product meets the “best tool possible” bar.
