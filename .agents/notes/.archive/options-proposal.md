# Comprehensive Options Proposal for Mixdown

## Implementation Plan

- **Goal:** Update the spec/overview.md document with the new options syntax below

### Implementation Checklist

To update the spec/overview.md document with the new options syntax, the following changes are needed:

1. **Update Track Marker Syntax** (Lines ~170-176, ~196-202)
   - [x] Replace `-target` with `!target` for exclusion throughout the document
     - [x] Change line 173: `{{instructions +cursor -claude-code}}` to `{{instructions +cursor !claude-code}}`
     - [x] Change line 196: `{{track-two +* -claude-code}}` to `{{track-two +* !claude-code}}`
     - [x] Update any other instances of `-target` in examples
   - [x] Update example explaining inclusion/exclusion patterns (line ~196-210)
   - [x] Add explanation of option ordering for inclusion/exclusion (based on new section in this proposal)

2. **Update Track Attribute Syntax** (Lines ~256-274, ~277-283)
   - [x] Replace `attribute="value"` syntax with new kebab-case option patterns
     - [x] Update lines ~256-266 to remove backslash `\` escape mechanism
     - [x] Change `\name="important_rules"` to `name(important-rules)` in examples
     - [x] Replace attribute declaration examples with new syntax
   - [x] Update Track Attributes table (lines ~277-283) 
     - [x] Remove the `\key` flag row or replace with explanation of direct XML attributes
     - [x] Add rows for structured prefixes (h-*, num-*, etc.)
     - [x] Change the `+/-target` to `+/!target` in the table

3. **Update Target-scoped Attributes** (Lines ~220-233)
   - [x] Replace `cursor?name="value"` with `cursor:name(value)` syntax 
     - [x] Update section at line ~220-233 to use colon instead of question mark
     - [x] Change `cursor?name="cursor_instructions"` to `cursor:name(cursor-instructions)`
   - [x] Add comprehensive examples for all scoping patterns:
     - [x] Single option scope: `target:option`
     - [x] Multiple option scope: `target:[option1 option2]`
     - [x] Inclusion with scope: `+target:option`
     - [x] Exclusion with scope: `!target:option`
     - [x] Group scoping: `+group:[options] !member`
   - [x] Document scope delimiter role (:) and its consistent usage
   - [x] Add explanation of target-scoped brackets for multiple options

4. **Update Output Format** (Lines ~286-347)
   - [x] Replace `output="tag:omit"` with direct `tag-omit` syntax
     - [x] Update all examples to use kebab-case options
     - [x] Line ~290: `{{instructions output="tag:omit"}}` → `{{instructions tag-omit}}`
     - [x] Line ~294: `{{> conventions#style-guide output="inline"}}` → `{{> conventions#style-guide inline}}`
     - [x] Line ~296: `{{> @code-example output="code:javascript"}}` → `{{> @code-example code-js}}`
   - [x] Update Output Attribute Values table (lines ~300-310)
     - [x] Replace `output="default"` with default behavior explanation
     - [x] Replace `output="inline"` with `inline`
     - [x] Replace `output="inline:tags"` with `inline-with-tags`
     - [x] Replace `output="tag:omit"` with `tag-omit`
     - [x] Replace `output="code[:language]"` with `code-*` family
     - [x] Replace `output="raw:all"` with `raw-all`
     - [x] Replace `output="raw:content"` with `raw-content`
     - [x] Replace `output="raw:tags"` with `raw-tags`
   - [x] Add detailed sections for option families:
     - [x] `code-*` family (with comprehensive list of language shortcuts)
     - [x] `h-*` family (with examples for all heading level options)
     - [x] `num-*` family (with examples for numbering options)
   - [x] Update line ~324-347 with new code block examples using `code-js`, etc.

5. **Add New Option Grouping Section** (after Output Format section)
   - [x] Create new section documenting square bracket syntax for option grouping
     - [x] Explain basic grouping: `{{rules [ option1 option2 option3 ]}}`
     - [x] Explain how grouped options behave the same as space-delimited options
     - [x] Document visual benefits of grouping complex combinations
   - [x] Add multi-line option examples
     - [x] Show how to format multi-line options for readability
     - [x] Explain whitespace handling within option groups
   - [x] Document option bracketing rules
     - [x] Explain that brackets cannot be nested
     - [x] Provide examples of valid vs. invalid bracketing
     - [x] Document target-scoped option brackets: `target:[option1 option2]`
   - [x] Add example patterns section with comprehensive examples of different option grouping patterns

6. **Update Import Filtering Syntax** (Lines ~498-507)
   - [x] Replace `tracks="included,!excluded"` with parentheses syntax
     - [x] Line ~501: `{{> my-rules tracks="track-name,!track-name-to-exclude"}}` → `{{> my-rules(+track-name !track-name-to-exclude)}}`
     - [x] Update lines ~513-521 examples with new parentheses syntax
   - [x] Add section on target-specific track filtering for imports
     - [x] Add examples of target-specific inclusion: `cursor:+track-name`
     - [x] Add examples of target-specific exclusion: `windsurf:!track-name`
     - [x] Document how multiple target filters can be combined
   - [x] Update Import Attributes section (line ~499-507) to reflect new syntax

7. **Update Comprehensive Attribute Reference Table** (Lines ~712-737)
   - [x] Update the entire table with new syntax
     - [x] Replace all `output="value"` entries with kebab-case options
     - [x] Remove backslash escape mechanism entries
     - [x] Add prefix family options (h-*, num-*, etc.)
     - [x] Change target filter notation from `+/-target` to `+/!target`
     - [x] Update examples to use new syntax patterns
   - [x] Add new rows for option grouping syntax
   - [x] Update the "Notes" section below the table
     - [x] Change target-scoped attribute explanation from `?` to `:`
     - [x] Update explanation of custom XML attribute preservation

8. **Global Changes and Consistency Check**
   - [x] Search for all instances of `-target` and replace with `!target`
   - [x] Search for all instances of `output="..."` and replace with kebab-case equivalents
   - [x] Search for all instances of `cursor?...` or any target-scoped attributes and update to use colon
   - [x] Verify all code examples consistently use the new syntax
   - [x] Update "Notation Reference" section (line ~157) if necessary to reflect new syntax
   - [x] Check TOC and ensure all new sections are properly reflected

## Overview

This document proposes a comprehensive approach to Mixdown options, designed to solve the most common usability issues faced when creating rule files. Building on the kebab-case notation introduced in the simplified-option-syntax proposal, this approach focuses on intuitive option discovery, consistent naming patterns, and ergonomic composability.

## Core Principles

1. **Intuitive Discovery** - Options should follow predictable patterns to enable users to guess what they need
2. **Visual Economy** - Reduce typing while maintaining clarity and meaning
3. **Consistency** - Apply uniform naming patterns across all option types
4. **Progressive Enhancement** - Support both simple common cases and complex advanced cases
5. **Separation of Concerns** - Group options logically by their purpose and effect
6. **Composability** - Options should combine elegantly without interference

This proposal builds upon and replaces the simplified approach outlined in the simplified-option-syntax.md document, incorporating a more structured and comprehensive system while maintaining the same core benefits of simplicity and intuitiveness.

## Delimiter Roles

The Mixdown options syntax follows strict delimiter rules to maintain consistency and clarity:

| Delimiter | Role | Example | Purpose |
|-----------|------|---------|---------| 
| `:` | Scope indicator | `target:code-js` | Indicates that options are scoped to a specific target |
| `()` | Value container | `name(value)` | Contains values for a specific option |
| `[]` | Option grouping | `target:[option-1 option-2]` | Groups multiple options within a scope |
| `+` | Inclusion | `+target`, `+track-one` | Indicates inclusion of a target or track |
| `!` | Exclusion | `!target`, `!track-two` | Indicates exclusion of a target or track |

These delimiters always maintain their role throughout the syntax, making the language more intuitive and easier to learn.

### Option Order

Options are processed in left-to-right order. This is particularly important for inclusion/exclusion modifiers, where the order determines the final result. For example:

```markdown
{{rules +cursor !cursor:option}}
```

Here, the track is first included for cursor, then a cursor-specific exclusion is applied with an option.

## Key Challenges Addressed

From the perspective of authors writing mix files:

1. **Memorability** - Too many option names make it hard to remember the exact syntax
2. **Discoverability** - Option usage isn't obvious without documentation
3. **Verbosity** - The current syntax is needlessly verbose for common operations
4. **Inconsistency** - Similar concepts use different notation patterns
5. **Cognitive Load** - Complex rules with many options become difficult to read
6. **Target Management** - Options specific to certain tools can be cumbersome to specify

## Proposed Option System

### 1. Structured Prefixes

All options follow a consistent prefix pattern for categorization:

| Prefix   | Purpose            | Examples                        |
|----------|--------------------|---------------------------------|
| (none)   | Direct operations  | `tag-omit`, `inline`, `code-js` |
| `h-`     | Heading related    | `h-2`, `h-inc`, `h-dec`         |
| `num-`   | Numbering related  | `num`, `num-tag-first`         |
| `+`      | Target inclusion   | `+cursor`, `+all`               |
| `!`      | Target exclusion   | `!windsurf`, `!claude-code`     |

### 2. Value Specification Patterns

| Pattern          | Format                 | Example                              | Use Case                                                   |
|------------------|------------------------|--------------------------------------|----------------------------------------------------------|
| Simple Flag      | `option-name`          | `tag-omit`                           | Boolean operations                                         |
| Enumerated Value | `option-value`         | `h-2`, `code-js`                     | Fixed value choices                                        |
| Named Value      | `option(value)`        | `name(rules)`, `name(Custom Title)`  | String values with special chars/spaces                    |
| List Value       | `option(+item1 !item2)` | `(+track-one !track-two target:+option)`           | Collections or inclusion/exclusion lists (space-delimited) |
| Target-scoped    | `target:option`        | `target:option(value)`              | Target-specific options (scope:option pattern)             |

### 3. Option Categories & Examples

#### Display Options

| Option                | Description                | Example                              |
|-----------------------|----------------------------|--------------------------------------|
| `tag-omit`            | Remove XML tags            | `{{rules tag-omit}}`          |
| `inline`              | Render content inline      | `{{rules inline}}`                    |
| `inline-with-tags`    | Inline with XML tags       | `{{rules inline-with-tags}}`         |
| `raw-all`             | Preserve Mixdown notation  | `{{rules raw-all}}`                |
| `raw-content`         | Preserve content notation  | `{{rules raw-content}}`               |
| `raw-tags`            | Preserve tag notation      | `{{rules raw-tags}}`                 |

#### Code Block Options

| Option                | Description                | Example                              |
|-----------------------|----------------------------|--------------------------------------|
| `code-auto`           | Auto-detect language       | `{{rules code}}`                 |
| `code-<language>`             | Language-specified code block      | `{{rules code-js}}` |

#### Heading Options (h-* family)

| Option                | Description                | Example                              |
|-----------------------|----------------------------|--------------------------------------|
| `h-1` to `h-6`        | Heading levels 1-6         | `{{rules h-2}}`                    |
| `h-inc`               | Increment heading level    | `{{rules h-inc}}`                  |
| `h-dec`               | Decrement heading level    | `{{rules h-dec}}`                  |
| `h-same`              | Same heading level         | `{{rules h-same}}`                 |
| `h-initial`           | Replace first heading      | `{{rules h-initial}}`              |
| `heading`             | Add heading (shortcut)     | `{{rules heading}}`                |

#### Heading Shortcut

For convenience, you can use a string as the first item in a track to automatically create a heading:

```markdown
{{section "Section Name" h-3}}
Section content goes here.
{{/section}}
```

This is equivalent to specifying the heading within the content but provides a more visible and consolidated way to name sections.

#### Numbering Options (num-* family)

| Option                | Description                | Example                              |
|-----------------------|----------------------------|--------------------------------------|
| `num`                 | Enable default numbering   | `{{chapter num}}`                    |
| `num-heading-first`  | Number first heading      | `{{rules num-heading-first}}`     |
| `num-heading-last`   | Number last heading       | `{{rules num-heading-last}}`      |
| `num-tag-first`      | Number first tag          | `{{rules num-tag-first}}`         |
| `num-tag-last`       | Number last tag           | `{{rules num-tag-last}}`          |


#### Target Management

| Option      | Description                                              | Example                  |
|-------------|----------------------------------------------------------|--------------------------| 
| `+target`   | Include only for target                                  | `{{rules +target}}`      |
| `!target`   | Exclude only for target                                  | `{{rules !target}}`      |
| `+all`      | Include for all targets                                  | `{{rules +all}}`         |
| `+group`    | Include for IDE group, exclude specific member of group  | `{{rules +group !member}}`|

#### Named Values, Lists, and Target Groups

| Option                         | Description                 | Example                                     |
|-------------------------------|-----------------------------|---------------------------------------------|
| `name(important-rules)`      | Rename the track (useful for imports)              | `{{> rules name(important-rules)}}`          |
| `{{> imported-rules(+item1 !item2)}}`               | Filter imported tracks (import markers) | `{{> my-rules(+included cursor:+also !excluded)}}`        |
| `+cursor[name(Custom Title)]`| Target-scoped override      | `{{rules +cursor[name(Custom Title)]}}`  |

#### Custom XML Attributes

Any option written in the standard `attribute="value"` format that isn't recognized as a special option will be passed through to the XML tag untouched:

```markdown
{{rules data-id="123" role="example"}}
Content with tags including the custom attributes
{{/rules}}
```

This would render as:

```xml
<rules data-id="123" role="example">
Content with tags including the custom attributes
</rules>
```

The tag-omit option affects how custom attributes are rendered:

```markdown
{{instructions data-id="123" tag-omit}}
Content without tags (data-id doesn't appear)
{{/instructions}}

{{instructions data-id="123" role="example"}}
Content with tags including the custom attributes
{{/instructions}}
```

The first example renders without tags, so the custom attributes don't appear. The second example includes the tags with all custom attributes.

This approach eliminates the need for any special escape mechanism for preserving custom attributes, making the syntax more intuitive and consistent.

### 4. Grouping Options

By default, options are space-delimited. You can optionally wrap a list of options in square brackets for visual grouping:

```markdown
{{rules [ tag-omit code-js +cursor name(important-rules) ]}}
...
{{/rules}}
```

All options inside `[...]` behave exactly the same as if they were space-delimited:

```markdown
{{rules [ tag-omit code-js name(rules) +cursor ]}}  # equivalent to {{rules tag-omit code-js name(rules) +cursor}}
```

For target-scoped options, use a colon followed by multiple options in brackets to indicate scope:

```markdown
{{rules +cursor:[name(cursor-rules) code-js] !claude-code }}
```

Here, `name(cursor-rules)` and `code-js` apply only when building for the `cursor` target. The colon indicates that what follows is scoped to the target.

#### Multi-line grouping

```markdown
{{rules [
  tag-omit
  code-js
  name(rules)
  +cursor
  ]}}
```

#### Options Bracketing Rules

Options groups (brackets) cannot be nested. All options within a group must be space-delimited and cannot themselves contain another options group.

For a single target-specific option, you can use the colon syntax without brackets:

```markdown
{{rules target:code-js}}
```

This applies the `code-js` option only for the specified target. The block is still included for all valid targets.

If you need to specify multiple options for a target, use brackets after the colon:

```markdown
{{rules target:[code-js name(target-rules)]}}
```

Important nesting rule: You cannot nest option groups within other option groups. Instead, keep them as separate groups:

```markdown
{{rules [code-js tag-omit target:[option-a option-b]]}}  # ❌ Invalid, nested options groups
{{rules [code-js tag-omit] target:[option-a option-b]}}  # ✅ Valid, separate option groups
```

### Target Option Invocation Patterns

There are three primary ways to use targets as options:

1. **Target-Scoped Options (No Inclusion/Exclusion)**
   - **Single Option:** `target:option` (no brackets required)
   - **Multiple Options:** `target:[option-1 option-2]` (brackets required after colon)
   - **Behavior:** The options apply only when building for the specified target, but the block is included for all valid targets.
   - **Examples:**  

     ```markdown
     {{rules target:code-js}}
     {{rules target:[code-js tag-omit]}}
     ```

     The first applies `code-js` only for the specified target. The second applies both `code-js` and `tag-omit` for the specified target.

2. **Target Inclusion/Exclusion**
   - **Single Option:** `+target:option` or `!target:option`
   - **Multiple Options:** `+target:[option-1 option-2]` or `!target:[option-1 option-2]`
   - **Behavior:** The block is included or excluded for the specified target(s). Options in brackets or after the colon apply only for the included/excluded target.
   - **Examples:**  

     ```markdown
     {{rules +cursor:code-js}}
     {{rules +cursor:[code-js tag-omit]}}
     ```

     The first includes the block only for the `cursor` target, applying `code-js` as an option. The second includes the block for `cursor` with both options.

3. **Group Inclusion/Exclusion with Member Override**
   - **Syntax:** `+group:[options] !member`
   - **Behavior:** The block is included for all members of the group, with the specified options, but excluded for a specific member.
   - **Example:**  

     ```markdown
     {{rules +group:[code-js] !member}}
     ```

     This includes the block for all in `group` with `code-js`, but excludes it for `member`.

#### Summary Table

| Pattern                  | Example                                 | Description                                 |
|--------------------------|-----------------------------------------|---------------------------------------------|
| Single target option     | `target:code-js`                        | One option for a target, no brackets needed |
| Multiple target options  | `target:[code-js tag-omit]`             | Multiple options, brackets after colon      |
| Single inclusion option  | `+cursor:code-js`                       | Include for target only, one option         |
| Multiple inclusion opts  | `+cursor:[code-js tag-omit]`            | Include for target only, multiple options   |

### Example Patterns

```markdown
{{rules target:code-js}}                          # Single target option, included for all
{{rules target:[code-js tag-omit]}}               # Multiple target options, included for all
{{rules +cursor:code-js}}                         # Included for cursor only, with single option
{{rules +cursor:[code-js tag-omit]}}              # Included for cursor only, with multiple options
{{rules +group:[code-js] !member}}                # Included for group, excluded for member
```

## Import Track Filtering

### Current Approach

The current approach for filtering tracks when importing from other mix files uses a verbose attribute syntax:

```markdown
{{> my-rules tracks="included-track,!excluded-track"}}

<!-- This would include only the 'included-track'
     from my-rules.md, but exclude 'excluded-track' -->
```

### Proposed Approach

The new approach simplifies this by using parentheses directly after the import name, creating a more intuitive and concise syntax:

```markdown
{{> my-rules(+track-one !track-two)}}
```

This pattern:

- Uses space-delimited values within parentheses
- Prefixes included tracks with `+` and excluded tracks with `!` (consistent with target inclusion/exclusion)
- Eliminates the need for the verbose `tracks="..."` attribute
- Follows a more natural language-like structure: "import my-rules, but only these specific tracks"

#### Basic Examples

```markdown
{{> style-guide(+track-one !track-two)}}
<!-- Only include 'track-one' track from style-guide, exclude 'track-two' -->

{{> project-setup(!track-two)}} 
<!-- Include all tracks from project-setup except 'track-two' -->

{{> comprehensive-guide(+track-one +track-two !track-three)}}
<!-- Include only 'track-one' and 'track-two' tracks, exclude 'track-three' -->
```

#### Target-Specific Track Filtering

The parentheses syntax also supports target-specific track inclusion and exclusion, allowing for powerful conditional imports:

```markdown
{{> my-rules(+track-one cursor:+track-cursor windsurf:!track-windsurf)}}
```

This advanced pattern:

- Includes "track-one" for all targets
- Additionally includes "track-cursor" only when building for the cursor target
- Excludes "track-windsurf" only when building for the windsurf target

```markdown
{{> project-setup(+core-track ide:+ide-features cli:+cli-features)}}
<!-- Include 'core-track' for all targets, plus target-specific tracks -->

{{> style-guide(+common-track cursor:+cursor-specific !legacy-track windsurf:!beta-features)}}
<!-- Complex filtering with both global and target-specific inclusions/exclusions -->
```

This combines the track filtering approach with target-specific options into a unified syntax that handles complex conditional inclusion patterns elegantly.

### Benefits

- **More Intuitive**: The parentheses immediately after the import target clearly indicate filtering
- **More Concise**: Eliminates the verbose `tracks="..."` attribute
- **Visual Clarity**: Creates a clear visual pattern that's easier to scan and understand
- **Consistency**: Uses the same `+` for inclusion and `!` for exclusion as used in target filtering
- **Target-Specific Control**: Enables fine-grained per-target track filtering
- **Unified Pattern**: Uses the same `target:option` pattern established for other options

This simplified yet powerful approach reduces cognitive load when writing imports while enabling complex conditional inclusion patterns through a single unified syntax.

## Terminology

In Mixdown, we use these specific terms:

- **Track options**: Options applied to content tracks like `{{instructions}}` or `{{code}}`
- **Import-specific options**: Options that only apply to imports like `{{> snippet}}`

This terminology clearly separates the different types of options based on where they can be applied.