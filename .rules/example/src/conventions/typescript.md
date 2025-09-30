---
ruleset:
  version: 0.4.0
name: TypeScript Conventions
tags: [conventions, public, typescript]
---

# TypeScript Conventions

TypeScript rules enforced by Ultracite + Biome: fast, deterministic, AI-friendly.

## Type Safety (Use X, not Y)

- Use discriminated unions, not enums or `const enum`
- Use `unknown` at boundaries + schema/guards to parse, not `any` or trusting input
- Use `satisfies` for constraint checking, not `as` to force types
- Use `as const` to preserve exactness, not widened literals
- Use `readonly` and immutability by default, not in-place mutation
- Use branded opaque IDs (e.g. `type UserId = string & { __brand: 'UserId' }`), not bare strings
- Use exhaustive `switch` + `never`, not partial branching
- Use `import type` / `export type`, not value imports/exports for types

Example (exhaustive switch helper):

```typescript
type Kind = 'a' | 'b';
function assertNever(x: never): never { throw new Error(`Unhandled: ${x}`); }
function handle(kind: Kind) {
  switch (kind) {
    case 'a': return 1;
    case 'b': return 2;
    default: return assertNever(kind);
  }
}
```

## Compiler Settings

- Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Avoid non-null `!` assertions. Prove with control flow

## Correctness & Safety

- Use handled Promises (`await` or `.then/.catch`), not fire-and-forget
- Use `Promise.all(…)` to batch, not `await` inside loops
- Use `Number.isNaN`/`Number.isFinite`, not globals
- Use `parseInt(str, 10)`, not missing radix
- Use `Array.isArray`, not `instanceof Array`
- Never use `@ts-ignore`; fix types or use targeted escape hatch
- Prevent import cycles; split modules or invert dependencies
- Do not hardcode secrets; load via configuration

## Logging

- Use structured logger in apps (Pino/Winston), not `console.*` for operational logs
- Use `console` for CLIs where console is the UI
- Use Error objects, not strings: `new Error('message')` with `.cause`
- Use redaction for secrets/PII; never log tokens or passwords

## Remember

- Type safety first: unions over enums; `unknown` at boundaries; no `@ts-ignore`
- Be exhaustive: `switch` + `never`; handle all Promises
- Logging discipline: structured logs in apps; console for CLI; never log secrets
- Validate at boundaries; types do not sanitize input
