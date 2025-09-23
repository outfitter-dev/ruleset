# Auto-Closing Stems Proposal

## Overview

This document outlines a proposal for implementing "auto-closing stems" in Mixdown. Auto-closing stems would allow users to write sequential stem markers without explicitly closing previous ones. The compiler would automatically close stems in the appropriate order.

## Core Concept

In traditional XML and Mixdown's current implementation, explicit closing tags are required. With auto-closing stems, users could write:

```markdown
{{stem-1}}

Content for stem 1

{{stem-2}}

Content for stem 2

{{stem-3}}

Content for stem 3
```

The output would automatically add closing tags in last-in-first-out (LIFO) order:

```xml
<stem_1>
Content for stem 1

<stem_2>
Content for stem 2

<stem_3>
Content for stem 3
</stem_3>
</stem_2>
</stem_1>
```

## Benefits

1. **Reduced Typing**: Eliminates the need to type closing markers, saving time and reducing errors
2. **Cleaner Authoring**: Reduces visual clutter in the source document
3. **Natural Organization**: Matches how people naturally organize hierarchical content
4. **Readability**: Makes document structure more apparent at a glance

## Implementation Details

### 1. Stem Stack Management

The compiler would maintain a stack of open stems:

1. When a new `{{stem-name}}` marker is encountered, push it onto the stack
2. When an explicit closing `{{/stem-name}}` marker is encountered:
   - Pop the matching stem from the stack
   - Check that it matches the expected name (error if not)
3. At the end of the document:
   - Pop and close all remaining stems in the stack in reverse order

### 2. Stem Level Inference

The level/nesting of stems would be determined by their appearance in the document:

```markdown
{{outer-stem}}
Outer content

{{inner-stem}}
Inner content

{{deeper-stem}}
Deeper content
```

Would produce:

```xml
<outer_stem>
Outer content

<inner_stem>
Inner content

<deeper_stem>
Deeper content
</deeper_stem>
</inner_stem>
</outer_stem>
```

### 3. Mixed Explicit and Auto-Closing

Users should be able to mix explicit closing and auto-closing as needed:

```markdown
{{stem-1}}
Content

{{stem-2}}
More content
{{/stem-2}}

{{stem-3}}
Even more content
```

Would produce:

```xml
<stem_1>
Content

<stem_2>
More content
</stem_2>

<stem_3>
Even more content
</stem_3>
</stem_1>
```

### 4. End-of-File Behavior

At the end of the file, all open stems would be automatically closed in reverse order:

```markdown
{{stem-1}}
Content 1

{{stem-2}}
Content 2

{{stem-3}}
Content 3
```

Produces:

```xml
<stem_1>
Content 1

<stem_2>
Content 2

<stem_3>
Content 3
</stem_3>
</stem_2>
</stem_1>
```

### 5. Heading-Derived Stems

This feature would be particularly useful when combined with the heading-based output formats:

```markdown
{{stem-1 output="heading"}}
Content 1

{{stem-2 output="heading"}}
Content 2

{{stem-3 output="heading"}}
Content 3
```

Would produce:

```markdown
## Stem 1

Content 1

### Stem 2

Content 2

#### Stem 3

Content 3
```

## Considerations and Edge Cases

### 1. Explicit vs. Implicit Stem Closure

When an explicit closing tag is encountered, the compiler must ensure it matches the expected stem:

```markdown
{{stem-1}}
Content 1

{{stem-2}}
Content 2
{{/stem-1}} <!-- ERROR: Expected closing stem-2 -->
```

This would result in a compilation error because we expected `{{/stem-2}}`.

### 2. Auto-closing at Same Level

Special handling may be needed for stems at the same level:

```markdown
{{stem-1}}
Content 1

{{stem-2}}
Content 2

{{stem-3}}
Content 3
```

Properties:

- Close all previous stems (resulting in sequential stems)
- Only auto-close stems of the same level (allowing nesting)

Recommendation: Stem distinct levels, closing only when necessary to maintain proper nesting.

### 3. Self-Closing Tags vs. Auto-Closing Stems

It's important to distinguish between:

- **Self-closing tags**: `{{stem-name/}}` (a single tag with no content)
- **Auto-closing stems**: `{{stem-1}}...{{stem-2}}...` (stems closed by inference)

### 4. Property Inheritance

Consider whether properties should be inherited between adjacent auto-closed stems:

```markdown
{{stem-1 property="value"}}
Content 1

{{stem-2}}
Content 2
```

Properties:

- No inheritance (each stem has its own properties)
- Inherit non-conflicting properties from parent
- Inherit specifically marked properties

Recommendation: No inheritance by default, with an opt-in inheritance property.

### 5. Destination Filtering Implications

When stems are filtered out for specific targets, auto-closing needs to maintain proper structure:

```markdown
{{stem-1}}
Content 1

{{stem-2 -cursor}}
Content 2 (excluded for Cursor)

{{stem-3}}
Content 3
```

For Cursor, this would need to produce:

```xml
<stem_1>
Content 1

<stem_3>
Content 3
</stem_3>
</stem_1>
```

### 6. Indentation and Whitespace

Consider whether auto-closed sections should adjust indentation to reflect nesting level:

```markdown
{{stem-1}}
Content 1

{{stem-2}}
Content 2

    {{stem-3}}
    Content 3
```

Properties:

- Preserve original indentation (simpler)
- Adjust indentation to reflect nesting (more complex but potentially more readable)

Recommendation: Preserve original indentation to maintain maximum fidelity with source.

## Syntax Variations

### 1. Potential Auto-Close Marker

An alternative could be to provide a special notation that explicitly indicates auto-closing behavior:

```markdown
{{stem-1>}} <!-- '>' indicates this stem will close when another stem appears -->
Content 1

{{stem-2>}}
Content 2

{{stem-3}}
Content 3
```

### 2. Level Markers

Explicit level markers could be added:

```markdown
{{1:stem-1}} <!-- Level 1 -->
Content 1

{{2:stem-2}} <!-- Level 2 -->
Content 2

{{3:stem-3}} <!-- Level 3 -->
Content 3
```

## Implementation Recommendation

1. Implement auto-closing as an opt-in feature initially
2. Allow configuration via front matter or config with `auto-close: true|false`
3. Provide clear error messages when auto-closing creates ambiguous situations
4. Consider default level detection based on indentation
5. Maintain explicit LIFO ordering for auto-closing

## Usage Examples

### 1. Basic Auto-Closing

```markdown
---
mixdown:
  auto-close: true
---

{{stem-1}}
Content for stem 1

{{stem-2}}
Content for stem 2

{{stem-3}}
Content for stem 3
```

Output:

```xml
<stem_1>
Content for stem 1

<stem_2>
Content for stem 2

<stem_3>
Content for stem 3
</stem_3>
</stem_2>
</stem_1>
```

### 2. Mixed Explicit and Auto-Closing

```markdown
{{stem-1}}
Content 1

{{stem-2}}
Content 2
{{/stem-2}}

{{stem-3}}
Content 3
```

Output:

```xml
<stem_1>
Content 1

<stem_2>
Content 2
</stem_2>

<stem_3>
Content 3
</stem_3>
</stem_1>
```

### 3. With Heading Output Format

```markdown
{{section output="heading"}}
This is the main section.

{{subsection output="heading"}}
This is a subsection.

{{code-example}}
function example() {
console.log("Hello world");
}
{{/code-example}}

{{another-subsection output="heading"}}
This is another subsection.
```

Output:

```markdown
## Section

This is the main section.

### Subsection

This is a subsection.

<code_example>
function example() {
console.log("Hello world");
}
</code_example>

### Another Subsection

This is another subsection.

</section>
</subsection>
</another-subsection>
```

## Comparison with Self-Closing Tags

Auto-closing stems are different from self-closing tags, which should still be implemented separately:

1. **Self-closing tags** (`{{tag-name/}}`) represent an empty element with no content or children
2. **Auto-closing stems** represent the implied closing of a parent tag when a new sibling appears

Both features would be complementary within the Mixdown ecosystem.

## Conclusion

Auto-closing stems would provide a more intuitive and efficient way to author hierarchical content in Mixdown. The implementation would need careful consideration of edge cases, but would result in cleaner source documents with less redundancy.

This feature would be particularly valuable when:

- Creating deeply nested document structures
- Using heading-based output formats
- Rapidly authoring new content where exact nesting is still being determined
