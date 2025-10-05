# AGENT SCRATCHPAD

Tracking work toward the Ruleset v0.4.0 rewrite.

## Progress Overview

**Current Status:** ~70% complete (Sections 1-7 ✅ done, 8-10 remaining)

### Completed (Sections 1-7)
- ✅ Rewrite foundations (branch setup, package versions, CI scaffolding)
- ✅ Monorepo structure & tooling (Bun, strict TS/Biome/format hooks)
- ✅ Typing, schemas, and shared contracts (Zod schemas, JSON Schema artifacts)
- ✅ Orchestrator pipeline (streaming events, persistent cache, watch mode)
- ✅ Provider SDK & isolation (Bun subprocess sandbox, capability negotiation)
- ✅ Rendering & template engines (Handlebars, Markdown passthrough, XML support)
- ✅ CLI surface (all commands, config editing, diagnostics, history tracking)

### Remaining Work

#### Section 8: Telemetry (DEFERRED)
- Full OpenTelemetry integration deferred to post-v0.4.0 (Bun compatibility pending)
- Current observability sufficient: JSON logging, global history, enhanced diagnostics

#### Section 9: Quality Gates
- [ ] Test coverage expansion
  - [ ] Integration tests for orchestrator → provider flows
  - [ ] E2E CLI tests for all commands
  - [ ] Cross-provider test matrix (cache/watch compatibility)
  - [ ] Error path coverage (invalid configs, missing capabilities, failed renders)
- [ ] Cross-platform validation
  - [ ] Expand CI matrix (macOS arm64/x64, Linux x64, Windows staging)
  - [ ] File path resolution tests for Windows
  - [ ] Watch mode cross-platform verification
  - [ ] Binary builds on all target platforms
- [ ] Provider sandbox coverage
  - [ ] Sandbox execution tests for all first-party providers
  - [ ] Capability negotiation failure paths
  - [ ] Subprocess timeout/error handling
  - [ ] Isolation verification tests
- [ ] Release automation
  - [ ] Verify Changesets + release labels
  - [ ] Test npm package publishing workflow
  - [ ] Configure Bun binary builds
  - [ ] Smoke tests for compiled binaries

#### Section 10: Documentation & Launch Readiness
- [ ] Update comprehensive docs under `docs/`
  - [ ] Architecture guide
  - [ ] Provider authoring guide
  - [ ] CLI usage guide
  - [ ] Upgrade notes from v0.2.x
- [ ] Refresh AGENTS.md references
- [ ] Draft v0.4.0 GA announcement/changelog
- [ ] Final quality review before release

## Todos

### Active

- [ ] Test coverage expansion (Section 9)
- [ ] Cross-platform validation (Section 9)
- [ ] Provider sandbox coverage (Section 9)
- [ ] Release automation setup (Section 9)
- [ ] Documentation updates (Section 10)
- [ ] AGENTS.md refresh (Section 10)
- [ ] v0.4.0 announcement draft (Section 10)

## Questions

### Open Questions

- Should we add performance benchmarks for build/watch operations?
- Do we want "AI-assisted rule authoring" verification harness (Claude Code SDK)?
- Memory/leak detection for long-running watch mode?

### Answered Questions

- Release ships when it's truly excellent; no fixed target date.
- Primary CLI command is `rules` with `rulesets` alias.
- Branch prefix: `gt-v0.4/rewrite/*` (begin from a single shared branch, split with `gt split` later).
- Registry integrations are out of scope for v0.4.
- Persistent cache lives under `.ruleset/cache` (garbage collect as needed).
- Provider execution defaults to Bun-based isolation with strict helper sandboxing.
- Runtime baseline: latest Bun, latest stable Node.
- Config can be edited via files or CLI overrides; persist history in global `.ruleset/history.json`.

## Decisions (quick reference)

- Keep project rules under `.ruleset/` by default; support `.agents/ruleset/` via config.
- Use Bun for package management and build tooling wherever possible.
- Enforce strict TS/format/lint checks in pre-commit and pre-push hooks.
- Watch mode prioritises correctness; efficiency toggles configurable.
- Opt-in diagnostics for telemetry (OpenTelemetry with clear guidance and easy disable) - DEFERRED.

## Recent Notes

### 2025-10-05

**Completed: `compile` → `build` Command Migration:**
- Renamed primary command from `rules compile` to `rules build` for better UX
- Kept `compile` as deprecated alias during transition period
- Updated all documentation to reflect new command name
- See implementation details: `.agents/logs/202510051135-compile-to-build-migration.md`
- Explored universal `--history` flag design for future (deferred to post-v0.4.0)

### 2025-10-04

**CLI Build Output Control:**
- Implemented `--write` and `--dry-run` flags for `rules build` command
- **Default behavior** (`rules build`): Writes only to staging area (`.ruleset/dist/<provider>/`), shows skipped provider-specific paths
- **With `--write`**: Writes to both staging area AND provider-specific paths (`.cursor/rules/`, `CLAUDE.md`, etc.)
- **With `--dry-run`**: Performs compilation without writing any files (validation only)
- Prevents combining `--write` and `--dry-run` flags (mutual exclusion)
- Updated `writeArtifacts()` to distinguish staging vs canonical artifacts based on path detection
- Provides clear user feedback: "staged", "wrote", or "skipped" labels for each artifact

### 2025-10-02

**Documentation Consolidation:**
- Archived MIGRATION.md → `.agents/logs/20251002-v03-migration-notes.md` (historical reference only)
- Archived REFACTOR.md → `.agents/logs/20251002-v04-rewrite-blueprint.md` (blueprint complete, execution ~70% done)
- Kept IMPROVEMENTS.md for future design ideas (composition files, output routing)
- Kept DECISIONS.md for tracking key decisions
- Simplified SCRATCHPAD.md to focus on active work (Sections 8-10)

### 2025-09-30

**Binary Build & Installation System:**
- Created Bun binary build system (`build:binary`) producing standalone 57MB executables
- Implemented install/uninstall scripts for `/usr/local/bin`
- Binary installs as `rules` (primary) with `rulesets` alias (symlink)

**Examples & Testing Sandbox:**
- Restructured to unified `examples/` directory with `templates/` and `sandbox/`
- Added sandbox setup/clean scripts for isolated testing

**Config Format Restructure:**
- Migrated from flat array to nested object format: `sources: { rules: [...], partials: [...] }`
- Removed backward compatibility code (clean slate for v0.4)

**Output Configuration & Composition Files Design:**
- Designed output routing system with boolean | string | array | object pattern
- Composition files use YAML code blocks for inclusion directives
- Content-based detection (no special naming required)
- Documented in IMPROVEMENTS.md

### 2025-09-28

**CLI Configuration & Diagnostics:**
- Implemented `config` command with get/set/unset/list operations
- Added `saveProjectConfig()` supporting YAML, JSON, JSONC, TOML
- Enhanced compile with `--why/--explain` flags for detailed diagnostics
- Implemented global command history tracking in `~/.config/rulesets/history.json`
- Added `history` command with multiple viewing modes
- **Section 7 (CLI Surface) now 100% complete**

### 2025-09-27

**Provider Expansion:**
- Implemented Amp, Gemini, OpenCode, Zed providers
- Added canonical `AGENTS.md` emission to all first-party providers (except Claude)
- Moved Cursor, Copilot, Windsurf to shared filesystem helper
- Unified `--format <text|json>` flag across CLI

### 2025-09-26

**Orchestrator & Rendering:**
- Refactored orchestrator to streaming pipeline with events
- Implemented persistent cache under `.ruleset/cache`
- Added CLI `--watch` support with dependency tracking
- Landed Handlebars renderer with partials and helpers
- Added Markdown passthrough + XML emission support

### 2025-09-25

**Package Layout & Providers:**
- Migrated CLI to `apps/cli`
- Ported parser, validator, and providers to dedicated packages
- Centralized Biome configuration
- Added Syncpack dependency checks
- Replaced CLI `compile` with orchestrator-based implementation

### 2025-09-24

**v0.4 Foundations:**
- Created `gt-v0.4/rewrite` base branch
- Updated workspace to `0.4.0-next.0` prerelease
- Refreshed CI scaffolding (Linux/macOS matrix)
- Laid out v0.4 package skeletons
- Stabilized cross-package typecheck

## Archive Reference

For detailed historical notes on Sections 1-7 implementation, see:
- `.agents/logs/20251002-v04-rewrite-blueprint.md` - Original v0.4 blueprint
- Daily notes from 2025-09-24 through 2025-09-30 captured the full implementation journey

Full detailed notes are preserved above for reference, but active work should focus on Sections 8-10 remaining tasks.
