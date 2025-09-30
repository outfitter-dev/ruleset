---
rulesets:
  version: 0.4.0
description: Basic coding standards for TypeScript projects
---

# Coding Standards

## TypeScript Conventions

- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use `const` for immutable values, `let` for mutable
- Follow functional programming patterns where appropriate

## Code Style

- Use 2 spaces for indentation
- Use double quotes for strings
- Add trailing commas in multi-line objects and arrays
- Maximum line length: 100 characters

## Naming Conventions

- **Variables/Functions**: camelCase
- **Classes/Interfaces**: PascalCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Files**: kebab-case

## Testing

- Write tests for all public APIs
- Aim for >80% code coverage
- Use descriptive test names that explain the behavior

## Documentation

- Add JSDoc comments for public functions
- Keep README.md up to date
- Document breaking changes in CHANGELOG.md