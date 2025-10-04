---
slug: typescript_conventions
---

# TypeScript Standards

## Type Safety

- Use `unknown` at boundaries, not `any`
- Use discriminated unions, not enums
- Use `satisfies` for constraint checking, not `as`
- Use branded types for IDs: `type UserId = string & { __brand: 'UserId' }`

## Code Quality

- Enable `strict` mode
- No `@ts-ignore` - fix types or document exceptions
- Prefer `const` over `let`
- Use `===` not `==`

## Example

```typescript
// Good: Branded ID type
type UserId = string & { __brand: 'UserId' }

function getUser(id: UserId) {
  // Type-safe ID usage
}

// Good: Discriminated union
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```
