# Before: Traditional Approach

This shows how developers typically write rules today - with lots of duplication across providers.

## The Problem

You need to maintain **separate files** for each tool:

```
.cursor/
  rules.mdc              # Cursor-specific rules (200 lines)

.windsurf/
  rules.md               # Windsurf-specific rules (200 lines, 90% same)

CLAUDE.md                # Claude-specific rules (200 lines, 90% same)
```

**Total:** 600+ lines with massive duplication.

---

## Example: .cursor/rules.mdc (Traditional)

```markdown
# Simple Project Development Guidelines

**Version:** 1.0.0

**Team:** Engineering
**Contact:** eng-team@example.com
**On-call:** Use PagerDuty rotation

---

<typescript_conventions>

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

</typescript_conventions>

---

<commit_conventions>

# Commit Conventions

## Format

Use Conventional Commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Formatting (no code change)
- `refactor:` - Code restructure (no behavior change)
- `test:` - Adding/updating tests
- `chore:` - Maintenance tasks

## Examples

```bash
git commit -m "feat(auth): add JWT token validation"
git commit -m "fix(api): resolve timeout in user endpoint"
git commit -m "docs: update API documentation"
```

## Rules

- Keep subject line under 72 characters
- Use lowercase for type and scope
- Use imperative mood: "add" not "added"
- Reference issues: `fixes #123`

</commit_conventions>

---

## Getting Help

- Check project documentation
- Ask in team Slack channel
- Tag Matt Galligan for urgent issues
```

---

## Example: CLAUDE.md (Traditional)

```markdown
# Simple Project Development Guidelines

**Version:** 1.0.0

**Team:** Engineering
**Contact:** eng-team@example.com
**On-call:** Use PagerDuty rotation

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

---

# Commit Conventions

## Format

Use Conventional Commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Formatting (no code change)
- `refactor:` - Code restructure (no behavior change)
- `test:` - Adding/updating tests
- `chore:` - Maintenance tasks

## Examples

```bash
git commit -m "feat(auth): add JWT token validation"
git commit -m "fix(api): resolve timeout in user endpoint"
git commit -m "docs: update API documentation"
```

## Rules

- Keep subject line under 72 characters
- Use lowercase for type and scope
- Use imperative mood: "add" not "added"
- Reference issues: `fixes #123`

---

## Getting Help

- Check project documentation
- Ask in team Slack channel
- Tag Matt Galligan for urgent issues
```

---

## Example: .windsurf/rules.md (Traditional)

Same content again, with minor differences:
- No XML tags (Windsurf doesn't use them)
- Slightly different formatting

**Total duplication: ~90%**

---

## The Pain Points

1. **Duplication** - Same content copy-pasted 3+ times
2. **Maintenance nightmare** - Change TypeScript rules? Update 3 files
3. **Drift** - Files get out of sync (someone forgets one)
4. **Verbose** - 600+ lines for what should be 100
5. **Manual work** - No automation, all copy-paste
6. **Hard to update** - Change team contact? Grep and replace everywhere
7. **Version skew** - "Why does Cursor have v1.0 but Claude has v0.9?"

---

## What We Want Instead

- **Write once** - Single source of truth
- **Compile everywhere** - Automatic provider-specific outputs
- **Variables** - `[[ $project.version ]]` updates everywhere
- **Composable** - Small, focused files
- **Maintainable** - Change once, propagate everywhere
- **DRY** - Zero duplication

See `.ruleset/rules/conventions.md` for the **after** version using slots!
