# Monorepo Project Example

Advanced example showing **dynamic code inclusion** and **provider-specific rendering**.

## What This Shows

1. **Code file inclusion** - Reference actual source code in rules
2. **Security guardrails** - Safe file access with sensible defaults
3. **Provider-specific modes** - Cursor gets references, Claude gets embeds
4. **Monorepo variable resolution** - `$package.name` resolves to nearest package.json
5. **Advanced wrapping** - Nested wrappers (code → XML → callout)

## Structure

```
.ruleset/
  config.yaml                    # Monorepo configuration
  rules/
    architecture.md              # Main rule with code examples
    _auth-example.md             # Partial with dynamic code
packages/
  frontend/
    package.json                 # { name: "@org/frontend" }
    src/auth.ts                  # Real code referenced in rules
  backend/
    package.json                 # { name: "@org/backend" }
    src/auth.ts                  # Real code referenced in rules
```

## Key Features

### 1. Dynamic Code Inclusion

```yaml
slots:
  auth-implementation:
    file: ../packages/frontend/src/auth.ts
    wrap: typescript  # Auto-wraps in ```typescript
```

### 2. Provider-Specific Rendering

```yaml
slots:
  "@_auth-example.md":
    cursor:
      mode: reference      # Cursor: `@file`
    claude:
      mode: embed          # Claude: inline content
      wrap: xmlTag.example
```

### 3. Package-Aware Variables

When compiling for `packages/frontend/.cursor/rules/`:
- `[[ $package.name ]]` → `@org/frontend`

When compiling for `packages/backend/.cursor/rules/`:
- `[[ $package.name ]]` → `@org/backend`

## Try It

```bash
bun run sandbox:setup monorepo-project

cd examples/sandbox/monorepo-project

# Compile (outputs to both packages)
rules compile

# Check frontend output
cat packages/frontend/.cursor/rules/architecture.mdc

# Check backend output
cat packages/backend/.cursor/rules/architecture.mdc

# Notice $package.name resolved differently!
```

## Security

Code inclusion respects:
- `.gitignore` - Won't include ignored files
- Deny patterns - Blocks `.env`, `*.key`, `secrets/**`
- Path restrictions - Can't escape project root
- Size limits - Max 500KB per file (configurable)

See `.ruleset/config.yaml` for security configuration.
