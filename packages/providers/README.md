# @rulesets/providers

Provider SDK primitives for the Rulesets v0.4 rewrite. Providers expose a handshake and compile function, negotiate capabilities against the shared registry in `@rulesets/types`, and return structured results/diagnostics.

## Capability negotiation
- Use `providerCapability(...)` to hydrate known capability descriptors or declare custom ones
- `RULESET_CAPABILITIES` advertises the built-ins supported by the orchestrator (markdown passthrough, filesystem output, structured diagnostics, etc.)
- `unsupportedCapability(...)` now produces a `RulesetError` when a requested capability is unavailable

## Scripts

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
