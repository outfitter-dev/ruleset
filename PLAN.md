# PLAN – Ruleset v0.4 Rewrite

> This plan tracks the sequential work required to deliver the full rewrite described in `REFACTOR.md`. Each section should complete before moving to the next unless explicitly noted.

## 1. Establish Rewrite Foundations
- [x] Create the `gt-v0.4/rewrite` base branch from the latest `main`, restack outstanding work, and document branch hygiene.
- [x] Align repository metadata (package.json versions, Changesets config) on the 0.4.0 pre-release series.
- [x] Stand up updated GitHub Actions scaffolding for multi-platform builds (macOS/Linux initially, Windows staging).

## 2. Monorepo Structure & Tooling
- [x] Carve out new package layout (`packages/types`, `packages/parser`, `packages/renderer`, `packages/orchestrator`, `packages/lib`, etc.) and migrate existing code into placeholders.
- [x] Move CLI implementation into `apps/cli` (command `rules`, alias `rulesets`).
- [x] Switch build scripts to Bun-native tooling; remove legacy tsup/rollup configs that are no longer needed.
- [x] Configure strict TS/Biome/format hooks for pre-commit and pre-push via Lefthook.

## 3. Typing, Schemas, and Shared Contracts
- [x] Define central AST, config, and result types in `@rulesets/types` with exhaustive TS strictness (mirroring ultracite defaults).
- [x] Implement Zod schemas that produce JSON Schema artifacts for configs, rules front matter, and provider descriptors.
- [x] Publish versioned capability registry and error/result primitives (using `type-fest` helpers where possible).

## 4. Orchestrator Pipeline
- [x] Build the Source → Parse → Validate → Transform → Render → Write pipeline in `@rulesets/orchestrator` with streaming AsyncIterable events.
- [x] Implement persistent cache management under `.ruleset/cache` with content hashing and dependency graph tracking.
- [x] Add incremental compile/watch support prioritising correctness, with configuration hooks for performance tuning.
- [x] Expose high-level APIs through `@rulesets/lib` (and `@rulesets/api` if needed) for library consumers.

## 5. Provider SDK & Isolation
- [x] Ship the versioned Provider SDK (capability negotiation, sandbox handshake, structured errors).
- [x] Implement default Bun-based subprocess isolation plus strict Handlebars helper sandboxing.
- [x] Port first-party providers (AGENTS.md, Cursor, Windsurf, Claude Code, Codex, AMP, Gemini, RooCode, OpenCode, Zed, GitHub Copilot) onto the new SDK.
- [x] Add graceful warnings + config-driven hard-fail behaviour when providers request unsupported capabilities.

## 6. Rendering & Template Engines
- [x] Deliver Handlebars renderer with strict defaults and curated helper set.
- [x] Implement Markdown passthrough renderer and XML-tag support for section names.
- [x] Provide extension hooks for future JSON/YAML emitters without committing to implementation yet.

## 7. CLI Surface (`apps/cli`)
- [x] Rebuild commands (`rules init`, `compile`, `watch`, `install`, `update`, `import`) on top of the new orchestrator.
- [x] Implement config editing via CLI overrides with persistence to `.ruleset/config.*` files.
- [x] Add formally versioned JSON log output (`--format json`) with human-friendly default and `--verbose` / `--quiet` switches.
- [x] Provide `--why/--explain` diagnostics flag for rich error messaging.
- [x] Add global command history tracking to `~/.config/rulesets/history.json` for audit trails.

## 8. Telemetry, Observability, and Diagnostics (DEFERRED)
- [ ] **DEFERRED TO POST-v0.4.0**: Full OpenTelemetry integration pending upstream Bun compatibility fixes.
- [x] Existing observability via structured JSON logging (`--format json`), global history tracking, and enhanced diagnostics sufficient for launch.
- [ ] Future: Integrate OTel once Bun runtime officially supported by @opentelemetry/sdk-trace-node v2.x.

## 9. Quality Gates & Automation

### Test Coverage Expansion
- [ ] Audit existing test coverage across all packages (current: 235 tests passing)
- [ ] Add integration tests for orchestrator → provider flows (all first-party providers)
- [ ] Add E2E CLI tests covering: `compile`, `watch`, `init`, `config`, `install`, `update`, `history`
- [ ] Add cross-provider test matrix (ensure all providers work with cache/watch)
- [ ] Add error path coverage (invalid configs, missing capabilities, failed renders)

### Cross-Platform Validation
- [ ] Expand CI matrix to test on: macOS (arm64/x64), Linux (x64), Windows (staging)
- [ ] Add file path resolution tests for Windows (backslash handling)
- [ ] Verify watch mode works across platforms (fs.watch vs chokidar)
- [ ] Test binary builds on all target platforms

### Provider Sandbox Coverage
- [ ] Add sandbox execution tests for all first-party providers
- [ ] Test capability negotiation failure paths
- [ ] Test subprocess timeout/error handling
- [ ] Verify sandbox isolation (no filesystem access outside project)

### Release Automation
- [ ] Verify Changesets recognizes `release:*` labels
- [ ] Test npm package publishing workflow
- [ ] Configure Bun binary builds (macOS/Linux at launch, Windows fast-follow)
- [ ] Add smoke tests for compiled binaries

### Optional Enhancements
- [ ] Add "AI-assisted rule authoring" verification harness (Claude Code SDK integration)
- [ ] Add performance benchmarks for compile/watch operations
- [ ] Add memory/leak detection for long-running watch mode

## 10. Documentation & Launch Readiness
- [ ] Update `docs/` with comprehensive Markdown guides (architecture, provider authoring, CLI usage, upgrade notes).
- [ ] Refresh `AGENTS.md` references to point at new planning docs and clarify expectations for contributors.
- [ ] Draft v0.4.0 GA announcement/changelog summarising breaking changes and new capabilities.
- [ ] Validate that all blockers are closed, then cut the 0.4.0 release when quality bar is met.
