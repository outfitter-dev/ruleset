---
slug: commit_conventions
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
