# Roo Code Rules System

Roo Code organizes rules by AI mode in specific directories to target certain AI behaviors, creating a mode-specific approach to rule management.

## Key Features

- **Mode-Specific Rules:** Different rules for different operational modes
- **Common Rules:** Shared rules for all modes
- **Folder Structure:** One folder per mode plus common rules
- **Clear Organization:** Rules are grouped by their intended AI behavior
- **Hierarchical Loading:** Common rules plus mode-specific rules

## Canonical Locations & Structure

Roo Code uses a directory-based structure with specific locations for different types of rules:

```text
<repo-root>/.roo/rules/                   # Common rules (all modes)
<repo-root>/.roo/rules-{mode}/            # Mode-specific rules
```

Unlike many other tools, Roo Code does not have a built-in global rules file for personal preferences.

## Directory Structure Example

```text
project/
├── .roo/
│   ├── rules/                    # Common rules for all modes
│   │   ├── coding-style.md        # Applied regardless of mode
│   │   └── terminology.md         # Project glossary and terms
│   ├── rules-architect/          # For Architect mode only
│   │   └── architecture.md       # System design principles
│   ├── rules-debug/              # For Debug mode only
│   │   └── debugging.md          # Debugging procedures
│   └── rules-docs-writer/        # For Documentation mode only
│       └── doc-standards.md       # Documentation guidelines
└── ...
```

## Mode-Specific Rules

Roo Code's distinctive feature is its mode-specific rules folders:

1. **Common Rules** (`/rules/`): Applied regardless of which mode is active

   - Project overview and terminology
   - General coding standards
   - Team practices and workflows

2. **Architect Mode Rules** (`/rules-architect/`): For high-level design tasks

   - System architecture principles
   - Design patterns
   - Component interaction guidelines

3. **Debug Mode Rules** (`/rules-debug/`): For finding and fixing issues

   - Common bugs and solutions
   - Testing approaches
   - Debugging workflows

4. **Documentation Mode Rules** (`/rules-docs-writer/`): For documentation tasks

   - Documentation standards
   - API description formats
   - Comment style guidelines

5. Additional custom modes can be created based on project needs

## Loading Behavior

```mermaid
flowchart TD
    A[Start Roo Code session] --> B[Select AI mode]
    B --> C[Load all files from .roo/rules/]
    C --> D{Selected specific mode?}
    D -->|Yes| E[Load files from .roo/rules-{mode}/]
    D -->|No| F[Skip mode-specific rules]
    E --> G[Merge common + mode-specific rules]
    F --> G
    G --> H[Configure AI with merged context]
```

## Content Organization

Roo Code rule files typically organize content with clear headings and structured sections:

```markdown
# Debugging Guidelines

## Common Error Patterns

- Description of error pattern 1 and how to fix
- Description of error pattern 2 and how to fix

## Debugging Process

1. Step 1 of the debugging process
2. Step 2 of the debugging process
3. Step 3 of the debugging process

## Testing Recommendations

- Unit test guidelines
- Integration test guidelines
```

## Best Practices for Roo Code Rules

- **Keep common rules truly common**: Only put universally applicable content in the common rules folder
- **Align mode-specific rules with mode purpose**: Tailor content to the specific AI behavior in each mode
- **Use consistent formatting across rules**: Maintain the same structure for easier comprehension
- **Consider rule loading order**: Name files with numeric prefixes if order matters
- **Create custom modes for specialized tasks**: Can create new mode folders for specific workflows
- **Use clear filenames**: Make it obvious what's in each rule file
- **Regular maintenance**: Remove outdated rules and update content as the project evolves

## Version Information

| Aspect                | Details                        |
| --------------------- | ------------------------------ |
| Last-verified release | v1.0.0 (May 2025)              |
| Primary docs          | Roo Code documentation website |
| Rules specification   | Updated in v1.0 (May 2025)     |
