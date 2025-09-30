# Decisions – Rulesets v0.4.0

> Reference: Historical v0.2.x decisions now live under `.agents/.archive/DECISIONS-v0.2.0-*.md`.

This document captures irreversible architectural and design decisions made during the v0.4 rewrite.

---

## D1: Defer OpenTelemetry Integration (2025-09-29)

**Decision:** Defer full OpenTelemetry integration to post-v0.4.0 release.

**Context:** OTel JS SDK 2.0+ targets Node >=18.19 and ES2022 but does not officially support Bun runtime. Upstream issues (#5514 memory leak, #5260 runtime errors) indicate additional shims needed.

**Rationale:**
- CLI already provides sufficient observability: structured JSON logging (`--format json`), global command history (`~/.config/rulesets/history.json`), and enhanced diagnostics (`--why/--explain`)
- Defer OTel until Bun officially supported by @opentelemetry/sdk-trace-node
- Avoids blocking v0.4.0 launch on upstream runtime compatibility

**Reference:** SCRATCHPAD.md § 2025-09-29; PLAN.md § 8 (marked DEFERRED)

---

## D2: Nested Config Format (2025-09-30)

**Decision:** Use nested object format for `sources` configuration.

**Before:**
```yaml
sources: ["./rules"]
partials: ["./partials"]
```

**After:**
```yaml
sources:
  rules: ["./rules"]
  partials: ["./partials"]
```

**Rationale:**
- Better organization and extensibility (e.g., future `templates`, `helpers` keys)
- More intuitive mental model (sources contain multiple source types)
- No backward compatibility needed (clean slate for v0.4)

**Impact:** Updated schema in `@rulesets/types`, simplified config loader in `@rulesets/core`, removed normalization helpers.

**Reference:** SCRATCHPAD.md § 2025-09-30 (Config Format Restructure)

---

## D3: Binary Distribution Model (2025-09-30)

**Decision:** Distribute standalone Bun binaries via system installation scripts.

**Approach:**
- Primary command: `rules` (with `rulesets` symlink alias)
- Install location: `/usr/local/bin`
- Installation via: `bun run install:binary` (calls `scripts/install-binary.sh`)
- Binary size: ~57MB standalone executable
- Platform priority: macOS/Linux at launch, Windows fast-follow

**Rationale:**
- Single-file distribution simplifies installation
- No runtime dependencies (Bun runtime bundled)
- System-wide availability preferred over npm global install
- Aligns with modern CLI tool patterns (Deno, Bun itself)

**Reference:** SCRATCHPAD.md § 2025-09-30 (Binary Build & Installation System)

---

## D4: Documentation Consolidation (2025-10-02)

**Decision:** Consolidate planning docs to single active working document (SCRATCHPAD.md).

**Structure:**
- **SCRATCHPAD.md** - Active working document with todos, progress, recent notes
- **IMPROVEMENTS.md** - Future design ideas (composition files, output routing)
- **DECISIONS.md** - Irreversible architectural decisions (this doc)
- **PLAN.md** - Sequential implementation checklist (reference, not actively updated)
- **`.agents/logs/YYYYMMDD-*.md`** - Archived historical context

**Rationale:**
- Reduce cognitive load (one place for active work tracking)
- Clear separation: active work vs. future ideas vs. historical record
- Timestamped logs preserve detailed context without cluttering working docs

**Reference:** SCRATCHPAD.md § 2025-10-02 (Documentation Consolidation)

---

## D5: Default Directory Structure (2025-09-24)

**Decision:** Project rules live under `.ruleset/` by default, with `.agents/ruleset/` as configurable alternative.

**Structure:**
- Config: `.ruleset/config.yaml` (or `.json`, `.jsonc`, `.toml`)
- Source rules: `.ruleset/rules/`
- Partials: `.ruleset/partials/`
- Cache: `.ruleset/cache/`
- Compiled outputs: Provider-specific (e.g., `.cursor/rules/`, `.windsurf/rules/`)

**Rationale:**
- `.ruleset/` prefix clearly identifies project rules infrastructure
- Avoids collision with common directories (`.vscode/`, `.github/`)
- Configurable for teams preferring `.agents/ruleset/` naming

**Reference:** SCRATCHPAD.md § Answered Questions

---

## D6: Tooling & Quality Gates (2025-09-24)

**Decision:** Use Bun for all package management and build tooling; enforce strict quality gates.

**Tooling Choices:**
- **Runtime:** Bun for CLI, latest stable Node for library consumers
- **Package manager:** Bun workspaces
- **Build:** Bun native bundler (CLI), tsc for library packages
- **Testing:** Bun test runner
- **Linting:** Biome (centralized config)
- **Formatting:** Biome
- **Type checking:** TypeScript strict mode (ES2022 baseline)

**Quality Gates:**
- Pre-commit: Format, Biome lint
- Pre-push: Lint, typecheck, test, build
- Enforcement: Lefthook hooks + CI (Linux/macOS matrix)

**Rationale:**
- Bun provides fastest tooling experience for development
- Strict gates prevent regressions and maintain code quality
- Biome offers speed and modern defaults over ESLint/Prettier

**Reference:** SCRATCHPAD.md § 2025-09-24 (v0.4 Foundations)

---

## D7: Watch Mode Philosophy (2025-09-26)

**Decision:** Watch mode prioritizes correctness over performance, with configurable tuning.

**Behavior:**
- Cache-aware: Only recompile changed sources + dependencies
- Dependency tracking: Partials, templates, config changes trigger invalidation
- Debouncing: 50ms default, configurable
- Graceful cleanup: Ctrl+C cleanup watchers

**Rationale:**
- Correctness more valuable than speed for development workflow
- Cache provides sufficient performance for most projects
- Advanced users can tune debounce/parallelization via config

**Reference:** SCRATCHPAD.md § 2025-09-26 (CLI watch mode)

---

## D8: Composition Files Design (2025-09-30)

**Decision:** Use content-based detection for composition files, not naming conventions.

**Detection:**
- **Rule file:** Has `ruleset:` frontmatter key
- **Composition file:** Contains YAML code blocks with inclusion directives
- **Hybrid:** Files can be both rules AND compositions

**No special naming required:**
- ~~Old approach: `_AGENTS.md` prefix for compositions~~
- **New approach:** Any `.md` file can be a composition if it contains YAML blocks

**Syntax:**
```yaml
file: core.md                # Simple path
file:                        # Advanced filtering
  glob: conventions/*.md
  tags: public,!internal
```

**Rationale:**
- Content-based detection more flexible than naming conventions
- Allows progressive enhancement (start as rule, add composition later)
- Single file can serve multiple purposes

**Status:** Designed, documented in IMPROVEMENTS.md, not yet implemented.

**Reference:** IMPROVEMENTS.md; SCRATCHPAD.md § 2025-09-30

---

## How to Update

- Capture context and rationale for each final decision
- Link back to relevant SCRATCHPAD notes, PLAN.md tasks, or PRs
- Number decisions sequentially (D1, D2, etc.)
- Archive superseded decisions to `.agents/logs/YYYYMMDD-superseded-decisions.md`
