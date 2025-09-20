# Mixdown Terminology Update Guide

This document outlines all terminology changes from the terminology consolidation effort and provides specific instructions for updating documents throughout the repository. Following these updates will ensure consistency across all Mixdown documentation, code, and community communication.

## Terminology Changes Summary

The table below shows the primary terminology changes that need to be implemented across the codebase:

| Old Term | New Term | Description |
|----------|----------|-------------|
| **Mix**, Mix file, Source mix, etc. | **Source Rules** | Files defining instructions for AI assistants |
| **Track** | **Stem** | Delimited content blocks with opening and closing markers |
| **Snippet** | **Mixin** | Reusable components imported into source rules |
| **Target**, Target tool, etc. | **Destination** | AI assistant platform (e.g., Cursor, Claude Code) |
| **Output**, Tool-specific rules, etc. | **Compiled Rules** | Rules files generated from source rules |
| **Option** | **Property** | Configuration applied to stems or imports |
| **Notation Marker**, Marker notation | **Marker** (or **Mixdown Marker**) | Element using `{{...}}` notation |
| **Track filtering** | **Import scope** | Filtering stems during import using `{{> file#(stem-a !stem-b)}}` |
| **.mixdown/mixes/** | **.mixdown/src/** | Directory for source rules files |
| **.mixdown/mixes/_snippets/** | **.mixdown/src/_mixins/** | Directory for reusable components |
| **.mixdown/output/** | **.mixdown/dist/** | Directory for compiled rules and artifacts |

## Directory Structure Changes

```text
# OLD
project/
├── .mixdown/
│   ├── output/
│   │   └── builds/         # compiled output
│   ├── mixes/              # Mix files (*.md)
│   │   └── _snippets/      # reusable content modules
│   └── mixdown.config.json # Mixdown config file

# NEW
project/
├── .mixdown/
│   ├── dist/
│   │   ├── latest/         # Symlink to the latest compilation
│   │   ├── runs/           # Directory for all compilations and their artifacts
│   │   │   └── run-<timestamp>/  # Directory containing specific compiled rules
│   │   └── logs/           # Log files for all compilations
│   ├── src/                # Source Rules files (*.mix.md, *.md)
│   │   └── _mixins/        # reusable components
│   └── mixdown.config.json # Mixdown config file
```

## Terminology Category Details

### Source Content

- **Old**: "Source rules files", "Source mix files", "Mix files", "Source Markdown file", "Mixdown files", "Rule Definition", "Mix"
- **New**: "Source Rules" (primary term)
- **Reasoning**: Creates a clean, logical pair with "Compiled Rules" and clearly communicates the source nature

### Target Terminology

- **Old**: "Target", "Tool", "Target provider", "Target platform", "Target tool"
- **New**: "Destination" (base term for all things target-related)
- **Reasoning**: Creates clearer distinction between the tool itself and its configuration

### Output Terminology

- **Old**: "Tool-specific rules files", "Target-specific rules files", "Per-tool rules files", "Compiled rules files", "Target rules", "Output"
- **New**: "Compiled Rules" (for final rules files), "Compilation Artifacts" (for intermediary files)
- **Reasoning**: Creates a clear process flow: Source Rules → Compilation → Compilation Artifacts → Compiled Rules

### Tool-Ready Rules

- **Old**: "Tool-ready rules", "Tool-ready output", "Deployed rules", "Tool-installed rules" 
- **New**: See "Compiled Rules" terminology
- **Reasoning**: Consolidated with "Compiled Rules" terminology

### Directory References

- **Old**: ".mixdown/output/builds/", "Output location", "Output path", ".mixdown/output/", ".mixdown/outputs/"
- **New**: ".mixdown/dist/" directory
- **Reasoning**: Better alignment with standard software development conventions

### Process Terminology

- **Old**: "Generate", "Transform", "Process", "Compile", "Render", "Convert", "Build"
- **New**: "Compile" (standard verb for the transformation process)
- **Reasoning**: Best represents the transformation process and aligns with standard programming terminology

### Compiler 

- **Old**: "Rules compiler", "Prompt compiler", "Compiler", "Mixdown compiler", "Rules processor"
- **New**: "Compiler" (for component itself), "Rules compiler" (for the process)
- **Reasoning**: "Compiler" is more concise when referring to the component

### Notation Markers

- **Old**: "Notation Marker", "Marker notation", "Mixdown Notation", "Mixdown directive"
- **New**: "Mixdown Notation" (for overall syntax system), "Marker" or "Mixdown Marker" (for individual elements)
- **Reasoning**: More precise distinction between the overall system and individual elements

### Tracks

- **Old**: "Track", "Track markers", "Track notation markers", "Delimited content blocks", "Content blocks", "Section"
- **New**: "Stem" (for the full construct), "Stem content" (for content between markers), "Stem name" (for the identifier)
- **Reasoning**: Better reflects the concept as a distinct unit of content and maintains the music production theme

### Configuration Options

- **Old**: "Option", "Attribute", "Option family", "Option parameter", "Option value", "Option pattern", "Option overrides", "Modifier"
- **New**: "Property" or "prop" (primary term), "Property scope", "Property modifier", "Scoped value"
- **Reasoning**: Better reflects the configurable nature of these parameters

#### Property Format

- **Old Format**: `property(value)` (e.g., `code(js)`, `name("value")`)
- **New Formats**:
  - `property-*` (e.g., `code-js`) - for simple values directly following the hyphen
  - `name-("value")` - for quoted string values
- **Examples**:
  - `{{instructions code-js}}` (was `{{instructions code(js)}}`)
  - `{{stem name-("My Stem")}}` (was `{{stem name("My Stem")}}`)
- **Arrays**: Continue to use square brackets: `property-[item1, item2]`

### Imports

- **Old**: "Import", "Inclusion", "Embed content", "References", "Import reference", "Import attributes", "Track filtering"
- **New**: "Import" (primary term), "Import parameters", "Import scope"
- **Reasoning**: Clearer terminology for the import mechanism and its components

### Variables

- **Old**: "Variable", "Dynamic values", "Alias", "System variable", "Variable substitution"
- **New**: "Variable" (primary term), "System variable" (for built-ins), "Variable substitution" (for the process)
- **Reasoning**: Standard programming terminology that clearly describes the replacement process

### XML Generation

- **Old**: "Converted to XML tags", "Transformed into XML structure", "Outputs XML notation", "Renders as XML"
- **New**: "Converted to XML tags", "Translated to XML"
- **Reasoning**: Technically accurate and avoids myopic view of XML as the only output format

### Raw Notation

- **Old**: "Triple-brace", "Raw Mixdown Notation", "Triple curly braces"
- **New**: "Raw notation" (primary term), "Triple-brace" or "escaping" (for the syntax)
- **Reasoning**: Describes the purpose rather than just the syntax

### Code Options

- **Old**: "code-*", "code-js", "code-py", "code-block"
- **New**: "code-lang" (generic reference), "code" (auto-language)
- **Reasoning**: More consistent pattern for language-specific code blocks

### Mixin

- **Old**: "Snippet", "Reusable component", "Partial", "Include", "Fragment"
- **New**: "Mixin" (primary term)
- **Reasoning**: In programming, mixins are reusable pieces of code that can be incorporated into different components

## Files to Update

### Core Documentation Files

1. **README.md**
   - Update "Core Concepts" section with new terminology
   - Replace "Mix", "Track", "Snippet", "Target", "Output" in all descriptions
   - Update directory structure diagram
   - Update notation cheatsheet with new terms

2. **spec/OVERVIEW.md**
   - Update "Core Concepts" section completely
   - Replace all instances of old terminology throughout the document
   - Update all examples to use new terminology
   - Update directory structure diagram
   - Update all headings that reference old terminology (e.g., "Tracks" → "Stems")

3. **spec/LANGUAGE.md**
   - Already updated with new terminology
   - Use as reference for updating other files

### Documentation Directory

4. **docs/index.md**
   - Update introduction and overview sections with new terminology
   - Update any diagrams or illustrations 

5. **docs/rules-overview.md**
   - Complete revision to use new terminology throughout
   - Update all examples to use new terms

6. **docs/targets/** (all subdirectories)
   - Update all target-specific documentation to use "Destination" terminology
   - Review tool-specific references and update accordingly

### Notes Directory

7. **notes/ai-rules-guide.md**
   - Update terminology throughout
   - Pay special attention to conceptual explanations that use old terms

8. **notes/mixdown-compiler-patterns.md**
   - Update to reference new directory structure
   - Update all process terminology to use "Compile/Compilation"

9. **notes/prompt-rules-use.md**
   - Update with new "Source Rules" and "Stem" terminology
   - Review examples and update accordingly

10. **notes/track-heading.md**
    - Rename file to **notes/stem-heading.md**
    - Update content to use "Stem" terminology

### Code Comments and Variable Names

11. **All source code files**
    - Update variable names and comments to use new terminology
    - Review class and method names for consistency

## Special Cases and Exceptions

1. **Musical Theme Alignment**
   - When introducing new terms, explain their connection to music production terminology
   - Emphasize the connection between "Source Rules" → "Compilation" → "Compiled Rules" and audio production workflow

2. **XML Output References**
   - Replace "Outputs XML notation" with more accurate "Compiled as XML notation"
   - Acknowledge that XML is just one potential output format

3. **Historical References**
   - When referencing past versions or documentation, note the terminology change
   - Example: "Previously called 'Mix files', now known as 'Source Rules'"

4. **Code Examples**
   - Update all code examples to use new terminology in comments and explanations
   - Keep code implementation consistent with new terminology

## Importance of Consistency

Consistent terminology is critical for:

1. **User Experience**: Reducing cognitive load when learning and using Mixdown
2. **Documentation Quality**: Ensuring clear, unambiguous documentation
3. **Community Communication**: Enabling precise communication about Mixdown features and concepts
4. **Codebase Maintenance**: Making the codebase more maintainable with consistent naming

## Implementation Plan

1. **Phase 1**: Update core specification files (OVERVIEW.md, README.md)
2. **Phase 2**: Update all documentation files in docs/ directory
3. **Phase 3**: Update notes/ directory files
4. **Phase 4**: Update code comments and variable names
5. **Phase 5**: Update directory structure in the codebase
6. **Phase 6**: Final review and consistency check

## Verification Process

After updates are complete, perform these checks:

1. Search for old terminology across the codebase using grep/search tools
2. Review each document for missed occurrences
3. Verify directory structure changes are properly documented
4. Ensure examples use new terminology exclusively
5. Check for mixed terminology in any single document

---

This guide serves as a comprehensive reference for updating terminology across the Mixdown codebase. Following these guidelines will ensure consistency and clarity in all Mixdown documentation and code.