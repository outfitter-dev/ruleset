# @rulesets/orchestrator

High-level pipeline for the Rulesets v0.4 rewrite. It wires together parsing, validation, transforms, rendering, and provider execution. The current implementation stitches the placeholder packages so downstream consumers can begin integrating with the new API surface.

The orchestrator now validates provider capability requirements ahead of compilation, surfacing structured diagnostics when a target requests features the provider handshake does not advertise.

## Scripts

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
