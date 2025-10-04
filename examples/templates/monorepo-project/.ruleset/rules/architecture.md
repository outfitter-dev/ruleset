---
ruleset:
  version: 0.4.0
---

# [[ $project.name ]] - [[ $package.name ]]

**Version:** [[ $project.version ]]
**Package:** [[ $package.name ]]
**License:** [[ $package.license ]]

[[ team-info ]]

---

## Architecture Guidelines

This package follows monorepo best practices:

1. **Type Safety First** - Branded types prevent cross-package type confusion
2. **Isolated Concerns** - Each package is independently buildable
3. **Shared Conventions** - Common rules enforced across all packages
4. **Package-Specific Rules** - Each package can override as needed

---

[[ auth-example ]]

---

## Package-Specific Notes

When working in `[[ $package.name ]]`:

- All types must be strict
- No cross-package imports without explicit exports
- Use workspace protocol for internal dependencies
- Run tests before committing: `bun test`

## Getting Help

- Check package README
- Ask in [[ $project.name ]] Slack channels
- Tag [[ $user.name ]] for architecture questions
