# Terminology Update Plan

This document outlines all terminology changes from the terminology consolidation effort and provides explicit instructions for updating documents across the repository.

## Outstanding Terminology Cleanup Items (post-scan)

The automated search performed after the first verification pass surfaced a handful of
left-over usages of the *old* terminology or syntax that still need manual attention.
Nothing below blocks the main rename effort, but each item should be resolved (or
explicitly accepted) before the terminology update is considered **fully** finished.

| Legacy Term / Pattern | Approx. Count | Representative Files & Lines |
|-----------------------|--------------|--------------------------------|
| **“Mix files / mix file”** | 2 | CHANGELOG.md:3  •  spec/ARCHITECTURE.md:281 |
| Stand-alone word **“mix”** (context-dependent) | 24 | notes/stem-heading.md (several), spec/OVERVIEW.md (examples like `my-mix.md`), spec/ARCHITECTURE.md, etc. |
| **“Track”** | 11 | notes/stem-heading.md:311 (`# TRACK NAME` example), docs/plugins/codex-cli/rules-use.md (progress tracking), many in spec/ARCHITECTURE.md ("track filtering") |
| **Snippet / _snippets** | 6 | spec/ARCHITECTURE.md:178 (JSON comment), docs/project/LANGUAGE.md (historic note), CHANGELOG.md |
| **“target platform”** | 1 | spec/ARCHITECTURE.md:385 |
| **“target-specific”** | 13 | spec/ARCHITECTURE.md (multiple) |
| Old directories `.mixdown/mixes/`, `.mixdown/output/` | 6 | docs/project/LANGUAGE.md, CHANGELOG.md |
| Deprecated import syntax `rules#[…]` | 5 | spec/OVERVIEW.md:736–799 |
| Deprecated property `code-block` | 1 (plus rule-name example) | spec/OVERVIEW.md:375–376 |
| Phrase **“tool-specific”** | 19 | README.md, docs/rules-overview.md, ai-rules-guide.md, etc. |
| **Capitalization of “Source Rules / Compiled Rules”** | many | Multiple docs (README, spec, CLAUDE.md, etc.) – should be lower-case except at sentence start |

### Action Items

1. **Inspect each occurrence** in the table above and decide whether it should be changed
   (most will) or kept (e.g., “progress tracking” is unrelated to stems and can stay).
2. **Update examples** that still demonstrate old syntax (`rules#[…]`, `code-block`) to the
   new `rules#(…)` and `code-*` / `code-lang` styles.
3. **Re-run a global search** after corrections to confirm zero false positives remain for
   the critical patterns listed above.

4. **Normalize Capitalization**  
   Convert “Source Rules” → “source rules” and “Compiled Rules” → “compiled rules” everywhere,
   except when the term appears at the beginning of a sentence or in a heading where
   Title Case is desired.  Ensure bullet labels (e.g., `**source rules**`) also use the
   new capitalization.

Once these items are cleared, we can confidently mark the terminology migration as **100 % complete**.

---

## Summary of Key Terminology Changes

| Category | Old Term(s) | New Term(s) | Status |
|----------|-------------|-------------|--------|
| **Source Content** | Mix files, Rule Definition | source rules | ✅ Decided |
| **Target Terminology** | Target, Target tool | Destination | ✅ Decided |
| **Output Terminology** | Output, Target-specific rules files | compiled rules | ✅ Decided |
| **Directory Structure** | `.mixdown/mixes/` | `.mixdown/src/` | ✅ Decided |
| **Directory Structure** | `.mixdown/mixes/_snippets/` | `.mixdown/src/_mixins/` | ✅ Decided |
| **Directory Structure** | `.mixdown/output/` | `.mixdown/dist/` | ✅ Decided |
| **Track Terminology** | Track, Track markers | Stem | ✅ Decided |
| **Configuration Terminology** | Option, Attribute | Property | ✅ Decided |
| **Property Format** | `property(value)` | `property-*` and `name-("value")` | ✅ Decided |
| **Reusable Components** | Snippet | Mixin | ✅ Decided |
| **Import Terminology** | Track filtering | Import scope | ✅ Decided |
| **Code Formatting** | code-js, code-block | code-lang | ✅ Decided |

## Directory Structure Changes

| New Path | Old Path | Notes |
|----------|----------|-------|
| `.mixdown/src/` | `.mixdown/mixes/` | Primary source directory |
| `.mixdown/src/_mixins/` | `.mixdown/mixes/_snippets/` | Reusable components directory |
| `.mixdown/dist/` | `.mixdown/output/` | Output directory |
| `.mixdown/dist/latest/` | `.mixdown/output/builds/` | Latest compiled rules |
| `.mixdown/dist/runs/` | n/a | Directory for all compilations |
| `.mixdown/dist/runs/run-<timestamp>/` | n/a | Directory for specific compiled rules |
| `.mixdown/dist/runs/run-<timestamp>.json` | n/a | Compilation metadata |
| `.mixdown/dist/logs/` | n/a | Log files directory |
| `.mixdown/dist/logs/run-<timestamp>.log` | n/a | Compilation log file |

## Detailed Terminology Changes

### 1. Source Content

#### Mix to source rules Transition

- **Old Terms**: "Mix files", "Source mix files", "Mix", "Source Markdown file", "Mixdown files", "Rule Definition"
- **New Term**: "source rules"
- **Reasoning**: "source rules" clearly communicates the source nature and creates a logical pair with "compiled rules."
- **Example**: "source rules are written in 100% previewable Markdown" (was "Mix files are written...")

#### source rules Implementation Guidelines

- Replace any instance of "mix file" or "mix files" with "source rules"
- In some contexts, "source rule" (singular) may be appropriate
- Use "source rules file" when referring to the actual file
- Update all references to "Rule Definition" to "source rules"

### 2. Target Terminology

#### Target to Destination Conversion

- **Old Terms**: "Target", "Tool", "Target provider", "Target platform", "Target tool"
- **New Term**: "Destination"
- **Reasoning**: Consolidate around "Destination" as the base term for all target-related concepts.
- **Example**: "Mixdown supports multiple destinations like Claude Code and Cursor" (was "...multiple target platforms...")

#### Destination Implementation Guidelines

- Replace "target tool" with "destination"
- Replace "target" with "destination" when referring to configuration
- Use "Destination Directory" for the specific directory where compiled rules are placed
- Use "Destination Path" for the file system location

### 3. Output Terminology

#### Output to compiled rules Refactoring

- **Old Terms**: "Tool-specific rules files", "Target-specific rules files", "Per-tool rules files", "Compiled rules files", "Target rules", "Output"
- **New Terms**:
  - "Compilation Artifacts" - intermediary files generated during compilation
  - "compiled rules" - final rules files that result from compilation
- **Reasoning**: Creates a clear process flow: source rules → Compilation → Compilation Artifacts → compiled rules
- **Example**: "Source rules are transformed into compiled rules for each destination" (was "...into target-specific rules files")

#### compiled rules Implementation Guidelines

- Replace "Output" with "compiled rules" when referring to final output files
- Use "Compilation Artifacts" for intermediate files
- Update references to "Tool-ready rules" to use "compiled rules" terminology

### 4. Process Terminology

#### Standardizing on Compile Terminology

- **Old Terms**: "Generate", "Transform", "Process", "Render", "Convert", "Build"
- **New Term**: "Compile"
- **Reasoning**: "Compile" best represents the transformation process and aligns with standard programming terminology.
- **Example**: "Mixdown compiles source rules into compiled rules" (was "...transforms mix files into target-specific rules files")

#### Compilation Process Implementation Guidelines

- Use "Compile" as the standard verb for the transformation process everywhere
- Use "Compiler" when referring to the component itself
- Use "Rules compiler" when referring to what Mixdown is

### 5. Track Terminology

#### Track to Stem Renaming

- **Old Terms**: "Track", "Track markers", "Track notation markers", "Delimited content blocks", "Content blocks", "Section"
- **New Term**: "Stem"
- **Reasoning**: Better reflects the concept of a track as a single, distinct unit of content and maintains the music production theme.
- **Example**: "The instructions stem contains guidance for AI assistants." (was "The instructions track...")

#### Stem Terminology Implementation Guidelines

- Replace all instances of "track" with "stem"
- Use "Stem content" for the content between opening and closing markers
- Use "Stem name" for the kebab-case or snake_case identifier

### 6. Configuration Terminology

#### Option to Property Standardization

- **Old Terms**: "Option", "Attribute", "Option family", "Option parameter", "Option value", "Option pattern", "Option overrides", "Modifier"
- **New Terms**:
  - "Property" or "prop" (short form)
  - "Property's value" or "val" (short form)
  - "Property scope" or "Scoped property"
  - "Property modifier" or "prop-mod"
- **Reasoning**: More consistent with programming terminology and clearer distinction between different aspects.
- **Example**: "Stems can be configured with various properties" (was "...with various options")

#### Property System Implementation Guidelines

- Replace "option" with "property" universally
- Use "Property Family" for the prefix before hyphen (e.g., `code-`)
- Use "Property Value" for what's in parentheses (e.g., `js` in `code-(js)`)
- Use "Property Group" for collections of related properties

#### New Property Format Syntax

- **Old Format**: `property(value)` (e.g., `code(js)`, `name("value")`)
- **New Formats**:
  - `property-*` (e.g., `code-javascript`) - for simple values directly following the hyphen
  - `name-("value")` - for quoted string values
- **Reasoning**: Using a hyphen as a delimiter improves readability and follows common conventions in programming. Parentheses with quotes are only used for string values.
- **Examples**:
  - `{{instructions code-javascript}}` (was `{{instructions code(js)}}`)
  - `{{stem name-("My Stem")}}` (was `{{stem name("My Stem")}}`)

#### Property Format Guidelines

- Update all property syntax examples to use the hyphen format
- For simple values (like language identifiers), use the direct format `property-value`
- For string values that need quotes, use `property-("quoted value")`
- Arrays continue to use square brackets: `property-[item1, item2]`

#### Updated Import Selection Syntax

- **Old Format**: `{{> rules#[stem-1 stem-2]}}` (using square brackets)
- **New Format**: `{{> rules#(stem-1 !stem-2)}}` (using parentheses)
- **Reasoning**: This allows for more complex expressions including destination-scoped stems
- **Examples**:
  - `{{> rules#(stem-1 !stem-2)}}` - Include stem-1, exclude stem-2
  - `{{> rules#(stem-1 cursor:[stem-cursor])}}` - Include stem-1 and stem-cursor (only for cursor destination)
  
#### Special Notes on Syntax Patterns

- Parentheses `()` are used for grouping and selection (e.g., in import scope)
- Square brackets `[]` are used for arrays and lists (e.g., in properties)
- Hyphens `-` are used as delimiters between property names and values
- Quoted string values in properties use the format: `property-("quoted value")`

#### Import Syntax Implementation Guidelines

- Update all import stem selection syntax to use parentheses instead of square brackets
- Use `!` prefix to indicate exclusion of a stem
- Destination-scoped stem selections should follow the format: `destination:[stem-name]`

### 7. Import Terminology

#### Unified Import Terminology Framework

- **Old Terms**: "Import", "Inclusion", "Embed content", "References", "Import reference", "Import attributes", "Track filtering"
- **New Terms**:
  - "Import" (primary term)
  - "Import parameters" (replaces "Import attributes/options")
  - "Import scope" (replaces "Track filtering")
- **Reasoning**: "Import" clearly communicates the action of bringing in external content.
- **Example**: "Import scope allows you to selectively import only specific stems from a source rule" (was "Track filtering allows...")

#### Import System Implementation Guidelines

- Use "Import" consistently for the import mechanism
- Replace "Import attributes/options" with "Import parameters"
- Replace "Track filtering" with "Import scope"

### 8. Reusable Components

#### Snippet to Mixin Transition

- **Old Terms**: "Snippet", "Reusable component", "Partial", "Include", "Fragment"
- **New Term**: "Mixin"
- **Reasoning**: In programming, mixins are reusable pieces of code that can be incorporated into different classes or components.
- **Example**: "Import authentication mixins to add user authentication to your Source Rules" (was "...authentication snippets...")

#### Mixin Implementation Guidelines

- Replace all instances of "snippet" with "mixin"
- Update directory name from `.mixdown/mixes/_snippets/` to `.mixdown/src/_mixins/`
- Use consistent terminology when discussing importing mixins

### 9. Code Formatting Terminology

#### Unified Code Property System

- **Old Terms**: "code-*", "code-js", "code-python", "code-block"
- **New Terms**: "code-lang", "code" (for auto-language)
- **Reasoning**: Simplifies and standardizes the terminology for code properties.
- **Example**: "Use code-lang when specifying language for code formatting" (was "Use code-js, code-python...")

#### Code Property Implementation Guidelines

- Use "code-lang" as the generic term when discussing the property
- Simply use "code" for the auto-language notation
- Do not use "code-block"

## Files to Update

### Core Documentation Files

1. **README.md**
   - Update "Mix" to "Source Rules" in the introductory paragraph
   - Update "Track" to "Stem" in Core Concepts
   - Update "Snippet" to "Mixin" in Core Concepts
   - Update directory references to use `.mixdown/src/` and `.mixdown/dist/`
   - Update the directory structure example

2. **spec/OVERVIEW.md**
   - Update all terminology according to the changes above
   - Ensure consistent use of "Source Rules", "Destination", "Stem", etc.
   - Update directory references to use `.mixdown/src/` and `.mixdown/dist/`

3. **docs/project/LANGUAGE.md**
   - Comprehensive update of all terminology
   - Update directory structure examples
   - Update compilation flow descriptions

### Secondary Documentation Sources

1. **docs/project/index.md**
   - Update all instances of "mix" to "Source Rules"
   - Update "target" to "destination"
   - Update directory references

2. **docs/rules-overview.md**
   - Update all terminology consistently

3. **docs/plugins/*/rules-use.md**
   - Update "target" to "destination" in all target-specific documentation
   - Update "mix" to "Source Rules" throughout
   - Update "track" to "stem" in all examples

4. **notes/\*.md** (except .archive)
   - Update all relevant terminology in note files
   - Pay special attention to `mixdown-compiler-patterns.md` and `ai-rules-guide.md`

## Special Cases and Exceptions

### Source Code Considerations

1. **Variable and Function Names**
   - If updating code, ensure variable names are updated consistently (e.g., `mixFile` to `sourceRulesFile`)
   - Update function names that reference old terminology

### Backward Compatibility Approach

2. **Backward Compatibility**
   - In API documentation, note both old and new terminology during transition period
   - Consider adding deprecation warnings for old terminology in code

### Brand Identity Guidelines

3. **Brand References**
   - When referring to the product name "Mixdown" itself, keep as is (do not change to "Source Rules Compiler")
   - The musical term "mixdown" in explanations of the name should remain

## Implementation Plan

### Phased Implementation Strategy

1. Start with updating docs/project/LANGUAGE.md completely as the canonical terminology reference
2. Update README.md as the most visible entry point
3. Update other spec files
4. Update documentation in docs/
5. Update notes/
6. Add entry to CHANGELOG.md about terminology updates

## Verification Process

### Post-Update Verification Checklist

After updating, search for old terminology to ensure all instances have been replaced:

1. Search for "mix file", "mix", "track", "snippet", etc.
2. Search for old directory references: `.mixdown/mixes/`, `.mixdown/output/`
3. Review documentation for consistency in terminology use
4. Ensure examples use the new terminology

## Changelog

```md
### Changed
- Updated terminology throughout the documentation:
  - "Mix files" → "Source Rules"
  - "Target" → "Destination"
  - "Output" → "Compiled Rules"
  - "Track" → "Stem"
  - "Option" → "Property"
  - "Snippet" → "Mixin"
  - `property(value)` → `property-*` and `name-("value")`
- Updated directory structure:
  - `.mixdown/mixes/` → `.mixdown/src/`
  - `.mixdown/mixes/_snippets/` → `.mixdown/src/_mixins/`
  - `.mixdown/output/` → `.mixdown/dist/`
```
