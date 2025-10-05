# Simple Project Example

Demonstrates the **slots & variables** system with a minimal, real-world setup.

## What This Shows

- **Before:** Traditional approach (verbose, repetitive)
- **After:** Slots approach (DRY, simple, maintainable)

## Structure

```
.ruleset/
  config.yaml              # Project configuration with slots
  rules/
    conventions.md         # Main rule using slots & variables
    _typescript.md         # Partial: TypeScript rules
    _commits.md            # Partial: Commit conventions
    _team-contact.md       # Partial: Team info
```

## Key Features Demonstrated

1. **Direct variable usage** - `[[ $project.name ]]` without pre-declaration
2. **File composition** - `[[ @_typescript.md ]]` for DRY partials
3. **Smart wrapping** - XML tags, code blocks automatically applied
4. **Provider-specific** - Same source, different outputs per tool
5. **Maintainability** - Change once, compile everywhere

## Try It

```bash
# Create sandbox
bun run sandbox:setup simple-project

cd examples/sandbox/simple-project

# Build for all providers
rules build

# Check outputs
ls -la .cursor/rules/
cat AGENTS.md
```

## Compare Before/After

See `BEFORE.md` for the traditional approach (what users write today).
See the `.ruleset/rules/` files for the slots approach (what they could write).

The difference:
- **Before:** 300+ lines, lots of duplication
- **After:** ~100 lines, zero duplication, easier to maintain
