# 📏 Rulesets – v0.1.0 Overview

> _Write rules once, compile destination-specific rules, zero drift._

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Purpose \& Vision](#purpose--vision)
  - [Overview](#overview)
  - [The Problem](#the-problem)
  - [Our Solution](#our-solution)
- [Core Concepts](#core-concepts)
- [Key Features](#key-features)
  - [Rulesets notation](#rulesets-notation)
  - [Compiler \& Integration](#compiler--integration)
- [Destination Provider](#destination-provider)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
- [Notation Reference](#notation-reference)
  - [Design Goals](#design-goals)
  - [Delimiter Roles](#delimiter-roles)
  - [Sections](#sections)
    - [Section Notation Markers](#section-notation-markers)
    - [Destination-scoped Property Overrides](#destination-scoped-property-overrides)
    - [Destination-scoped Multiple Properties](#destination-scoped-multiple-properties)
    - [Property Processing Order](#property-processing-order)
    - [Destination Filtering Properties](#destination-filtering-properties)
    - [Self-Closing Tags](#self-closing-tags)
    - [Multi-line Markers for Readability](#multi-line-markers-for-readability)
    - [Section Properties](#section-properties)
    - [Output Format](#output-format)
    - [Property Grouping](#property-grouping)
      - [Multi-line Property Grouping](#multi-line-property-grouping)
      - [Property Bracketing Rules](#property-bracketing-rules)
    - [Property Grouping \& Scoping: Common Patterns](#property-grouping--scoping-common-patterns)
    - [Using bare XML tags](#using-bare-xml-tags)
- [Rulesets front matter](#rulesets-front-matter)
  - [Links](#links)
    - [External \& Rulesets File Internal Links](#external--rulesets-file-internal-links)
    - [Linking to Project Files](#linking-to-project-files)
  - [Variables](#variables)
  - [Imports](#imports)
    - [Import Attributes](#import-attributes)
    - [Destination-Specific Section Filtering](#destination-specific-section-filtering)
    - [Section References and Import Scope](#section-references-and-import-scope)
  - [Imports vs. Variables (Substitution)](#imports-vs-variables-substitution)
  - [Mixins](#mixins)
  - [Rendering Raw Rulesets notation](#rendering-raw-rulesets-notation)
  - [Instruction Placeholders](#instruction-placeholders)
    - [Placeholder Formatting](#placeholder-formatting)
  - [Whitespace Handling](#whitespace-handling)
- [Code Examples](#code-examples)
- [Directory Structure](#directory-structure)
- [XML Generation](#xml-generation)
- [Future Releases](#future-releases)
- [Appendix](#appendix)
  - [Comprehensive Property Reference](#comprehensive-property-reference)
    - [Property Naming Conventions](#property-naming-conventions)
    - [Property Categories and Usage](#property-categories-and-usage)
    - [Common Property Patterns and Languages](#common-property-patterns-and-languages)
    - [Property Extension Rules](#property-extension-rules)

## Purpose & Vision

### Overview

Rulesets is a **Markdown-previewable rules compiler** that lets you author a single rules file (source rules) in Markdown and compile it into compiled rules for each destination (`.cursor/rules.mdc`, `./CLAUDE.md`, `.roo/rules.md`, and more). Think of it as **Terraform for AI rules**: write once, compile for many destinations, your agents, no matter the tool, on the (literal) same page.

### The Problem

- Agentic rules files are **fragmented** across IDEs and agentic tools, following different formats, and in disparate locations, leading to duplication and drift.
- Manual copy-paste workflows break **source-of-truth** guarantees and slow (or halt) experimentation with new agentic tools (that might even be better suited for the task).
- Lack of a **cohesive format for rules** hinders creation, testing, versioning…you name it.

### Our Solution

Rulesets introduces a single source-of-truth rules notation written in pure Markdown (with a dash of specialized notation), which is processed into destination-specific files by a compiler that:

1. Parses source rules files into an AST (abstract syntax tree) to ensure a consistent format.
2. Uses **destination-specific compilers** (as providers) to transform the AST into compiled rules.
3. Writes compiled rules to their respective locations, with the necessary filenames, formats, etc. all accounted for.

The complete logical flow is: source rules → Compilation → Compilation Artifacts → compiled rules

Result: _Write rules once, compile destination-specific rules, zero drift._

## Core Concepts

- **Source rules**
  - Rules files that serve as the compilation source, written in 100% previewable Markdown.
  - Written in Rulesets notation and use `{{...}}` notation markers to direct the compiler.
  - Compiled into destination-specific rules files:
    - `./rulesets/src/my-rule.md` → `.cursor/rules/my-rule.mdc`
- **Destination**
  - A supported tool, such as `cursor`, `windsurf`, or `claude-code`.
  - Defines destination-specific criteria for compiling source rules to compiled rules.
  - Provided through providers.
- **Compiled rules**
  - Destination-specific rules files rendered from the source rules.
  - Examples for a source rules file called `project-conventions.md`:
    - Cursor → `.cursor/rules/project-conventions.mdc`
    - Claude Code → `./CLAUDE.md#project-conventions`
    - OpenAI Codex CLI → `./conventions.md`.
    - OpenAI Codex Agent → `./AGENTS.md`.
  - When placed in destination directories, referred to as "tool-ready rules".
- **Notation Marker**
  - Syntax: `{{...}}`
  - Fundamental building block of Rulesets notation
  - Used to direct the compiler for various purposes (sections, imports, variables)
  - All Rulesets directives use marker notation, but serve different functions
  - Similar to `<xml-tags>`, but fully Markdown-previewable.
- **Section**
  - Syntax: `{{section-name}}...{{/section-name}}`
  - A specific application of notation markers that creates delimited content blocks
  - Converted to XML tags during compilation e.g. `{{instructions}}...{{/instructions}}` → `<instructions>...</instructions>`
  - Has opening and closing notation markers that surround section content
  - Refers to the full construct with opening marker, section content, and closing marker
  - Can contain properties that control rendering behavior
  - Example: `{{instructions}}This is instruction content{{/instructions}}`
- **Import**
  - Syntax: `{{> my-rule }}`
  - Embed content from another source rules file, section, mixin, or template.
- **Variable**
  - Syntax: `{{$key}}` or `$key` if used within a `{{...}}` marker.
  - Dynamic values replaced inline during compilation via variable substitution.
  - Includes aliases, destination values, and front matter values.
  - Examples: `{{$alias}}`, `{{$dest}}`, `{{$.front matter-key}}`

## Key Features

### Rulesets notation

- **100% Preview-able Markdown:** Renders cleanly in GitHub, VS Code, etc.; passes markdown-lint.
- **Granular Sections:** Filter sections within a single source rules for per-destination inclusion/exclusion.
- **Build-time Variables:** Aliases and front matter data injection.

### Compiler & Integration

- **Provider Architecture:** Add new destinations via `RulesetsProvider` without touching core.
- **CLI & API:** `rulesets build`, `rulesets validate`, and `POST /compile` endpoint.

## Destination Provider

| ID            | Tool               | Type              |
| ------------- | ------------------ | ----------------- |
| `cursor`      | Cursor             | IDE               |
| `windsurf`    | Windsurf           | IDE               |
| `claude-code` | Claude Code        | CLI               |
| `roo-code`    | Roo Code           | VS Code Extension |
| `cline`       | Cline              | VS Code Extension |
| `codex-cli`   | OpenAI Codex CLI   | CLI               |
| `codex-agent` | OpenAI Codex Agent | Web agent         |

## Getting Started

### Installation

```bash
npm install -g @rulesets/cli        # global CLI
# project-local
npm install --save-dev @rulesets
# or with the CLI
npx @rulesets/cli init
```

### Quick Start

```bash
rulesets init      # scaffolds .ruleset/ directory structure

rulesets import    # imports existing rules files into the rulesets format

rulesets build     # writes compiled rules to .ruleset/dist/
```

## Notation Reference

### Design Goals

| Goal                  | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| ✨ **Simplicity**     | Reduce bespoke format/structure for each tool to just one.          |
| 🧹 **Lintability**    | Files must pass standard markdown-lint without hacks.               |
| 👀 **Previewability** | Render legibly in GitHub, VS Code, Obsidian, etc.                   |
| 🧩 **Extensibility**  | Advanced behaviors declared via attributes instead of new notation. |

### Delimiter Roles

Rulesets' syntax follows strict delimiter rules to maintain consistency and clarity. Each character serves a specific purpose:

| Delimiter | Role              | Example                               | Purpose                                                               |
| --------- | ----------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `:`       | Scope indicator   | `destination:code-javascript`         | Indicates that properties are scoped to a specific destination        |
| `()`      | Value container   | `name-("value")`                      | Contains values for a specific property                               |
| `[]`      | Property grouping | `destination:[property-1 property-2]` | Groups multiple properties within a scope                             |
| `+`       | Inclusion         | `+destination`, `+section-one`           | Indicates inclusion of a destination or section                          |
| `!`       | Exclusion         | `!destination`, `!section-two`           | Indicates exclusion of a destination or section                          |
| `#`       | Section reference    | `#section-name`, `#(section1 section2)`        | References sections in imports for selective filtering with import scope |

These delimiters always maintain their role throughout the syntax, making the language more intuitive and easier to learn.

### Sections

Sections are the core building block of Rulesets and are a direct stand in for XML tags. They are used to create reusable content blocks that provide clarity for agents, and can be included in other sections or source rules.

```markdown
{{instructions +cursor !claude-code}}

- IMPORTANT: You must follow these coding standards...
  {{/instructions}}
```

#### Section Notation Markers

- **1:1 Markdown-to-XML Translation**: Write sections as `{{section-name}}` and they will be converted to `<section_name>` in the output. Rulesets can compile into pure Markdown, XML, or a combination of the two.
- **Open/Close**: Sections use opening `{{section-name ... }}` and closing `{{/section-name}}` markers to delimit their content.
- **Naming**: `kebab-case` is recommended for section names (e.g., `my-section-name`) to avoid accidental Markdown emphasis rendering. Regardless of the naming convention used in the source `.md` file, the corresponding XML tags in outputs will be formatted as `<snake_case>` (e.g., `<my_section_name>`). This output format is configurable.
- **Parsing Example**:

```markdown
<!-- Rulesets input -->

{{section-one}}
Content A
{{/section-one}}

{{section-two +all !claude-code}}
Content B
{{/section-two}}

---

Output for all configured tools (except `claude-code` in this example):

  <!-- XML output -->

<section_one>
Content A
</section_one>
<section_two>
Content B
</section_two>
```

While Claude Code output will be:

```markdown
<section_one>
Content A
</section_one>
```

#### Destination-scoped Property Overrides

Any property can be given a per-destination override by suffixing the destination ID with a **`:`** delimiter (colon):

```markdown
{{instructions cursor:name-("cursor-instructions")}}
...
{{/instructions}}
```

In this example the section will use the name "cursor-instructions" when compiled for the _cursor_ destination. The same pattern works with groups once they arrive (e.g. `ide:name-("ide-instructions")`).

Note: You can also use the `+destination` notation to both include the section for specific destinations _and_ apply destination-specific overrides.

#### Destination-scoped Multiple Properties

For multiple destination-specific properties, you can use square brackets after the colon:

```markdown
{{instructions cursor:[name-("cursor-rules") code-javascript]}}
```

This applies both `name-("cursor-rules")` and `code-javascript` properties only when building for the cursor destination, without affecting other destinations. The square brackets group the properties that are scoped to that specific destination.

#### Property Processing Order

Properties within a section marker are processed sequentially from left to right. This processing order affects three main categories of properties:

1. **Basic Properties**: Simple formatting properties like `unwrap` or `code-javascript`
2. **Destination Inclusion/Exclusion**: Modifiers like `+destination` and `!destination`
3. **Destination-Scoped Properties**: Special formatting for specific destinations using `destination:[properties]`

The evaluation follows this simple rule:

- Properties are applied **in the exact order they appear** (left to right)
- When conflict occurs, **the last directive wins**

**Simple Example:**

```markdown
{{section code-javascript unwrap}}
```

First applies `code-javascript` (JavaScript code block formatting), then applies `unwrap` (removes surrounding XML tags).

**Practical Destination Example:**

```markdown
{{section +ide !windsurf cursor:[unwrap]}}
```

This would:

1. Include the section for all IDE destinations (`+ide`)
2. Exclude it specifically for Windsurf (`!windsurf`), even though Windsurf might be in the IDE group
3. Apply the `unwrap` property, but only when building for Cursor

**Conflict Resolution Example:**

```markdown
{{section h-2 h-3}}
```

The section would use heading level 3 because `h-3` appears last and overrides `h-2`.

> [!NOTE]
> While properties are processed left-to-right, certain property types like `name-()` might have special handling if specified multiple times. When in doubt about complex combinations, the last specified property for a particular feature usually takes precedence.

#### Destination Filtering Properties

Destination filtering properties control which destinations receive content. These provide powerful ways to include or exclude content for specific destinations or groups of destinations:

| Property       | Description                             | Example              |
| -------------- | --------------------------------------- | -------------------- |
| `+destination` | Include for a specific destination      | `{{section +cursor}}`   |
| `!destination` | Exclude for a specific destination      | `{{section !windsurf}}` |
| `+all`         | Include for all configured destinations | `{{section +all}}`      |
| `+group`       | Include for all destinations in a group | `{{section +ide}}`      |
| `!group`       | Exclude for all destinations in a group | `{{section !cli}}`      |

The `+all` property is particularly useful for explicitly indicating that content should be included for all destinations. This is helpful when you want to be explicit about inclusion, even though the default behavior is already to include content for all destinations.

```markdown
{{instructions +all !claude-code}}
This content is explicitly included for all destinations except claude-code.
{{/instructions}}
```

When combined with exclusions, `+all` helps make it clear that the content is intentionally included everywhere except for the excluded destinations.

**Group Membership and Exclusions:**

When using both group inclusions and specific destination exclusions, the exclusions take precedence for the specified destinations. This allows for fine-grained control over destination selection:

```markdown
{{instructions +cli !claude-code}}
This content is included for all CLI destinations EXCEPT claude-code.
{{/instructions}}
```

In this example, even though `claude-code` is a member of the `cli` group, the explicit exclusion (`!claude-code`) overrides the group inclusion (`+cli`). This follows the principle that explicit declarations take precedence over implicit ones, and allows for excluding specific members from their groups when needed.

#### Self-Closing Tags

For sections with no content, you can use a self-closing tag format:

```markdown
{{empty-section /}}

<!-- Which is equivalent to: -->

{{empty-section}}{{/empty-section}}
```

Self-closing tags render as empty XML tags in the output:

```xml
<empty_section />
```

**Further Destination Scoping Examples:**

- **Destination-specific property (block included for all destinations unless otherwise specified):**
  `{{instructions cursor:name-("cursor-specific-rules")}}`
  _(Applies `name-("cursor-specific-rules")` only for the `cursor` destination. The block itself is included for all destinations by default.)_

- **Inclusion for a destination with a specific property:**
  `{{instructions +cursor:name-("only-for-cursor")}}`
  *(Includes this section *only* for the `cursor` destination, and for `cursor`, it uses `name-("only-for-cursor")`.)*

- **Inclusion for a destination with multiple specific properties:**
  `{{instructions +cursor:[name-("cursor-rules") code-javascript]}}`
  *(Includes this section *only* for the `cursor` destination, applying both `name-("cursor-rules")` and `code-javascript` for `cursor`.)*

- **Exclusion for a destination, even if a scoped property is present:**
  `{{instructions !cursor:name-("ignored-for-cursor")}}`
  _(Excludes this section for the `cursor` destination. The `name-("ignored-for-cursor")` property would not apply as the section is excluded for `cursor`.)_

- **Group inclusion with member exclusion and scoped properties for the group:**
  `{{instructions +ide:[code-javascript] !cursor}}`
  _(Includes this section for all destinations in the `ide` group, applying the `code-javascript` property, but explicitly excludes it for the `cursor` destination, even if `cursor` is part of the `ide` group. Assumes `ide` is a defined group, typically in `rulesets.config.json`.)_

> [!IMPORTANT]
> Differentiating Scoped Properties from Scoped Inclusion:
>
> - `destination:[my-property]` means "If this section is rendered for `destination`, apply `my-property`." The section's general inclusion is determined elsewhere (e.g. by default, or by a `+destination` on its own).
> - `+destination:[my-property]` means "Render this section _only_ for `destination`, and when doing so, apply `my-property`." This controls both inclusion and destination-specific properties simultaneously.

#### Multi-line Markers for Readability

Properties can be split across lines for readability. The parser preserves this formatting when writing XML tags:

```markdown
<!-- Multi-line section marker in Rulesets format -->

{{instructions
  name-("important-rules")
}}
This is the content of the instructions section.
{{/instructions}}

<!-- Note: Using the name-("value") syntax specifically sets the 'name' attribute
  (e.g., name="important-rules") in the rendered XML output. The value provided in name-("...") is used as-is and is not transformed to snake_case (unlike section names themselves). -->

---

Output:
<instructions
  name="important-rules">
This is the content of the instructions section.
</instructions>
```

#### Section Properties

| Property                   | Type      | Purpose                                                                                                                                                        |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+/!destination`           | flag      | Include/exclude for specific destinations (e.g., `+cursor !windsurf`).                                                                                         |
| `name-("value")`           | value     | Sets a name with a specified value for the section (e.g., `name-("my-section")` becomes `name="my-section"`).                                                     |
| `id-("value")`             | value     | Sets a unique XML `id` attribute for the section (e.g., `id-("unique-identifier")` becomes `id="unique-identifier"`), useful for linking or specific referencing. |
| `unwrap`, `inline`, etc.   | flag      | Controls how content is processed (see [Output Format](#output-format) below).                                                                                 |
| `code-`, `h-`, `num-`      | flag      | Family-specific properties for code blocks, headings, and numbering.                                                                                           |
| `[property1 property2]`    | group     | Groups multiple properties together for readability.                                                                                                           |
| `destination:[properties]` | scoped    | Destination-specific property group.                                                                                                                           |
| _Custom_ `key="value"`     | attribute | Any key-value pair is passed through as-is to the compiled artifact.                                                                                           |

#### Output Format

Output properties provide flexible control over how content is formatted in compiled artifacts. These properties are available for sections, imports, and inclusions.

```markdown
{{instructions unwrap}}
Content without surrounding XML tags
{{/instructions}}

{{> conventions#style-guide inline}}

{{> @code-example code-javascript}}
```

**Output Property Values:**

| Value              | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| (default)          | Normal rendering with XML tags in standard format (default behavior)                   |
| `inline`           | Content rendered inline without XML tags (simple, concise format)                      |
| `inline-with-tags` | Content rendered inline with XML tags preserved (all on a single line)                 |
| `unwrap`           | Remove XML tags from compiled artifacts but maintain block formatting                  |
| `code`             | Auto-detect and render as a Markdown code block with appropriate language              |
| `code-language`    | Render content as a code block in specified language (see Code Block Properties below) |
| `process-content`  | Compile content within markers, use within `{{{...}}}`                                 |

Multiple properties can be applied together (space-separated):

```markdown
{{instructions inline unwrap}}
This content will appear without tags and inline
{{/instructions}}
```

**Code Block Properties:**

The `code-<language>` property family renders content as a code block in the specified language, directly mapping to Markdown's standard fenced code block syntax (language). These are part of the code formatting property family. For example:

```markdown
{{section code-javascript}}
function hello() {
console.log("Hello, world!");
}
{{/section}}
```

This compiles to the equivalent of standard Markdown fenced code blocks:

````markdown
```javascript
function hello() {
  console.log('Hello, world!')
}
```
````

Common language shortcuts include `code-javascript`, `code-typescript`, etc.

**Heading Properties (h-\* family):**

Heading properties control how headings are processed:

| Property       | Description                | Example                 |
| -------------- | -------------------------- | ----------------------- |
| `h-1` to `h-6` | Set specific heading level | `{{section h-2}}`       |
| `h-inc`        | Increment heading level    | `{{section h-inc}}`     |
| `h-dec`        | Decrement heading level    | `{{section h-dec}}`     |
| `h-same`       | Keep same heading level    | `{{section h-same}}`    |
| `h-initial`    | Replace first heading      | `{{section h-initial}}` |

**Heading Shortcut:**

For convenience, you can use a string as the first item in a section to automatically create a heading:

```markdown
{{section "Section Name" h-3}}
Section content goes here.
{{/section}}
```

This is equivalent to specifying the heading within the content but provides a more visible and consolidated way to name sections. It's particularly useful when creating structured documents with many subsections.

The heading shortcut will automatically:

- Set the heading level (via h-\* properties)
- Use the provided text as the heading
- Apply the heading to the beginning of the section content

**Numbering Properties (num-\* family):**

Numbering properties control how content is numbered:

| Property            | Description              | Example                         |
| ------------------- | ------------------------ | ------------------------------- |
| `num`               | Enable default numbering | `{{chapter num}}`               |
| `num-heading-first` | Number first heading     | `{{chapter num-heading-first}}` |
| `num-heading-last`  | Number last heading      | `{{chapter num-heading-last}}`  |
| `num-tag-first`     | Number first tag         | `{{chapter num-tag-first}}`     |
| `num-tag-last`      | Number last tag          | `{{chapter num-tag-last}}`      |

#### Property Grouping

> [!NOTE]
> This section has been added to document the new property grouping syntax.

By default, properties are space-delimited. You can optionally wrap a list of properties in square brackets for visual grouping and better readability:

```markdown
{{rules [ unwrap code-javascript +cursor name-("important-rules") ]}}
...
{{/rules}}
```

All properties inside `[...]` behave exactly the same as if they were space-delimited. This is particularly useful for complex property combinations.

##### Multi-line Property Grouping

Property grouping allows for improved readability with multi-line properties:

```markdown
{{rules [
  unwrap
  code-javascript
  name-("important-rules")
  +cursor
  ]}}
...
{{/rules}}
```

##### Property Bracketing Rules

Property groups (brackets) cannot be nested. All properties within a group must be space-delimited and cannot themselves contain another property group.

For destination-scoped properties with multiple properties, use square brackets after the colon:

```markdown
{{rules destination:[code-javascript name-("destination-rules")]}}
```

Important: You cannot nest property groups within other property groups:

```markdown
{{rules [code-javascript unwrap destination:[property-a property-b]]}} # ❌ Invalid, nested properties groups
{{rules [code-javascript unwrap] destination:[property-a property-b]}} # ✅ Valid, separate property groups
```

Leading and trailing whitespace within the property group brackets `[]` is optional and will be ignored by the parser. Spaces between properties within the brackets are necessary delimiters. For example, `[ property1  property2 ]` is equivalent to `[property1 property2]`.

#### Property Grouping & Scoping: Common Patterns

The following table provides a quick reference to common invocation patterns for property grouping and destination scoping:

| Pattern                                            | Example                                               | Description                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic Grouping                                     | `{{section [opt1 opt2 opt3]}}`                           | Visually groups space-delimited properties.                                                                                                                                                                                                          |
| Multi-line Grouping                                | `{{section [\n opt1 \n opt2 \n]}}`                       | Improves readability for many properties.                                                                                                                                                                                                            |
| Destination-Scoped Single Property (no group)      | `{{section destination:opt1}}`                           | Applies `opt1` only when compiling for `destination`. The section itself is included for all destinations by default, unless other inclusion/exclusion properties (e.g., `+destination`, `!anotherDest`) are present that alter its general visibility. |
| Destination-Scoped Multiple Properties (via group) | `{{section destination:[opt1 opt2]}}`                    | Applies `opt1` and `opt2` only for `destination`. Block included for all.                                                                                                                                                                            |
| Inclusion for Destination + Scoped Single Opt      | `{{section +destination:opt1}}`                          | Includes block only for `destination`, applying `opt1`.                                                                                                                                                                                              |
| Inclusion for Destination + Scoped Multi Opts      | `{{section +destination:[opt1 opt2]}}`                   | Includes block only for `destination`, applying `opt1` and `opt2`.                                                                                                                                                                                   |
| Exclusion for Destination (scoped opts moot)       | `{{section !destination:opt1}}` or `!destination:[opt1]` | Excludes block for `destination`.                                                                                                                                                                                                                    |
| Group Inclusion + Member Exclusion                 | `{{section +group:[opt1] !member}}`                      | Includes for `group` with `opt1`, but excludes for `member`.                                                                                                                                                                                         |
| All Destinations Inclusion                         | `{{section +all}}`                                       | Explicitly includes content for all configured destinations.                                                                                                                                                                                         |

The standalone `code` property (without a language suffix) automatically determines the appropriate language based on context. When used with mixins, it detects the language based on the mixin file's extension:

````markdown
{{> @my-script.js code}}

<!-- When compiled, will be written as a JavaScript code block (```javascript) -->

{{> @styles.css code}}

<!-- When compiled, will be written as a CSS code block (```css) -->
````

If the file extension is not recognized (and isn't a `.md` file), it will default to `txt`. Explicitly specifying a language will always override the automatic detection:

````markdown
{{> @config.json code-yaml}}

<!-- When compiled, will be written as a YAML code block (```yaml) despite being a JSON file -->
````

This extension-to-language mapping follows the same conventions used by most Markdown editors and syntax highlighters, ensuring consistent behavior between your source rules and compiled artifacts.

#### Using bare XML tags

> [!WARNING]
> Bare XML tags are not valid Markdown, so Markdown previewers may be likely to render them differently or not at all.

When `allow-bare-xml-tags` is set to `true` in front matter or `.rulesets.config.json`, you can use bare XML tags for section names. The tags will be compiled as-is, but note:

```markdown
<!-- XML tags with `allow-bare-xml-tags` set to `true` -->

<section_name>
...
</section_name>

Renders as:

<section_name>
...
</section_name>
```

### Rulesets front matter

```yaml
---
# .ruleset/rules/my-rule.rule.md
rulesets:
  version: 0.1.0 # optional, version number for the Rulesets format used
description: 'Rules for this project' # optional, may be useful for tools that use descriptions, such as Cursor, Windsurf, etc.
globs: ['**/*.{txt,md,mdc}'] # optional, globs re-written based on destination-specific needs
# Destination filter examples using standard keys:
destination:
  include: ['cursor', 'windsurf']
  exclude: ['claude-code']
  path: './custom/compile/path'
# Provide destination-specific front matter which is included in their respective compiled artifacts:
cursor:
  alwaysApply: false
  destination:
    path: './custom/.cursor/rules'
windsurf:
  trigger: globs
# Add additional metadata to the source rules:
name: my-rule # optional, defaults to filename
version: 2.0 # optional, version number for this file
created: 2025-05-13 # optional, date of creation, automatically included by default
updated: 2025-05-14 # optional, date of last update, automatically included by default
labels: ['core', 'security'] # optional, categorization tags for the source rules, available for future use
allow-bare-xml-tags: false # optional, defaults to false. Set to true to allow bare XML tags in this file.
---
```

front matter is used to provide metadata about the source rules file and control how it's compiled. Basic front matter includes:

- `rulesets.version`: Metadata about the Rulesets format used.
- `name`: Unique identifier for the source rules (optional, defaults to filename).
- `description`: Optional description of the source rules, rendered for tools that use them (e.g. Cursor, Windsurf, etc.).
- `globs`: Optional globs to be rewritten based on destination-specific needs.
- `destination`: Control how this source rules is processed for destinations:
  - `include`/`exclude`: Control which destinations receive this source rules.
  - `path`: Specify a custom path for destination artifacts.
  - Properties include any destination providers registered in `.ruleset/config.toml`.
- `version`: Version information for this file.
- `labels`: Categorization tags for this file.
- `allow-bare-xml-tags: (boolean)` - Optional. When set to `true` in this file's front matter, it allows the use of bare XML tags (e.g., `<my_tag>...</my_tag>`) directly within this specific Rulesets file instead of the standard `{{my-tag}}...{{/my-tag}}` notation. This setting overrides any global `allow-bare-xml-tags` setting in `.ruleset/config.toml` for this file. Defaults to `false` if not specified. See the 'Using bare XML tags' section for more details.
- `[cursor|windsurf|claude-code|...]`: Destination-specific key/value pairs can be provided.
  - These can include `destination.path` to override the global path for specific destinations.

For more details on the structure and capabilities of the `.ruleset/config.toml` file, including global settings (like `allow-bare-xml-tags`), aliases, and destination provider configurations, please refer to the project's architecture or configuration documentation.

### Links

#### External & Rulesets File Internal Links

Standard Markdown links work as expected external links, and links to other source rules:

- Regular links: `[Text](url)`
- Links to other source rules files: `[Text](other-rule.md)`

> [!NOTE]
> Standard Markdown links will work in previews as expected within the `.ruleset/rules` directory, but `{{link ...}}` will not, as it requires compilation by Rulesets to resolve paths relative to the final compiled rules directory and apply any destination-specific link transformations.

#### Linking to Project Files

Linking to project files is done with with `@` and a relative path to the project root:

```markdown
Here is a link to a file: @path/to/file.txt
Here's an aliased link to a file: @path/to/file.txt("Alternative Title")

The above will render as a link relative to the compiled rule's path. For example, if the compiled rule is written to `.cursor/rules/project-conventions.mdc`, the link will be rendered as:

Here is a link to a file: [path/to/file.txt](mdc:../../path/to/file.txt)
Here's an aliased link to a file: [Alternative Title](mdc:../../path/to/file.txt)

Whereas in CLAUDE.md files, which use the `@path/to/file.txt` notation, the link will be rendered as:

Here is a link to a file: @path/to/file.txt
Here's an aliased link to a file: [Alternative Title](@path/to/file.txt)
```

### Variables

Variables are dynamic values using the `{{$...}}` notation. They are replaced inline during compilation through variable substitution.
The syntax for variables depends on the context:

- `{{$key}}` is used when the variable is standalone in the content. For example: `Welcome, {{$userName}}!`
- `$key` is used when the variable is within another Rulesets `{{...}}` marker. For example: `{{section class-($userTheme)}}`

| Type                     | Notation                      | Notes                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alias**                | `{{$alias}}`                  | Alias lookup in `.ruleset/config.toml` under `aliases` key.                                                                                                                                                                             |
| **front matter value**   | `{{$.key}}`                   | Access values from the current file's front matter.                                                                                                                                                                                      |
| **Destination variable** | `{{$dest}}` or `{{$dest.id}}` | Built-in variables provided by the compiler. Display name from the provider manifest (e.g. `Cursor`, `Claude Code`). The current destination ID in kebab-case can be accessed by adding `.id` to the end (`cursor`, `claude-code`, etc.) |

**Built-in Destination Variables**:

- `{{$dest}}` → display name from the provider manifest (e.g. `Cursor`, `Claude Code`, etc.)
- `{{$dest.id}}` → current destination ID in kebab-case (`cursor`, `claude-code`, etc.)

### Imports

Imports allow you to reuse content across multiple source rules files by embedding source rules, sections within a file, or mixins into compiled artifacts. They are denoted by the `{{> ...}}` notation.

```markdown
<!-- Embeds `/_mixins/legal.md` -->

{{> @legal }}

<!-- Embed a specific section from the `conventions.md` source rules file -->

{{> conventions#section-name }}

<!-- Embed a section from within the existing file -->

{{> #section-name }}

<!-- Import a source rules with multiple specific sections, with exclusion -->

{{> my-rules#(section-one section-two !section-three) }}
```

Example:

Let's say that we have a source rules file called `conventions.md` that contains a section called `style-guide`. We can import it into another source rules file called `my-rules.md` and include only the `style-guide` section:

```markdown
<!-- my-rules.md -->

Important: Be sure to follow the style guide:

{{> conventions#style-guide }}

---

The above will render as:

Important: Be sure to follow the style guide:

<style_guide>
( contents of #conventions.md#style-guide )
</style_guide>
```

#### Import Attributes

All [section properties](#section-properties) can be applied to imports. Additionally, imports support filtering of sections using `#(...)` parentheses syntax for import scope:

```markdown
{{> my-rules#(section-one !section-two) }}
```

This allows you to filter which sections from the source rules are included/excluded on render:

- For included sections, use the section name without any prefix
- For excluded sections, prefix the section name with `!` e.g. `!section-two`

For formatting properties:

- `unwrap` will remove the surrounding XML tags from the compiled artifact
- `inline` will render the content inline without XML tags
- `inline-with-tags` will render the content inline with XML tags (all on a single line)
- `code` or `code-language` will format the content as a code block

Examples:

```markdown
{{> my-rules#(!less-important-considerations)}}

<!-- 👆 This would include all sections from `my-rules.md`
     except for `less-important-considerations`. -->

{{> my-rules#(section-one section-two)}}

<!-- 👆 This would include only the `section-one` and `section-two`
     sections from `my-rules.md`. -->
```

#### Destination-Specific Section Filtering

You can also apply destination-specific section filtering for imports:

```markdown
{{> my-rules#(common-section !legacy-section cursor:[cursor-specific-section])}}
```

This would:

- Include `common-section` for all destinations
  - Additionally include `cursor-specific-section` only when building for the `cursor` destination
- Exclude `legacy-section` for all destinations

#### Section References and Import Scope

Section references using the `#` symbol provide a way to selectively include or exclude sections from source rules files during import. There are several ways to use section references:

- **Single section reference**: `{{> source-file#section-name}}` - Import only the specified section
- **Internal section reference**: `{{> #section-name}}` - Reference a section within the current file
- **Multiple sections with import scope**: `{{> source-file#(section-one section-two)}}` - Import multiple specific sections
- **Exclusion with import scope**: `{{> source-file#(!section-three)}}` - Import all sections except the specified one
- **Destination-scoped sections**: `{{> source-file#(common-section cursor:[cursor-only-section])}}` - Include destination-specific sections

Import scope provides a powerful way to control exactly which sections are included from source rules during compilation. This selective filtering allows for greater flexibility when reusing content across multiple files while maintaining destination-specific customizations.

### Imports vs. Variables (Substitution)

It's important to distinguish between imports (`{{> ...}}`) and variable substitution (`{{$...}}`), as they serve different purposes:

- **Imports** (`{{> ...}}`) are used to embed content structures. When an import like `{{> mySnippet }}` is processed, it typically renders the content of `mySnippet` _including its own structure_, which might result in output like `<mySnippet>...</mySnippet>` (unless properties like `unwrap` are used).
- **Variable Substitution** (`{{$...}}`) replaces a placeholder with its string value. It does not render any surrounding tags itself. For example, if `{{$userName}}` has the value "John", then `Hello, {{$userName}}!` would render as `Hello, John!`. The variable is directly replaced by its value.

### Mixins

Mixins are modular, reusable components, stored in the `.ruleset/rules/_mixins/` directory. Like programming mixins that can be incorporated into different classes or components, Rulesets mixins provide isolated content blocks that can be imported into multiple source rules files.

- A mixin typically contains one or more sections that perform a specific function
- Mixins are imported using the `{{> @mixin-name}}` notation
- Mixins are converted to `<mixin_name>` tags in the compiled artifact, unless modified with `unwrap` or `inline` properties

Example:

```markdown
<!-- Mixin: `/_mixins/remember.md` -->

1. Always follow the code conventions.
2. Never commit directly to `main`
3. Use conventional commit messages.

---

<!-- Source Rules: `my-rules.md` -->

# My Rules

...rest of source rules content...

{{> @remember}}

---

<!-- Output: `.cursor/rules/my-rules.mdc` -->

# My Rules

...rest of rules file...

<remember>
1. Always follow the code conventions.
2. Never commit directly to `main`
3. Use conventional commit messages.
</remember>
```

### Rendering Raw Rulesets notation

Rulesets notation can be compiled as raw notation using the `{{{...}}}` syntax. This allows you to skip processing of the content and render it with the Rulesets notation preserved.

- Describes the purpose of preserving raw notation rather than just the syntax
- Particularly useful for writing documentation or rules that need to show Rulesets notation literally
- Wrapping a section in triple curly braces preserves all Rulesets notation and nested content exactly as written
- Example:

```markdown
> Triple braces will preserve the Rulesets notation on render.
> Adding `unwrap` will remove those section tags from the compiled artifact.
> Adding `+cursor` will only include the section for the `cursor` destination.

{{{examples unwrap +cursor}}}
{{example}}

- Instructions
- Rules
  {{/example}}
  {{{/examples}}}

The above will render (for Cursor only) as:

{{example}}

- Instructions
- Rules
  {{/example}}

Without the `unwrap` property, it would render as:

{{examples}}
{{example}}

- Instructions
- Rules
  {{/example}}
  {{/examples}}
```

### Instruction Placeholders

When writing prompts or instructions, you can use placeholders as self-contained prompts to direct an AI to fill in. Rulesets recommends using single-bracket `[placeholder text]`, but single-brace `{placeholder text}` notation is supported. Just be careful, as one extra brace will cause the compiler to treat it as a Rulesets notation marker.

- ✅ Do this:
  - `[requirements]` / `[ requirements ]`
  - `{requirements}` / `{ requirements }`
- ❌ Don't do this:
  - `[[requirements]]`
  - `{{requirements}}`
  - `<requirements>`

> [!IMPORTANT]
> Remember, placeholder values should be simply considered instructions for the AI, and the output may not always be exactly what you expect. They're probabilistic, not deterministic.

#### Placeholder Formatting

Feel free to experiment with different language choice, formats, and even attributes to see what works best for your use case:

```markdown
[requirements|Title Case]
[requirements format="Title Case"]
[requirements in Title Case]
```

While the AI may not always follow the instructions in the placeholder precisely, it's worth experimenting.

### Whitespace Handling

Rulesets has specific rules for whitespace to ensure consistent parsing and output:

- Space after opening `{{` and before closing `}}` is optional
  - Example: `{{instructions}}` is equivalent to `{{ instructions }}`
- No spaces are allowed around the `=` sign in attribute declarations
- Attributes must be separated by spaces or newlines
  - Whitespace adjacent to brackets is removed on render, while new lines are preserved

## Code Examples

**Section with attributes:**

```markdown
{{instructions name-("core-rules") +cursor !windsurf}}
All code must follow consistent formatting.

Testing is required for all new features.
{{/instructions}}

Output in Cursor (but not Windsurf):

<instructions name="core-rules">
All code must follow consistent formatting.

Testing is required for all new features.
</instructions>
```

**Importing content:**

```markdown
{{> @coding-standards }}

{{> my-rule#specific-section }}
```

**Using variables:**

```markdown
Project: {{ $project }}
Version: {{ $.version }}
```

**Using raw output:**

```markdown
{{{example unwrap}}}
To include a section in Rulesets use: {{section-name}}
{{{/example}}}

Will compile to:

To include a section in Rulesets use: {{section-name}}
```

## Directory Structure

```text
project/
├── .ruleset/
│   ├── dist/
│   │   └── latest/         # compiled rules
│   ├── rules/              # source rules files (*.rule.md)
│   │   └── _mixins/        # reusable content modules
│   └── config.toml         # Rulesets config file
```

## XML Generation

Rulesets converts notation markers to XML tags during the compilation process. When sections are converted to XML:

- Section markers are converted to XML tags with corresponding names (`{{section-name}}` → `<section_name>`)
- Properties become XML attributes in the output tags
- Content between markers becomes the XML tag content
- Rulesets can compile rules into pure Markdown, XML, or a combination of the two

This XML conversion provides a standardized structure that destination tools can interpret while maintaining full Markdown compatibility for source rules.

## Future Releases

Features planned for v0.x releases:

- Destination groups for easier filtering of multiple destinations
- Template support with placeholder filling
- Mode support for tools like Roo Code
- Slash command support for Claude Code
- Strict mode for validation

## Appendix

### Comprehensive Property Reference

This section provides a complete reference for all properties supported in Rulesets v0.x, organized by their purpose and usage patterns.

#### Property Naming Conventions

Rulesets uses consistent naming patterns to make properties discoverable and intuitive:

| Pattern                | Description                        | Examples                          |
| ---------------------- | ---------------------------------- | --------------------------------- |
| `prefix-*`             | Family of related properties       | `code-javascript`, `h-2`          |
| `name-("value")`       | Property with parameter value      | `name-("important-rules")`        |
| `+/-prefix`            | Inclusion/exclusion modifiers      | `+cursor`, `!windsurf`            |
| `destination:property` | Destination-scoped single property | `cursor:unwrap`                   |
| `destination:[opts]`   | Destination-scoped property group  | `cursor:[unwrap code-javascript]` |
| `custom="value"`       | Custom XML attribute               | `priority="high"`                 |

#### Property Categories and Usage

The table below organizes properties by their categories with comprehensive information about where they can be used.

| Property                             | Format        | Example                                   | Section | Import | front matter | Description                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------- | ----------------------------------------- | ---- | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Destination Selection Properties** |               |                                           |      |        |              |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `+destination`                       | Flag          | `+cursor`                                 | ✅   | ✅     | ❌           | Include content for specific destination                                                                                                                                                                                                                                                                                                                                                                                                      |
| `!destination`                       | Flag          | `!windsurf`                               | ✅   | ✅     | ❌           | Exclude content for specific destination                                                                                                                                                                                                                                                                                                                                                                                                      |
| `+group`                             | Flag          | `+ide`                                    | ✅   | ✅     | ❌           | Include for all destinations in a group                                                                                                                                                                                                                                                                                                                                                                                                       |
| `+all`                               | Flag          | `+all`                                    | ✅   | ✅     | ❌           | Include content for all configured destinations                                                                                                                                                                                                                                                                                                                                                                                               |
| `!group`                             | Flag          | `!cli`                                    | ✅   | ✅     | ❌           | Exclude for all destinations in a group                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Destination-Scoped Properties**    |               |                                           |      |        |              |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `destination:property`               | Scoped        | `cursor:unwrap`                           | ✅   | ✅     | ❌           | Apply property only for specified destination                                                                                                                                                                                                                                                                                                                                                                                                 |
| `destination:[properties]`           | Scoped group  | `cursor:[code-javascript name-("rules")]` | ✅   | ✅     | ❌           | Apply multiple properties only for specified destination                                                                                                                                                                                                                                                                                                                                                                                      |
| `+destination:property`              | Combined      | `+cursor:unwrap`                          | ✅   | ✅     | ❌           | Include for destination and apply property to that destination                                                                                                                                                                                                                                                                                                                                                                                |
| `!destination:property`              | Combined      | `!windsurf:code-javascript`               | ✅   | ✅     | ❌           | Exclude for destination (property has no effect)                                                                                                                                                                                                                                                                                                                                                                                              |
| **Metadata Properties**              |               |                                           |      |        |              |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `name-("value")`                     | Parameter     | `name-("important-rules")`                | ✅   | ✅     | ✅           | Set XML name attribute; identifier in front matter                                                                                                                                                                                                                                                                                                                                                                                            |
| `id-("value")`                       | Parameter     | `id-("section-1")`                        | ✅   | ✅     | ❌           | Set id attribute for linking and references                                                                                                                                                                                                                                                                                                                                                                                                   |
| `custom="value"`                     | XML attribute | `priority="high"`                         | ✅   | ✅     | ❌           | Set custom XML attributes passed to output                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Display Properties**               |               |                                           |      |        |              |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `unwrap`                             | Flag          | `unwrap`                                  | ✅   | ✅     | ❌           | Remove XML tags from output, preserve formatting                                                                                                                                                                                                                                                                                                                                                                                              |
| `inline`                             | Flag          | `inline`                                  | ✅   | ✅     | ❌           | Remove XML tags and render content inline                                                                                                                                                                                                                                                                                                                                                                                                     |
| `inline-with-tags`                   | Flag          | `inline-with-tags`                        | ✅   | ✅     | ❌           | Keep XML tags but render content inline                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Code Formatting Properties**       |               |                                           |      |        |              |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `code`                               | Flag          | `code`                                    | ✅   | ✅     | ❌           | Auto-detect language from file extension                                                                                                                                                                                                                                                                                                                                                                                                      |
| `code-language`                      | Flag          | `code-javascript`, `code-python`, etc.    | ✅   | ✅     | ❌           | Format as code block in specified language                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Heading Properties**               |               |                                           |      |        |              |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `h-[1-6]`                            | Flag          | `h-1` through `h-6`                       | ✅   | ✅     | ❌           | Format as heading of specified level                                                                                                                                                                                                                                                                                                                                                                                                          |
| `h-inc`                              | Flag          | `h-inc`                                   | ✅   | ✅     | ❌           | Increment heading level (demote)                                                                                                                                                                                                                                                                                                                                                                                                              |
| `h-dec`                              | Flag          | `h-dec`                                   | ✅   | ✅     | ❌           | Decrement heading level (promote)                                                                                                                                                                                                                                                                                                                                                                                                             |
| `h-same`                             | Flag          | `h-same`                                  | ✅   | ✅     | ❌           | Keep same heading level                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `h-initial`                          | Flag          | `h-initial`                               | ✅   | ✅     | ❌           | Replace first heading                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Numbering Properties**             |               |                                           |      |        |              |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `num`                                | Flag          | `num`                                     | ✅   | ✅     | ❌           | Enable default numbering                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `num-heading-first`                  | Flag          | `num-heading-first`                       | ✅   | ✅     | ❌           | Number first heading only                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `num-heading-last`                   | Flag          | `num-heading-last`                        | ✅   | ✅     | ❌           | Number last heading only                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `num-tag-first`                      | Flag          | `num-tag-first`                           | ✅   | ✅     | ❌           | Number first tag only                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `num-tag-last`                       | Flag          | `num-tag-last`                            | ✅   | ✅     | ❌           | Number last tag only                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Raw Notation Properties**          |               |                                           |      |        |              |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `process-content`                    | Flag          | `process-content`                         | ✅   | ✅     | ❌           | Used within `{{{...}}}` (raw notation) sections. When `process-content` is applied to such a section, the content _inside_ the raw block is compiled by Rulesets as if it were regular Rulesets content, while the outer `{{{sectionName}}}` and `{{{/sectionName}}}` are still rendered as raw. This is useful for selectively processing parts of a raw block, for example, to demonstrate a Rulesets feature that itself involves further compilation. |

**Note:** These properties are exclusively used within the import syntax, e.g., `{{> fileName#section }}`.

| **Import Scope** |||||||
| `#section` | Single section | `#section-name` | ❌ | ✅ | ❌ | Include specific section from import. |
| `#!section` | Single exclusion | `#!section-name` | ❌ | ✅ | ❌ | Exclude specific section from import. |
| `#(section1 !section2)` | Multiple sections | `#(section-a section-b)` | ❌ | ✅ | ❌ | Include/exclude multiple specific sections. |
| `#(destination:[section])` | Scoped section | `#(cursor:[section-a])` | ❌ | ✅ | ❌ | Destination-specific section inclusion. |
| **front matter Configuration** |||||||
| `rulesets.version` | YAML | `rulesets.version: 0.1.0` | ❌ | ❌ | ✅ | Rulesets format version for the file |
| `description` | YAML | `description: "Project rules"` | ❌ | ❌ | ✅ | Short description of the source rules |
| `name` | YAML | `name: my-rules` | ❌ | ❌ | ✅ | Unique identifier for the source rules (defaults to filename) |
| `version` | YAML | `version: 2.0` | ❌ | ❌ | ✅ | Version number for this source rules file |
| `labels` | YAML | `labels: ["core", "security"]` | ❌ | ❌ | ✅ | Categorization tags for the source rules |
| `globs` | YAML | `globs: ["**/*.{txt,md}"]` | ❌ | ❌ | ✅ | File patterns for tool-specific support |
| `destination.include` | YAML | `destination.include: ["cursor"]` | ❌ | ❌ | ✅ | List of destinations to include this source rules for |
| `destination.exclude` | YAML | `destination.exclude: ["claude-code"]` | ❌ | ❌ | ✅ | List of destinations to exclude this source rules from |
| `destination.path` | YAML | `destination.path: "./custom/path"` | ❌ | ❌ | ✅ | Custom output path for outputs |
| `allow-bare-xml-tags` | YAML | `allow-bare-xml-tags: true` | ❌ | ❌ | ✅ | Allow using bare XML tags |
| `[destination-id]` | YAML | `cursor: { ... }` | ❌ | ❌ | ✅ | Destination-specific configuration block |

#### Common Property Patterns and Languages

**Code Block Languages:**
Most common programming languages are supported using the `code-language` pattern, including: `code-javascript` (JavaScript), `code-typescript` (TypeScript), etc.

**Common Property Combinations:**

```markdown
<!-- Basic formatting properties -->

{{section unwrap}} <!-- Remove XML tags, keep block formatting -->
{{section inline}} <!-- Render inline without tags -->
{{section code-javascript unwrap}} <!-- JavaScript code block without XML wrapper -->

<!-- Destination scoping properties -->

{{section +cursor !windsurf}} <!-- Include for Cursor, exclude for Windsurf -->
{{section +ide:[code-javascript]}} <!-- Include for all IDE destinations with code-javascript formatting -->
{{section cursor:unwrap}} <!-- Apply unwrap only for Cursor -->

<!-- Import properties -->

{{> @mixin code-javascript}} <!-- Import mixin as JavaScript code block -->
{{> rule-file#(section-a !section-b)}} <!-- Import only section-a from file, exclude section-b -->
{{> rules#section cursor:[inline]}} <!-- Import rules#section with cursor-specific inline formatting -->
```

#### Property Extension Rules

1. **Prefixed Families**: Properties like `code-` and `h-` follow consistent naming with a prefix identifying the family.

2. **Parameter Values**: Properties requiring values use parentheses syntax: `name-("value")`.

3. **Destination Scoping**: Destination scoping follows the `destination:property` or `destination:[property1 property2]` pattern.

4. **Custom Attributes**: Any `key="value"` pair not matching a defined property is treated as a custom XML attribute. These attributes are passed through to the output XML tags:

   ```markdown
   {{rules data-id="123" role="example"}}
   Content with tags including the custom attributes
   {{/rules}}
   ```

   Renders as:

   ```xml
   <rules data-id="123" role="example">
   Content with tags including the custom attributes
   </rules>
   ```

   Note that when using `unwrap`, custom XML attributes won't appear in the output since the tags themselves are removed.

5. **Property Precedence**: When multiple properties might conflict, the last specified property takes precedence (left-to-right evaluation).

6. **front matter to Destination**: Destination-specific front matter (e.g., `cursor: { ... }`) overrides global values for that destination.

_© 2025 Rulesets contributors – MIT License._
