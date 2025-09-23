# Updated Option Notation for Mixdown

## Overview

This document proposes a more concise notation for Mixdown marker options and attributes, inspired by utility-first approaches to reduce typing while maintaining clarity. This updated notation replaces the verbose `key="value"` pattern with a direct and composable kebab-case format.

## Current Notation

The current approach for track options and attributes uses a verbose `key="value"` notation:

```markdown
{{instructions output="tag:omit"}}
Content without surrounding XML tags
{{/instructions}}

{{> @code-example output="code:javascript"}}
```

## Proposed Notation

With the proposed notation update, we can write the same examples more concisely:

```markdown
{{instructions tag-omit}}
Content without surrounding XML tags 
{{/instructions}}

{{> @code-example code-js}}
```

## Core Ideas

- **Direct Option Usage**: Options use a simple kebab-case format for better readability
- **Target Filtering**: Include with `+target`, exclude with `!target` (previously `-target`)
- **Scope Delimiter**: Colon (`:`) reserved as scope delimiter (e.g., `cursor:name-(value)`, `cursor:("Heading Title")`)
- **Composable**: Multiple options can be combined with spaces
- **Attribute Pass-through**: Unrecognized attributes are automatically included in XML output

## Option Mapping

Below are logical groupings of the updated notation, with examples from the current Mixdown specification.

### Output Format Options

| Current Notation | Proposed Notation | Description |
|-----------------|-------------------|-------------|
| `output="tag:omit"` | `tag-omit` | Remove XML tags |
| `output="inline"` | `inline` | Render content inline |
| `output="inline:tags"` | `inline-with-tags` | Inline with XML tags preserved |
| `output="raw:all"` | `raw-all` | Raw Mixdown notation |
| `output="raw:content"` | `raw-content` | Process markers, keep content raw |
| `output="raw:tags"` | `raw-tags` | Process content, keep markers raw |

### Code Block Options

| Current Notation | Proposed Notation | Description |
|-----------------|-------------------|-------------|
| `output="code:javascript"` | `code-js` | JavaScript code block |
| `output="code:python"` | `code-py` | Python code block |
| `output="code:ruby"` | `code-rb` | Ruby code block |
| `output="code:html"` | `code-html` | HTML code block |
| `output="code:css"` | `code-css` | CSS code block |

### Heading Options (h-* group)

| Current Notation | Proposed Notation | Description |
|-----------------|-------------------|-------------|
| `output="heading"` | `heading` | Add heading without tags (shortcut for `h-add tag-omit`) |
| `heading="1"` | `h-1` | Heading level 1 |
| `heading="2"` | `h-2` | Heading level 2 |
| `heading="3"` | `h-3` | Heading level 3 |
| `heading="4"` | `h-4` | Heading level 4 |
| `heading="5"` | `h-5` | Heading level 5 |
| `heading="6"` | `h-6` | Heading level 6 |
| `heading="inc"` | `h-inc` | Increment heading level |
| `heading="dec"` | `h-dec` | Decrement heading level |
| `heading="same"` | `h-same` | Same heading level |
| `heading="replace:first"` | `h-initial` | Replace first heading |

### Numbering Options (num-* group)

| Current Notation | Proposed Notation | Description |
|-----------------|-------------------|-------------|
| `numbering` | `num` | Enable numbering with defaults |
| `numbering="heading:before"` | `num-heading-before` | Numbering before heading |
| `numbering="heading:after"` | `num-heading-after` | Numbering after heading |
| `numbering="tag:before"` | `num-tag-before` | Numbering before tag |
| `numbering="tag:after"` | `num-tag-after` | Numbering after tag |

### Target Filtering

| Current Notation | Proposed Notation | Description |
|-----------------|-------------------|-------------|
| `+cursor` | `+cursor` | Include target (unchanged) |
| `-windsurf` | `!windsurf` | Exclude target |

### Named Tracks

| Current Notation | Proposed Notation | Description |
|-----------------|-------------------|-------------|
| `name="important_rules"` | `name-(important-rules)` | Named track (parens needed) |
| `tracks="included,!excluded"` | `tracks-(included,!excluded)` | Filter tracks in imports |

### Scoped Options

| Current Notation | Proposed Notation | Description |
|-----------------|-------------------|-------------|
| `cursor:name="value"` | `cursor:name-(value)` | Scoped option with value |
| `cursor:head="Heading Title"` | `cursor:("Heading Title")` | Scoped heading with quoted string |
| `cursor:[multiple,values]` | `cursor:[multiple,values]` | Scoped option with multiple values |
| `+cursor cursor?name="value"` | `+cursor:name-(value)` | Combined target inclusion with scope |
| `cursor?name="specific"` | `cursor:name-(specific)` | Target-scoped option |

### Custom Attributes

| Current Notation | Proposed Notation | Description |
|-----------------|-------------------|-------------|
| `my-custom-attr="value"` | `my-custom-attr="value"` | Custom attributes included in XML output |
| `\name="core_rules"` | `name="core_rules"` | No escape needed for basic attributes |

## Example Usage

### Multiple Options Example

```markdown
{{instructions "Important Rules" tag-omit}}
This content will appear without tags and have a custom heading
{{/instructions}}
```

### Heading Format Examples

```markdown
{{chapter h-2}}
Chapter content at heading level 2

{{section h-3}}
Section content at heading level 3
{{/section}}

{{section h-inc}}
Incrementally created section
{{/section}}
{{/chapter}}
```

This simplified notation replaces these verbose heading options:

```markdown
{{chapter heading="2"}}
{{section heading="3"}}
{{section heading="inc"}}
```

### Heading with Numbering

```markdown
{{chapter h-2 num}}
Chapter content (becomes "1. Chapter")

{{section h-3 num}}
Section content (becomes "1.1 Section")
{{/section}}
{{/chapter}}
```

Instead of:

```markdown
{{chapter heading="2" numbering="heading:before"}}
{{section heading="3" numbering="heading:before"}}
```

### Scoped Options Examples

For scoped options, use a colon for the scope, a dash, and parentheses for the value:

```markdown
{{instructions cursor:name-(cursor-instructions)}}
These are instructions specifically for Cursor
{{/instructions}}
```

For headings, use double quotes inside parentheses:

```markdown
{{instructions cursor:("Cursor Instructions")}}
These are instructions for Cursor with a heading
{{/instructions}}
```

For multiple values, use square brackets:

```markdown
{{instructions cursor:[option-one,option-two]}}
These are instructions for Cursor with multiple options
{{/instructions}}
```

### Target Filtering and Scope Combinations

Target inclusion can also be combined with scoped options compactly:

```markdown
{{instructions +cursor:name-(cursor-instructions)}}
These are instructions for Cursor with a cursor-specific name
{{/instructions}}
```

This would be equivalent to the current:

```markdown
{{instructions +cursor cursor?name="cursor_instructions"}}
These are instructions for Cursor with a cursor-specific name
{{/instructions}}
```

### Custom Attributes Pass-through

Any unrecognized attributes will be automatically included in XML output when rendered:

```markdown
{{instructions data-id="123" tag-omit}}
Content without tags (data-id doesn't appear)
{{/instructions}}

{{instructions data-id="123" role="example"}}
Content with tags including the custom attributes
{{/instructions}}
```

The second example would render as:

```xml
<instructions data-id="123" role="example">
Content with tags including the custom attributes
</instructions>
```

This eliminates the need for any special escape mechanism for preserving attributes.

### Quoted String Notation for Headings

The simplified quoted string notation:

````markdown
{{"Getting Started" h-2}}
This section explains how to get started.

{{"Installation" h-3}}
First, install the dependencies:

```bash
npm install
```
{{/"Installation"}}

{{"Configuration" h-3}}
Next, configure your environment...
{{/"Configuration"}}

{{/"Getting Started"}}
````

## Implementation Details

### Parser Integration

The parser would need to:

1. Identify options as any token after the track name
2. Categorize them based on pattern recognition:
   - Starting with `+` (but no `:`): Target inclusion
   - Starting with `+` and containing `:`: Scoped option for included target
   - Starting with `!`: Target exclusion 
   - Starting with `h-` followed by a number (1-6): Heading level
   - Starting with `h-`: Heading modifier
   - Starting with `num-`: Numbering directive
   - `num` by itself: Enable default numbering
   - Contains `=`: Key-value pair
   - Contains `:`: Scoped option (where text before `:` is the scope)
   - Otherwise: Simple option or custom attribute
3. Apply them in a deterministic order
4. Pass through unrecognized attributes to XML output when appropriate

## Side-by-Side Comparison with Actual Mixdown Options

| Use Case | Current Notation | Proposed Notation |
|----------|-----------------|-------------------|
| Remove XML tags | `{{track output="tag:omit"}}` | `{{track tag-omit}}` |
| JavaScript code block | `{{code output="code:javascript"}}` | `{{code code-js}}` |
| Named track | `{{track name="custom_name"}}` | `{{track name-(custom-name)}}` |
| Include for target | `{{track +cursor}}` | `{{track +cursor}}` |
| Exclude for target | `{{track -windsurf}}` | `{{track !windsurf}}` |
| Multiple options | `{{track output="code:js" name="example"}}` | `{{track code-js name-(example)}}` |
| Custom attribute | `{{track \name="core_rules"}}` | `{{track name-(core-rules)}}` |
| Import tracks filter | `{{> rules tracks="included,!excluded"}}` | `{{> rules tracks-(included,!excluded)}}` |
| Heading level | `{{section heading="2"}}` | `{{section h-2}}` |
| Combined target inclusion with scope | `{{track +cursor cursor?name="value"}}` | `{{track +cursor:name-(value)}}` |

## Real-world Example with Multiple Options

**Current notation:**

```markdown
{{instructions 
  output="tag:omit" 
  name="important_rules" 
  +cursor 
  -claude-code 
  cursor?name="cursor_specific"
  tracks="included,!excluded"}}
Content
{{/instructions}}
```

**Proposed notation:**

```markdown
{{instructions 
  tag-omit
  name="important_rules"
  +cursor
  !claude-code
  cursor:name-(cursor-specific)
  tracks-(included,!excluded)}}
Content
{{/instructions}}
```

**Further simplified notation:**

```markdown
{{instructions 
  tag-omit
  name="important_rules"
  +cursor:name-(cursor-specific)
  !claude-code
  tracks-(included,!excluded)}}
Content
{{/instructions}}
```

## Terminology Clarification

In Mixdown, we use these specific terms:

- **Marker options**: The general term for all configurable options that can be applied to markers
- **Track options**: Options specific to content tracks like `{{instructions}}` or `{{code}}`
- **Import options**: Options specific to imports like `{{> snippet}}`
- **Attributes**: Custom key-value pairs that pass through to the final XML output

This terminology better reflects how these settings function as customization choices rather than passive properties.

## Conclusion

This simplified option notation offers a more concise approach to managing Mixdown options and attributes. By adopting kebab-case for descriptive options, reserving the colon for scopes, and changing target exclusion to use `!` instead of `-`, we create a more intuitive and extensible notation.

The approach maintains compatibility with existing features while reducing the amount of typing required. For most common use cases, the character count reduction is significant, and the syntax becomes more visually intuitive.

The parser can reliably distinguish between different option types based on their format, making this approach both simple and unambiguous.