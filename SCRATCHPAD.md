# AGENT SCRATCHPAD

Tracking work toward the Rulesets v0.4.0 rewrite.

## Questions

### Open Questions

<!-- Add open questions as list items -->

### Answered Questions

- Release ships when it7s truly excellent; no fixed target date.
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
- Opt-in diagnostics for telemetry (OpenTelemetry with clear guidance and easy disable).

## Todo Overview

- [ ] Establish `gt-v0.4/rewrite` base branch and restack current work onto it.
- [ ] Draft initial v0.4 implementation plan in `PLAN.md`.
- [ ] Document the rewrite blueprint in `REFACTOR.md`.
- [ ] Update AGENTS.md references to point at new artifacts.
- [ ] Prepare pre-commit/pre-push hook updates for stricter checks.

## Notes

### 2025-09-24

- Created fresh scratchpad for the v0.4 rewrite effort and archived the v0.2.0 notes.
