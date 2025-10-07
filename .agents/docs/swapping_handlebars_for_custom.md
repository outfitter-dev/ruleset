# Custom Delimiter Configuration for Slots

## Overview

Ruleset v0.4.0 uses `[[ ]]` double bracket syntax for slots by default. However, this syntax may conflict with other tools or user preferences (e.g., Obsidian wikilinks use `[[ ]]`). This document explores configurable delimiter support to allow users to choose their preferred syntax.

## Rationale

### Why Drop Handlebars?

Handlebars was considered for v0.2.0 but never implemented. The v0.4.0 rewrite introduces native slots & variables with custom delimiters instead. Benefits:

1. **No external dependency** - Simpler, faster, more maintainable
2. **Configurable syntax** - Users choose delimiters that work for their ecosystem
3. **Better error messages** - We control the parser completely
4. **Security by design** - No arbitrary code execution risks
5. **Predictable behavior** - No Handlebars quirks or version drift

### Why Allow Custom Delimiters?

**Conflict scenarios:**
- **Obsidian users**: `[[ page-name ]]` is wikilink syntax
- **Math notation**: `[[ x, y ]]` denotes closed intervals
- **Existing conventions**: Teams may have established `{{ }}` or other patterns
- **Tool compatibility**: Some markdown processors may treat `[[ ]]` specially

**Solution:** Let users configure their preferred delimiter pair.

## Supported Delimiters

### Default: `[[ ]]` (Double Brackets)

```markdown
[[ $project.name ]]
[[ @_typescript.md ]]
[[ team-contact ]]
```

**Why default?**
- Visually distinct from code blocks and inline code
- Not commonly used in markdown (unlike `{{ }}` in templates)
- Easy to type
- Works in most markdown previewers

### Alternative: `{{ }}` (Double Braces)

```markdown
{{ $project.name }}
{{ @_typescript.md }}
{{ team-contact }}
```

**Use cases:**
- Teams migrating from Handlebars/Mustache
- Familiar to developers with templating experience
- Preferred syntax for some users

### Alternative: `%% %%` (Double Percent)

```markdown
%% $project.name %%
%% @_typescript.md %%
%% team-contact %%
```

**Use cases:**
- Obsidian users (Obsidian comments use `%% %%`)
- Less visual noise than brackets/braces
- Distinct from other markdown syntax

### Not Supported: `$$ $$` (Double Dollar)

**Reason:** Conflicts with LaTeX math notation in markdown:
```markdown
$$ E = mc^2 $$  <!-- Math block -->
```

Using `$$` for slots would break mathematical content.

### Not Supported: Custom/Arbitrary Delimiters

**Reason:** Parser complexity and security concerns.

We limit to a curated set of delimiters that:
- Are symmetric pairs
- Don't conflict with core markdown syntax
- Can be reliably parsed without ambiguity
- Are visually distinct enough to avoid confusion

## Escaping with Triple Delimiters

Users can escape slot syntax by using **triple delimiters**:

```markdown
<!-- Default [[ ]] syntax -->
[[ $project.name ]]           <!-- Processed as slot -->
[[[ $project.name ]]]         <!-- Literal: "[[ $project.name ]]" -->

<!-- Alternative {{ }} syntax -->
{{ $project.name }}           <!-- Processed as slot -->
{{{ $project.name }}}         <!-- Literal: "{{ $project.name }}" -->

<!-- Alternative %% %% syntax -->
%% $project.name %%           <!-- Processed as slot -->
%%% $project.name %%%         <!-- Literal: "%% $project.name %%" -->
```

**Triple delimiter behavior:**
- Strips the outer delimiters
- Preserves the inner content literally (no slot processing)
- Useful for documentation and examples

## Configuration

### Project-Level Configuration

```yaml
# .rules/config.yaml (default)
# or .agents/rules/config.yaml (alternative)
slots:
  delimiter: "{{ }}"  # Options: "[[ ]]", "{{ }}", "%% %%"
```

### File-Level Override

```yaml
---
ruleset:
  version: 0.4.0
  delimiter: "%% %%"  # Override project default for this file
---

%% $project.name %%
```

### Global User Configuration

```yaml
# ~/.config/rulesets/config.yaml
slots:
  delimiter: "{{ }}"  # User's preferred default
```

**Priority:**
1. File front matter (`ruleset.delimiter`)
2. Project config (`.rules/config.yaml` or `.agents/rules/config.yaml`)
3. User config (`~/.config/rulesets/config.yaml`)
4. Default (`[[ ]]`)

## Scope Restrictions

**Delimiters only apply to rule source files:**
- `.rules/src/**/*.md` (default)
- `.agents/rules/src/**/*.md` (alternative)
- `<custom-path>/rules/src/**/*.md` (advanced)
- Any file explicitly compiled by Ruleset

**Delimiters DO NOT apply to:**
- Compiled output files in `.rules/dist/<provider>/`
- Final output files (`.cursor/rules/*.mdc`, `CLAUDE.md`, etc.)
- Documentation files outside rules directories
- User's source code files (unless explicitly imported)
- README.md, CHANGELOG.md, etc.

**Rationale:** Only process files intended as Ruleset sources to avoid false positives.

## Parser Implementation Considerations

### Delimiter Detection

```typescript
interface DelimiterPair {
  open: string;   // e.g., "[["
  close: string;  // e.g., "]]"
}

const SUPPORTED_DELIMITERS: Record<string, DelimiterPair> = {
  'brackets': { open: '[[', close: ']]' },
  'braces':   { open: '{{', close: '}}' },
  'percent':  { open: '%%', close: '%%' },
};
```

### Parsing Logic

1. **Load configuration** to determine active delimiter
2. **Scan content** for delimiter pairs
3. **Check for triple delimiters** (escape sequences)
4. **Parse slot content** between delimiters
5. **Resolve** imports, variables, or named slots
6. **Replace** slot with resolved content

### Edge Cases

**Nested delimiters:**
```markdown
[[ $user.[[ $role ]] ]]  <!-- NOT SUPPORTED -->
```
**Rationale:** Ambiguous parse behavior. Use composition instead:
```markdown
[[ $user.role ]]
```

**Mixed delimiters in one file:**
```markdown
[[ $project.name ]]  <!-- Slot -->
{{ $project.name }}  <!-- Literal text, not processed -->
```
**Behavior:** Only the configured delimiter is processed as slots.

**Delimiter in imported files:**
```markdown
<!-- main.md (using {{ }}) -->
{{ @_footer.md }}

<!-- _footer.md (using [[ ]]) -->
Built with [[ $project.name ]]
```
**Behavior:** Each file uses its own configured delimiter (from front matter or cascading config).

## Migration Path

### From Obsidian Wikilinks

**Problem:** `[[ page-name ]]` conflicts with Ruleset slots.

**Solution:**
```yaml
# .rules/config.yaml
slots:
  delimiter: "{{ }}"  # Use braces instead
```

Now Obsidian wikilinks work normally, and slots use `{{ }}`:
```markdown
See [[other-page]] for details.  <!-- Obsidian wikilink -->

{{ @_conventions.md }}           <!-- Ruleset slot -->
```

### From Handlebars-Like Syntax

**Problem:** Team already uses `{{ }}` in documentation.

**Solution:** Keep using `{{ }}`, configure Ruleset to match:
```yaml
# .rules/config.yaml
slots:
  delimiter: "{{ }}"
```

No migration needed—existing syntax works as-is.

### From Default `[[ ]]`

**Problem:** Want to switch project to `%% %%`.

**Migration steps:**
1. Update `.rules/config.yaml`:
   ```yaml
   slots:
     delimiter: "%% %%"
   ```
2. Find/replace all slot usage:
   ```bash
   # In .rules/src/**/*.md
   find .rules/src -name "*.md" -exec sed -i '' 's/\[\[/%%/g' {} \;
   find .rules/src -name "*.md" -exec sed -i '' 's/\]\]/%%/g' {} \;
   ```
3. Test compilation:
   ```bash
   rules build
   ```
4. Commit changes

## Design Principles

1. **Explicit over implicit** - Delimiter must be configured, not auto-detected
2. **Fail fast** - If delimiter syntax is malformed, error immediately
3. **No surprise behavior** - Only process configured delimiter, ignore others
4. **Escape hatch** - Triple delimiters always work for literals
5. **Scope boundaries** - Only process Ruleset source files, not entire project

## Open Questions

1. **Should providers support custom delimiters in output?**
   - Probably not—compiled outputs should use provider-native syntax
   - Delimiters are for *authoring*, not distribution

2. **Should we support asymmetric delimiters?**
   - e.g., `<<` and `>>`
   - Current answer: No—keeping it simple with symmetric pairs

3. **Should delimiter config be per-directory?**
   - e.g., `.ruleset/rules/config.yaml` vs `.ruleset/partials/config.yaml`
   - Current answer: No—file-level override is sufficient

4. **What happens if a file has no delimiter config and imports another file with different config?**
   - Example: `main.md` (no config, defaults to `[[ ]]`) imports `_footer.md` (configured for `{{ }}`)
   - Answer: Each file respects its own config; imports work transparently

5. **Should we allow delimiter config in CLI overrides?**
   - e.g., `rules build --delimiter "{{ }}"`
   - Probably not—this should be declarative in config, not imperative in commands

## Implementation Checklist

- [ ] Add `delimiter` field to config schema (Zod validation)
- [ ] Update parser to accept delimiter configuration
- [ ] Implement triple-delimiter escape logic
- [ ] Add delimiter cascade logic (file → project → user → default)
- [ ] Update error messages to mention active delimiter
- [ ] Add migration guide to docs
- [ ] Add tests for each delimiter type
- [ ] Add tests for escaping behavior
- [ ] Add tests for cross-file delimiter differences
- [ ] Update language.md to document custom delimiters
- [ ] Update examples to show delimiter configuration

## Related Documentation

- `COMPOSER_CONCEPT.md` - Slots & variables system design
- `language.md` - Terminology and conventions
- `examples/SUMMARY.md` - Working examples (uses default `[[ ]]`)

---

**Status:** Design document
**Target:** v0.5.0 or later (post-v0.4.0 launch)
**Priority:** Medium (nice-to-have, not blocker)
