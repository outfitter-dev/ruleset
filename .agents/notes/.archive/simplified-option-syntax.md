# Simplified Syntax for Mixdown Options

## Current Approach

The current approach for track options uses a verbose `key="value"` syntax:

```markdown
{{instructions output="tag:omit"}}
Content without surrounding XML tags
{{/instructions}}

{{> @code-example output="code:javascript"}}
```

## Proposed Tailwind-inspired Approach

We can adopt a more concise, Tailwind-like approach for marker options:

```markdown
{{instructions tag-omit}}
Content without surrounding XML tags 
{{/instructions}}

{{> @code-example code-js}}
```

## Core Ideas

- **Direct Option Usage**: Descriptive options use a simple kebab-case format
- **Target Filtering**: Include with `+target`, exclude with `!target` (prev. `-target`)
- **Scope Delimiter**: Colon (`:`) reserved as scope delimiter (e.g., `cursor:name-(value)`, `cursor:("Heading Title")`, `cursor:[multiple,values]`)
- **Composable**: Multiple options can be combined with spaces
- **Custom Options Pass-through**: Unrecognized options automatically included in XML output

## Option Mapping Examples

Based on the actual options in the Mixdown specification:

| Current Syntax | Proposed Syntax | Description |
|---------------|-----------------|-------------|
| `output="tag:omit"` | `tag-omit` | Remove XML tags |
| `output="inline"` | `inline` | Render content inline |
| `output="inline:tags"` | `inline-with-tags` | Inline with XML tags preserved |
| `output="code:javascript"` | `code-js` | JavaScript code block |
| `output="code:python"` | `code-py` | Python code block |
| `output="raw:all"` | `raw-all` | Raw Mixdown notation |
| `output="raw:content"` | `raw-content` | Process markers, keep content raw |
| `name="important_rules"` | `name-(important-rules)` | Named track (parens needed) |
| `tracks="included,!excluded"` | `tracks-(included,!excluded)` | Filter tracks in imports |
| `-windsurf` | `!windsurf` | Exclude target |
| `+cursor` | `+cursor` | Include target (unchanged) |
| `output="heading"` | `heading` | Add heading without tags (shortcut for `h-add tag-omit`) |
| `heading="2"` | `h-2` | Heading level 2 |
| `heading="inc"` | `h-inc` | Increment heading level |
| `heading="dec"` | `h-dec` | Decrement heading level |
| `heading="same"` | `h-same` | Same heading level |
| `heading="replace:first"` | `h-initial` | Replace first heading in the content with the new heading |
| `numbering` | `numbering` | Enable numbering with defaults |
| `numbering="heading:before"` | `num-heading-before` | Numbering before heading |
| `my-custom-attr="value"` | `my-custom-attr="value"` | Custom options included in XML output |
| `cursor:name="value"` | `cursor:name-(value)` | Scoped option with value |
| `cursor:head="Heading Title"` | `cursor:("Heading Title")` | Scoped heading with quoted string |
| `cursor:[multiple,values]` | `cursor:[multiple,values]` | Scoped option with multiple values |

## Multiple Options Example

```markdown
{{instructions "Important Rules" tag-omit}}
This content will appear without tags and have a custom heading
{{/instructions}}
```

## Format-Specific Options

### Heading Format

Using the heading output format with the simplified syntax:

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

This simplified syntax replaces all of these verbose heading options:

```markdown
{{chapter heading="2"}}
{{section heading="3"}}
{{section heading="inc"}}
```

The `heading` shortcut option combines `h-add` and `tag-omit` to quickly add a heading without XML tags:

```markdown
{{chapter heading}}
Chapter with a heading, no XML tags
{{/chapter}}
```

### Heading with Numbering

Simplified syntax for numbered headings:

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

### Heading Placement Options

Control how numbering appears with simplified directives:

```markdown
{{section h-3 num-heading-before}}   <!-- 1. Section -->
{{section h-3 num-heading-after}}    <!-- Section 1 -->
{{section h-3 num-tag-before}}    <!-- <1_section> -->
{{section h-3 num-tag-after}}     <!-- <section_1> -->
```

Instead of:

```markdown
{{section heading="3" numbering="heading:before"}}
{{section heading="3" numbering="heading:after"}}
{{section heading="3" numbering="tag:before"}}
{{section heading="3" numbering="tag:after"}}
```

### Scoped Options

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

This replaces the previous syntax using quotes:

```markdown
{{instructions cursor:name="cursor_instructions"}}
```

The colon pattern is reserved for scope delimiting, making it:
- Clear that `cursor` is the scope
- Extensible to future scope types
- Consistent with common programming patterns

### Target Filtering and Scope Combinations

Target inclusion can also be combined with scoped options compactly:

```markdown
{{instructions +cursor:name-(cursor_instructions)}}
These are instructions for Cursor with a cursor-specific name
{{/instructions}}
```

This would be equivalent to the current:

```markdown
{{instructions +cursor cursor?name="cursor_instructions"}}
These are instructions for Cursor with a cursor-specific name
{{/instructions}}
```

Note: For target exclusion with `!target`, there's generally no need for additional options since the content is being excluded entirely for that target.

### Custom Options Pass-through

Any unrecognized options will be automatically included in XML output when rendered:

```markdown
{{instructions data-id="123" tag-omit}}
Content without tags (data-id doesn't appear)
{{/instructions}}

{{instructions data-id="123" role="example"}}
Content with tags including the custom options
{{/instructions}}
```

The second example would render as:

```xml
<instructions data-id="123" role="example">
Content with tags including the custom options
</instructions>
```

This eliminates the need for any special escape mechanism for preserving options.

## Implementation Details

### Parser Integration

The parser would need to:

1. Identify options as any token after the track name
2. Categorize them based on pattern recognition:
   - Starting with `+` (but no `:`): Target inclusion
   - Starting with `+` and containing `:`: Scoped option for included target
   - Starting with `!`: Target exclusion 
   - Starting with `heading-` followed by a number (1-6): Heading level
   - Starting with `heading-`: Heading modifier
   - Starting with `num-`: Numbering directive
   - `num` by itself: Enable default numbering
   - Contains `=`: Key-value pair
   - Contains `:`: Scoped option (where text before `:` is the scope)
   - Otherwise: Simple option or custom option
3. Apply them in a deterministic order
4. Pass through unrecognized options to XML output when appropriate

## Side-by-Side Comparison with Actual Mixdown Options

| Use Case | Current Syntax | Proposed Syntax |
|----------|---------------|-----------------|
| Remove XML tags | `{{track output="tag:omit"}}` | `{{track tag-omit}}` |
| JavaScript code block | `{{code output="code:javascript"}}` | `{{code code-js}}` |
| Named track | `{{track name="custom_name"}}` | `{{track name-(custom-name)}}` |
| Include for target | `{{track +cursor}}` | `{{track +cursor}}` |
| Exclude for target | `{{track -windsurf}}` | `{{track !windsurf}}` |
| Multiple options | `{{track output="code:js" name="example"}}` | `{{track code-js name-(example)}}` |
| Custom option | `{{track \name="core_rules"}}` | `{{track name-(core-rules)}}` |
| Import tracks filter | `{{> rules tracks="included,!excluded"}}` | `{{> rules tracks-(included,!excluded)}}` |
| Target-scoped option | `{{track cursor?name="specific"}}` | `{{track cursor:name-(specific)}}` |
| Heading level | `{{section heading="2"}}` | `{{section h-2}}` |
| Combined target inclusion with scope | `{{track +cursor cursor?name="value"}}` | `{{track +cursor:name-(value)}}` |

## Examples from the Mixdown Spec

### Current Syntax (from spec)

```markdown
{{instructions \name="core_rules" +cursor -windsurf}}
All code must follow consistent formatting.

Testing is required for all new features.
{{/instructions}}
```

### Proposed Syntax

```markdown
{{instructions name="core_rules" +cursor !windsurf}}
All code must follow consistent formatting.

Testing is required for all new features.
{{/instructions}}
```

### Real-world Example with Multiple Options

**Current syntax:**

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

**Proposed syntax:**

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

**Further simplified syntax:**

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

### Quoted String Syntax for Headings

The simplified quoted string syntax with proposed option mapping:

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

{{/"Getting Started"}
````

## Comprehensive Format Option Table

| Current Format Option | Proposed Option | Description |
|--------------------------|-------------------|-------------|
| `output="tag:omit"` | `tag-omit` | Remove XML tags |
| `output="inline"` | `inline` | Render content inline |
| `output="inline:tags"` | `inline-with-tags` | Inline with XML tags preserved |
| `output="code:javascript"` | `code-js` | JavaScript code block |
| `output="code:python"` | `code-py` | Python code block |
| `output="code:ruby"` | `code-rb` | Ruby code block |
| `output="code:html"` | `code-html` | HTML code block |
| `output="code:css"` | `code-css` | CSS code block |
| `output="raw:all"` | `raw-all` | Raw Mixdown notation |
| `output="raw:content"` | `raw-content` | Process markers, keep content raw |
| `output="raw:tags"` | `raw-tags` | Process content, keep markers raw |
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
| `numbering="heading:before"` | `num-heading-before` | Numbering before heading |
| `numbering="heading:after"` | `num-heading-after` | Numbering after heading |
| `numbering="tag:before"` | `num-tag-before` | Numbering before tag |
| `numbering="tag:after"` | `num-tag-after` | Numbering after tag |
| `numbering` | `num` | Enable numbering with defaults |

## Terminology Clarification

In Mixdown, we use these specific terms:

- **Marker options**: The general term for all configurable options that can be applied to markers
- **Track options**: Options specific to content tracks like `{{instructions}}` or `{{code}}`
- **Import options**: Options specific to imports like `{{> snippet}}`

This terminology better reflects how these settings function as customization choices rather than passive properties.

## Conclusion

This simplified Tailwind-inspired syntax offers a more concise approach to managing Mixdown options. By adopting kebab-case for descriptive options, reserving the colon for scopes, and changing target exclusion to use `!` instead of `-`, we create a more intuitive and extensible syntax.

The approach maintains compatibility with existing features while reducing the amount of typing required. For most common use cases, the character count reduction is significant, and the syntax becomes more visually intuitive.

The parser can reliably distinguish between different option types based on their format, making this approach both simple and unambiguous.