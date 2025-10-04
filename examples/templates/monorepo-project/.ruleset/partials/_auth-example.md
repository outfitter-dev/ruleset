---
slug: authentication_example
---

# Authentication Implementation

This package (`[[ $package.name ]]`) implements authentication using branded types for type safety.

## Key Patterns

### Branded Types

We use branded types to prevent ID/token mixups:

```typescript
type UserId = string & { __brand: 'UserId' }
type AuthToken = string & { __brand: 'AuthToken' }
```

### Result Types

All async operations return discriminated unions:

```typescript
type AuthResult =
  | { success: true; userId: UserId; token: AuthToken }
  | { success: false; error: string }
```

### Type Guards

Never use `as` - always validate at boundaries:

```typescript
// Bad
const userId = data.id as UserId

// Good
const userId: UserId = validateUserId(data.id)
  ? (data.id as UserId)
  : throwError('Invalid user ID')
```

## Live Example

See the actual implementation for this package below. This is **real code** from the repository, included dynamically:

[[ @../../packages/$PACKAGE_DIR/src/auth.ts ]]

> **Note:** The code above is from `[[ $this.file.path ]]` and will update automatically when the source file changes.
