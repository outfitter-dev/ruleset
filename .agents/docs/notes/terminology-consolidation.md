# Terminology Consolidation

**Goal:** Consolidate the terminology used across the Rulesets project to ensure consistency and clarity.

## Source Content

### Source Rules

- **Description:** The source files that define rules for AI assistants
- **Current:** "Source rules files", "Source mix files", "Mix files", "Source Markdown file", "Rulesets files", "Rule Definition"
- **Recommendation:** Standardize on a clear term that emphasizes the source aspect and creates a clean pairing with the output.
- **Decision:** We should use **Source Rules** as the primary term for source files that define AI assistant rules.
- **Proposed:**
  1. ✴️ "Source Rules" ← "Mix files", "Rule Definition", "Source mix files"
     - Reasoning: "Source Rules" clearly communicates the source nature and creates a logical pair with "Compiled Rules."
     - Example: "Source Rules are written in 100% previewable Markdown"
  2. "Rules Source" ← "Source rules files", "Rulesets files"
     - Reasoning: Emphasizes the source nature of these files.
     - Example: "Rules Source files contain the instructions that will be compiled"
  3. "Rulesets Definition" ← "Mix files", "Rulesets files"
     - Reasoning: Maintains brand identity while clarifying purpose.
     - Example: "Create Rulesets Definitions that compile to multiple destinations"
- **Decision:**
  - We should use **Source Rules** as the primary term for all documentation and code comments.
  - We should rename the `.rulesets/mixes` directory to `.rulesets/src/` to align with standard software development conventions.
  - This creates a clean, intuitive flow: Source Rules → Compilation → Compiled Rules.

## Target Terminology

### Destination

- **Description:** The AI assistant platform and its configuration context
- **Decision:** Use **Destination** for both the platform and configuration. Avoid "Target"/"Target tool" in new documentation.
- **Guidance:**
  - Use **Destination directory** for filesystem locations that store compiled rules (for example, `.cursor/rules`, `.claude/commands`).
  - Use **Destination path** when referring to the fully qualified path for a compiled artifact written by the compiler.

## Output Terminology

### Rules Files

- **Description:** The generated artifacts from compilation
- **Current:** "Tool-specific rules files", "Target-specific rules files", "Per-tool rules files", "Compiled rules files", "Target rules", "Output"
- **Recommendation**: Standardize on one term for consistency.
- **Decision:** Use "Target-specific rules files" as the primary term for all documentation and code comments.
- **Proposed:
  1. ✴️ "Target-specific rules files" ← "Tool-specific rules files", "Target-specific rules files", "Per-tool rules files", "Output"
     - Reasoning: "Target-specific" directly ties the rules files to their intended target and maintains consistency with other target-related terminology.
     - Example: "Rulesets compiles mix files into target-specific rules files"
  2. "Destination rules files" ← "Per-tool rules files", "Compiled rules files"
     - Reasoning: Emphasizes the destination aspect and creates a clear symmetry with "Source Rules".
     - Example: "The compiler produces compiled rules files for each destination"
  3. "Target rules" ← "Tool-specific rules files", "Target-specific rules files" (for brevity in appropriate contexts)
     - Reasoning: A simplified version that maintains the essential meaning while being more concise.
     - Example: "Each target rules file is placed in its appropriate tool directory"
- **Decision:**
  - "Compilation Artifacts" ← "Generated files", "Build artifacts"
    - Refers to the intermediary files generated during the compilation process.
    - Example sentence: "The compiler generates compilation artifacts during the build process."
  - "Compiled Rules" ← "Target-specific rules" / "Tool-specific rules" / "Per-tool rules" / "Destination Rules"
    - Refers to the final rules files that result from the compilation process.
    - Example sentence: "Source rules are transformed into compiled rules for each destination."
  - This creates a clear process flow: Source Rules → Compilation → Compilation Artifacts → Compiled Rules.

### Tool-Ready Rules

- **Description:** Files placed in their respective tool directories
- **Current:** "Tool-ready rules", "Tool-ready output", "Deployed rules", "Tool-installed rules"
- **Recommendation**: Use consistent rules terminology.
- **Decision:** Standardize on "Tool-ready rules" for all documentation and code comments.
- **Proposed:
  1. ✴️ "Tool-ready rules" ← "Tool-ready rules", "Tool-ready output"
     - Reasoning: This term clearly conveys that the rules are ready for use by their target tool and maintains consistency with our "rules" terminology.
     - Example: "When placed in their target tool directories, these are referred to as tool-ready rules"
  2. "Deployed rules" ← "Tool-ready output"
     - Reasoning: Emphasizes the deployment aspect of placing rules in their final destination.
     - Example: "The deployed rules are ready for the target tool to use"
  3. "Tool-installed rules" ← "Tool-ready rules", "Tool-ready output"
     - Reasoning: Clearly indicates that these rules have been placed in their tool-specific locations.
     - Example: "Tool-installed rules are automatically recognized by their respective target tools"
- **Decision:**
  - Refer to [rules files](#rules-files) for more information.

## Directory References

### Output Directory

- **Description:** The directory where compiled files are stored
- **Current:** ".rulesets/output/builds/", "Output location", "Output path", ".rulesets/output/", ".rulesets/outputs/" (outdated)
- **Recommendation**: Consolidate language around specific use cases.
- **Decision:** Use ".rulesets/output/ directory" when referring to the specific path and "Output directory" when referring to it generically.
- **Proposed:
  1. ✴️ ".rulesets/output/ directory" ← ".rulesets/output/builds/", ".rulesets/outputs/"
     - Reasoning: Using the full path with directory suffix provides clarity and precision when referring to the output location.
     - Example: "Writes compiled rules files to the .rulesets/dist/ directory"
  2. ✴️ "Output directory" ← "Output location", "Output path"
     - Reasoning: A simpler alternative for contexts where the full path isn't necessary.
     - Example: "The output directory contains all target-specific rules files"
- **Decision:**
  - `.rulesets/dist` is better aligned with standard software development conventions and should be used.
  - We should call the specific contents of the dist directory `compilation artifacts`.
    - A compilation is a single run of the compiler.
  - We should therefore have:
    - `.rulesets/dist/latest/` ← Symlink to the latest compilation
    - `.rulesets/dist/runs/` ← Directory for all compilations and their artifacts
    - `.rulesets/dist/runs/run-<timestamp>.json` ← Compilation metadata for each run
    - `.rulesets/dist/logs/` ← Log files for all compilations
    - `.rulesets/dist/logs/run-<timestamp>.log` ← Compilation log for each run

## Process Terminology

### Compile

- **Description:** The process of transforming mix files into target-specific rules files
- **Current:** "Generate", "Transform", "Process", "Compile", "Render", "Convert", "Build"
- **Recommendation**: Use a single term for the transformation process.
- **Decision:** Use "Compile" as the standard verb for the transformation process in all documentation and code comments.
- **Proposed:
  1. ✴️ "Compile" ← "Generate", "Transform", "Process", "Build", "Convert"
     - Reasoning: "Compile" best represents the transformation process and aligns with standard programming terminology for converting source code to output formats.
     - Example: "Rulesets compiles mix files into target-specific rules files"
  2. "Render" ← "Generate", "Transform" (alternative for UI/visual contexts)
     - Reasoning: In some contexts, especially when discussing the visual representation aspect, "render" may be more intuitive.
     - Example: "Rulesets renders mix files into their appropriate target formats"
  3. "Build" ← "Generate", "Process" (alternative for build-system contexts)
     - Reasoning: When discussing the build pipeline or integration with other build systems, "build" provides familiar terminology.
     - Example: "The build process automatically builds all mix files into their target formats"
- **Decision:**
  - Compile is the best. Let's use it everywhere.

### Compiler

- **Description:** The tool that performs compilation
- **Current:** "Rules compiler", "Prompt compiler", "Compiler", "Rulesets compiler", "Rules processor"
- **Recommendation**: Standardize on rules terminology.
- **Decision:** Standardize on "Rules compiler" for all documentation and code comments.
- **Proposed:
  1. ✴️ "Rules compiler" ← "Rules compiler", "Prompt compiler", "Compiler"
     - Reasoning: Directly connects to our standardized "rules" terminology and clearly communicates the tool's purpose.
     - Example: "Rulesets is a rules compiler for AI assistants"
  2. "Rulesets compiler" ← "Prompt compiler", "Compiler"
     - Reasoning: Uses the product name directly, which can be useful in specific contexts where the brand identity should be emphasized.
     - Example: "The Rulesets compiler transforms your mix files into target-specific rules"
  3. "Rules processor" ← "Rules compiler", "Prompt compiler"
     - Reasoning: Alternative for contexts where "compilation" might imply a more complex transformation than what actually occurs.
     - Example: "The rules processor handles the transformation of mix files into their final format"
- **Decision:**
  - "Compiler" for times when we're referring to the component itself.
  - "Rules compiler" for times when we're referring to the process of compiling rules or what Rulesets is.

## Notation Terminology

### Notation Markers

- **Description:** Fundamental building blocks of Rulesets Notation using `{{...}}` syntax
- **Current:** "Notation Marker", "Marker notation", "Rulesets Notation", "Rulesets directive"
- **Recommendation**: Standardize terminology for consistency while allowing context-specific variations.
- **Decision:** Use "Notation Marker" for individual markers and "Rulesets Notation" for the overall system.
- **Proposed:
  1. ✴️ "Notation Marker" ← "Marker notation", "Rulesets directive" (for individual markers)
     - Reasoning: Establishes "Notation Marker" as the standard term for individual `{{...}}` syntax elements.
     - Example: "Track markers are a specific type of notation marker."
  2. ✴️ "Rulesets Notation" ← (for the overall syntax system)
     - Reasoning: Reserves "Rulesets Notation" as the broader system that includes all types of notation markers.
     - Example: "Rulesets Notation is fully compatible with standard Markdown processors."
  3. "Marker" ← "Notation Marker" (for brevity in clear contexts)
     - Reasoning: A shortened form that can be used once the concept has been established.
     - Example: "Track markers and import markers follow the same basic syntax."
- **Decision:**
  - "Rulesets Notation" should be used when referring to the overall syntax system.
  - "Rulesets Marker" or simply "Marker" should be used when referring to the individual `{{...}}` syntax elements.
    - Where it's helpful, we can clarify that "Marker" == an XML `<tag>`

### Tracks

- **Description:** Delimited content blocks with opening and closing notation markers
- **Current:** "Track", "Track markers", "Track notation markers", "Delimited content blocks", "Content blocks", "Section"
- **Recommendation**: Standardize on "Track" as the primary term with specific variations for syntax elements.
- **Decision:** Use "Track" for the concept and "Track markers" for the syntax elements.
- **Proposed:
  1. ✴️ "Track" ← "Delimited content blocks", "Content blocks", "Section" (for the concept)
     - Reasoning: "Track" is the established term in Rulesets for content blocks and aligns with the musical theme.
     - Example: "The instructions track contains guidance for AI assistants."
  2. ✴️ "Track markers" ← "Track notation markers" (for the syntax elements)
     - Reasoning: More concise while still clearly conveying the relationship to both tracks and notation markers.
     - Example: "Track markers consist of opening and closing tags that surround content."
  3. "Track block" ← "Delimited content blocks" (alternative for emphasis on structure)
     - Reasoning: Emphasizes the block-like nature of tracks when discussing structural aspects.
     - Example: "A mix file can contain multiple track blocks."
- **Decision:**
  - We should rename "Track" to "Section" to better reflect the concept of a track as a single, distinct unit of content and maintain the music production theme.
  - "Section" keeps an alliterative association with "Section" which is already well-established.
  - "Section" also connects well with "Structure" so where it's useful we can put those two words together in a sentence for greater discriptiveness.
  - "Section" refers to the full construct of an opening and closing marker and the content between them.
  - "Section content" refers to the content between the opening and closing markers.
  - "Section name" refers to the leading kebab-case or snake_case identifier that follows the `{{` opening marker.
  - Example: "The instructions section contains guidance for AI assistants."
  - Example: "Sections consist of opening and closing markers that surround content."

## Configuration Terminology

### Options

- **Description:** Configuration parameters for tracks, imports, and other elements
- **Current:** "Option", "Attribute", "Option family", "Option parameter", "Option value", "Option pattern", "Option overrides", "Modifier"
- **Recommendation**: Standardize on "Option" as the primary term with specific variations for different aspects.
- **Decision:** Use "Option" as the primary term, "Target-scoped option" for target-specific settings, and "Modifier" for inclusion/exclusion symbols.
- **Proposed:
  1. ✴️ "Option" ← "Attribute" (primary term)
     - Reasoning: "Option" better reflects the configurable nature of these parameters and avoids confusion with XML attributes.
     - Example: "Tracks can be configured with various options."
  2. ✴️ "Target-scoped option" ← "Target-specific option", "Option overrides" (for target-specific configuration)
     - Reasoning: Aligns with the preferred terminology in the spec and clearly conveys the target-specific nature.
     - Example: "Target-scoped options use the format `target?option=value`."
  3. ✴️ "Modifier" ← "Inclusion modifier", "Exclusion modifier" (for special symbols)
     - Reasoning: Keep "Modifier" for the special inclusion/exclusion symbols as it's already well-established.
     - Example: "The `+` and `-` modifiers control target inclusion and exclusion."
- **Decision:**
  - Let's use "Property" or `prop` for short, replacing "option" universally.
  - `value` or "property's value" for the value of a property, `val` for short.
  - "Property scope" or "prop-scope" for the scope of a property. "Scoped property" is also acceptable e.g. "Destination-scoped property"
  - "Property modifier" or "prop-mod" for short.
  - "Scoped value" or "Destination-scoped value" refers to the value of a property that is scoped to a specific destination. "Override" simply refers to the process of overriding a property's value.

## Import Terminology

### Imports

- **Description:** Mechanism to embed content from another mix, track, or snippet
- **Current:** "Import", "Inclusion", "Embed content", "References", "Import reference", "Import attributes", "Track filtering"
- **Recommendation**: Standardize on "Import" with context-specific terminology for features.
- **Decision:** Use "Import" as the primary term and maintain "Track filtering" for that specific feature.
- **Proposed:
  1. ✴️ "Import" ← "Inclusion", "Embed content", "References" (for the concept)
     - Reasoning: "Import" clearly communicates the action of bringing in external content and is already the primary term.
     - Example: "You can use imports to include common components across multiple mix files."
  2. ✴️ "Track filtering" ← (for the specific feature)
     - Reasoning: Already well-established term that clearly describes this specific import feature.
     - Example: "Track filtering allows you to selectively import only specific tracks from a mix file."
  3. "Import options" ← "Import attributes" (for configuration parameters)
     - Reasoning: Maintains consistency with the standardized "options" terminology.
     - Example: "Import options allow you to specify which tracks to include."
- **Decision:**
  - "Import" should be used everywhere that refers to the import mechanism, replacing "Inclusion", "Embed content", "References", etc.
    - In instances where we're simply describing the action, we can say "Importing content" or "Importing tracks" or "Importing snippets" etc.
  - "Import parameters" replaces "Import attributes/options"
  - "Import scope" replaces "Track filtering"
    - For when we're using `{{> my-rules[my-track] }}`

## Variable Terminology

### Variables

- **Description:** Dynamic values replaced inline at build time
- **Current:** "Variable", "Dynamic values", "Alias", "System variable", "Variable substitution"
- **Recommendation**: Keep "Variable" as the primary term with specific types.
- **Decision:** Use "Variable" as the primary term, with "System variable" for built-ins and "Variable substitution" for the process.
- **Proposed:
  1. ✴️ "Variable" ← "Dynamic values" (for the general concept)
     - Reasoning: "Variable" is the standard programming term and already widely used.
     - Example: "Variables allow for dynamic content in mix files."
  2. ✴️ "System variable" ← (for built-in variables)
     - Reasoning: Clearly distinguishes built-in variables provided by the system.
     - Example: "The `$target` system variable contains the current target identifier."
  3. ✴️ "Variable substitution" ← (for the process)
     - Reasoning: Standard terminology that clearly describes the replacement process.
     - Example: "Variable substitution occurs during the compilation process."
- **Decision:**
  - "Variable" works, and should replace "Dynamic values"
  - "System variable" should replace "Built-in variable"
  - "Variable substitution" should replace "Variable replacement"

## XML Generation Terminology

### XML Conversion

- **Description:** Process of converting notation markers to XML tags in output
- **Current:** "Converted to XML tags", "Transformed into XML structure", "Outputs XML notation", "Renders as XML"
- **Recommendation**: Standardize on technically precise terminology.
- **Decision:** Use "Converted to XML tags" as the primary description with "Transformed into XML structure" as an acceptable alternative.
- **Proposed:
  1. ✴️ "Converted to XML tags" ← "Renders as XML" (primary description)
     - Reasoning: Technically accurate and already recommended in the spec.
     - Example: "Track markers are converted to XML tags during compilation."
  2. ✴️ "Transformed into XML structure" ← (alternative for structural emphasis)
     - Reasoning: Emphasizes the structural transformation aspect.
     - Example: "The Markdown content is transformed into XML structure for target tools."
  3. "Generates XML" ← "Outputs XML notation" (alternative for generation emphasis)
     - Reasoning: Emphasizes the generation aspect when discussing the compiler's output.
     - Example: "The compiler generates XML that target tools can interpret."
- **Decision:**
  - "Converted to XML tags" is the best.
  - "Translated to XML" is good. This would be better than "Transformed into XML structure"
  - IMPORTANT: "The compiler generates XML that…" makes it seem myopic. We should avoid this. XML is simply one potential type of output from Rulesets.
    - "Rulesets compiles rules into pure Markdown, XML, or a combination of the two." or something like that would be better.

## Raw Notation Terminology

### Raw Notation

- **Description:** Triple-brace syntax that preserves Rulesets notation in output
- **Current:** "Triple-brace", "Raw Rulesets Notation", "Triple curly braces"
- **Recommendation**: Standardize on one descriptive term.
- **Decision:** Standardize on "Raw Notation" for all documentation and code comments.
- **Proposed:
  1. ✴️ "Raw Notation" ← "Triple-brace", "Triple curly braces" (primary term)
     - Reasoning: Describes the purpose (preserving raw notation) rather than just the syntax.
     - Example: "Use Raw Notation to demonstrate Rulesets syntax within examples."
  2. "Triple-brace notation" ← "Triple curly braces" (syntax-focused alternative)
     - Reasoning: More specific when discussing the actual syntax with users.
     - Example: "Triple-brace notation uses three curly braces instead of two."
  3. "Escaped notation" ← (alternative emphasizing function)
     - Reasoning: Emphasizes the escaping function of the syntax.
     - Example: "Use escaped notation when you want to show notation syntax without it being processed."
- **Decision:**
  - "Raw notation" works. "Triple-brace" or "escaping" (where applicable and not escaped notation) should only be used to refer to the specific syntax used to preserve Rulesets notation.

## Code Formatting Terminology

### Code Options

- **Description:** Output options for code formatting
- **Current:** "code-*", "code-js", "code-py", "code-block"
- **Recommendation**: Standardize on a consistent pattern for all code-related options.
- **Decision:** Use "code:language" format for language-specific code blocks and "code:block" for generic code blocks.
- **Proposed:
  1. ✴️ "code:language" ← "code-*", "code-js", "code-py" (for language-specific formatting)
     - Reasoning: Using colon separator is consistent with other option formats and clarifies the relationship.
     - Example: "Use output=\"code:javascript\" to format the content as JavaScript code."
  2. ✴️ "code:block" ← "code-block" (for generic code blocks)
     - Reasoning: Maintains consistency with the language-specific format while indicating a generic code block.
     - Example: "Use output=\"code:block\" when you don't need language-specific formatting."
  3. "code:format" ← (for special formatting options)
     - Reasoning: Provides a consistent pattern for additional code formatting options that may be added.
     - Example: "Future versions might support options like output=\"code:format=indent4\"."
- **Decision:**
  - `code-lang` is preferred. We can refer to specific languages when it's necessary for demonstration, but we shouldn't enumerate every possible language anywhere.
  - Simply using `code` for the auto-language notation should be supported. `code-block` should not be used.

## Additional Terminology Changes

### Mixin

- **Description:** Reusable, standalone components that can be imported into Source Rules
- **Current:** "Snippet", "Reusable component", "Partial", "Include", "Fragment"
- **Recommendation:** Standardize on a programming-familiar term that complements Source Rules
- **Decision:** Use "Mixin" as the primary term for reusable components
- **Proposed:**
  1. ✴️ "Mixin" ← "Snippet", "Reusable component", "Fragment"
     - Reasoning: In programming, mixins are reusable pieces of code that can be incorporated into different classes or components - exactly matching our use case.
     - Example: "Import authentication mixins to add user authentication to your Source Rules."
  2. "Component" ← "Reusable component", "Fragment"
     - Reasoning: Generic but clear term that emphasizes the modular nature.
     - Example: "Store common components in the _components directory for reuse."
  3. "Sample" ← "Snippet", "Fragment"
     - Reasoning: Continues the music production theme alongside "section".
     - Example: "Import the header sample into multiple Source Rules files."
- **Decision:**
  - We should use **Mixin** as the standard term for reusable components that can be imported into Source Rules
  - We should rename the `.rulesets/mixes/_snippets` directory to `.rulesets/src/_mixins`
  - A mixin typically contains one or more sections that perform a specific function
  - A mixin can be imported into multiple Source Rules files using the import notation `{{> mixin-name}}`
