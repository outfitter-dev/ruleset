# Proposed Fixes and Enhancements for spec/overview.md (v0.x)

This document outlines proposed changes and clarifications for `spec/overview.md` based on recent discussions. The goal is to improve clarity, add missing details, and identify areas for further refinement.

## 1. Option Processing Order

**Observation:** The `spec/overview.md` document does not explicitly state the processing order of options, which is crucial for understanding how combined or potentially conflicting options are resolved.

**Proposal:** Add a note about the left-to-right processing order of options, especially for inclusion/exclusion modifiers and target-scoped options.

**Suggested Location:** Potentially within the "Track Marker Parsing" section or as a new sub-section under "Tracks".

**Proposed Diff for `spec/overview.md`:**

````diff
--- a/spec/overview.md
+++ b/spec/overview.md
@@ -217,6 +217,15 @@
 Content A
 </track-one>
 ```
+
+#### Option Processing Order
+
+Options within a track marker are processed sequentially from left to right. This processing order affects three main categories of options:
+
+1. **Basic Options**: Simple formatting options like `tag-omit` or `code-js`
+2. **Target Inclusion/Exclusion**: Modifiers like `+target` and `!target`
+3. **Target-Scoped Options**: Special formatting for specific targets using `target:[options]`
+
+The evaluation follows this simple rule:
+
+- Options are applied **in the exact order they appear** (left to right)
+- When conflict occurs, **the last directive wins**
+
+**Simple Example:**
+```markdown
+{{track code-js tag-omit}}
+```
+First applies `code-js` (JavaScript code block formatting), then applies `tag-omit` (removes surrounding XML tags).
+
+**Practical Target Example:**
+```markdown
+{{track +ide !windsurf cursor:[tag-omit]}}
+```
+This would:
+1. Include the track for all IDE targets (`+ide`)
+2. Exclude it specifically for Windsurf (`!windsurf`), even though Windsurf might be in the IDE group
+3. Apply the `tag-omit` option, but only when building for Cursor
+
+**Conflict Resolution Example:**
+```markdown
+{{track h-2 h-3}}
+```
+The track would use heading level 3 because `h-3` appears last and overrides `h-2`.
+
+> [!NOTE]
+> While options are processed left-to-right, certain option types like `name()` might have special handling if specified multiple times. When in doubt about complex combinations, the last specified option for a particular feature usually takes precedence.
+
+

 #### Target-scoped Option Overrides


````

## 2. Enhanced Target Scoping Examples

**Observation:** While `spec/overview.md` introduces target-scoped options, it lacks explicit examples for combined patterns involving inclusion/exclusion with these scoped options, as well as group scoping.

**Proposal:** Add a more comprehensive set of examples to the "Target-scoped Option Overrides" and "Target-scoped Multiple Options" sections, or a dedicated sub-section.

**Suggested Location:** Enhance existing sections or add a new sub-section under "Tracks".

**Proposed Examples:**

```markdown
**Comprehensive Target Scoping Examples:**

- **Target-specific option (block included for all targets unless otherwise specified):**
  `{{instructions cursor:name(cursor-specific-rules)}}`
  _(Applies `name(cursor-specific-rules)` only for the `cursor` target. The block itself is included for all targets by default.)_

- **Target-specific multiple options (block included for all targets):**
  `{{instructions cursor:[name(cursor-rules) code-js]}}`
  _(Applies `name(cursor-rules)` and `code-js` only for the `cursor` target.)_

- **Inclusion for a target with a specific option:**
  `{{instructions +cursor:name(only-for-cursor)}}`
  *(Includes this track *only* for the `cursor` target, and for `cursor`, it uses `name(only-for-cursor)`.)*

- **Inclusion for a target with multiple specific options:**
  `{{instructions +cursor:[name(cursor-rules) code-js]}}`
  *(Includes this track *only* for the `cursor` target, applying both `name(cursor-rules)` and `code-js` for `cursor`.)*

- **Exclusion for a target, even if a scoped option is present:**
  `{{instructions !cursor:name(ignored-for-cursor)}}`
  _(Excludes this track for the `cursor` target. The `name(ignored-for-cursor)` option would not apply as the track is excluded for `cursor`.)_
- **Exclusion for a target with multiple specific options (options are moot due to exclusion):**
  `{{instructions !cursor:[name(cursor-rules) code-js]}}`
  _(Excludes this track for the `cursor` target.)_

- **Group inclusion with member exclusion and scoped options for the group:**
  `{{instructions +ide:[code-block] !cursor}}`
  _(Includes this track for all targets in the `ide` group, applying the `code-block` option, but explicitly excludes it for the `cursor` target, even if `cursor` is part of the `ide` group. Assumes `ide` is a defined group.)_
```

**Diff for `spec/overview.md`:**

```diff
--- a/spec/overview.md
+++ b/spec/overview.md
@@ -230,6 +230,29 @@
 This applies both `name(cursor-rules)` and `code-js` options only when building for the cursor target, without affecting other targets. The square brackets group the options that are scoped to that specific target.

 #### Self-Closing Tags
+
+**Further Target Scoping Examples:**
+
+- **Target-specific option (block included for all targets unless otherwise specified):**
+  `{{instructions cursor:name(cursor-specific-rules)}}`
+  *(Applies `name(cursor-specific-rules)` only for the `cursor` target. The block itself is included for all targets by default.)*
+
+- **Inclusion for a target with a specific option:**
+  `{{instructions +cursor:name(only-for-cursor)}}`
+  *(Includes this track *only* for the `cursor` target, and for `cursor`, it uses `name(only-for-cursor)`.)*
+
+- **Inclusion for a target with multiple specific options:**
+  `{{instructions +cursor:[name(cursor-rules) code-js]}}`
+  *(Includes this track *only* for the `cursor` target, applying both `name(cursor-rules)` and `code-js` for `cursor`.)*
+
+- **Exclusion for a target, even if a scoped option is present:**
+  `{{instructions !cursor:name(ignored-for-cursor)}}`
+  *(Excludes this track for the `cursor` target. The `name(ignored-for-cursor)` option would not apply as the track is excluded for `cursor`.)*
+
+- **Group inclusion with member exclusion and scoped options for the group:**
+  `{{instructions +ide:[code-block] !cursor}}`
+  *(Includes this track for all targets in the `ide` group, applying the `code-block` option, but explicitly excludes it for the `cursor` target, even if `cursor` is part of the `ide` group. Assumes `ide` is a defined group, typically in `mixdown.config.json`.)*
+

 For tracks with no content, you can use a self-closing tag format:


```

## 3. Whitespace Handling in Option Groups

**Observation:** The current "Option Bracketing Rules" section or general "Whitespace Handling" doesn't explicitly detail whitespace _within_ the `[]` of option groups.

**Proposal:** Clarify that leading and trailing whitespace within the square brackets `[]` of an option group is optional and ignored by the parser, similar to whitespace around `{{` and `}}`.

**Suggested Location:** Add to the "Option Bracketing Rules" section.

**Proposed Diff for `spec/overview.md`:**

````diff
--- a/spec/overview.md
+++ b/spec/overview.md
@@ -410,6 +410,8 @@
 ```markdown
 {{rules [code-js tag-omit target:[option-a option-b]]}}  # ❌ Invalid, nested options groups
 {{rules [code-js tag-omit] target:[option-a option-b]}}  # ✅ Valid, separate option groups
+
+Leading and trailing whitespace within the option group brackets `[]` is optional and will be ignored by the parser. Spaces between options within the brackets are necessary delimiters. For example, `[ option1  option2 ]` is equivalent to `[option1 option2]`.
 ```

 When used with snippets, if the language is omitted (`code`), the system will automatically determine the language based on the snippet file's extension:

````

## 4. Consolidated Option Grouping Quick Reference

**Observation:** While option grouping and target scoping are explained, a consolidated quick reference of common patterns could improve usability.

**Proposal:** Add a small table or list showcasing common invocation patterns for option grouping, especially with target scoping.

**Suggested Location:** As a new sub-section after "Option Bracketing Rules" or near the end of the "Tracks" section.

**Proposed Diff for `spec/overview.md`:**

````diff
--- a/spec/overview.md
+++ b/spec/overview.md
@@ -414,6 +414,20 @@
 Leading and trailing whitespace within the option group brackets `[]` is optional and will be ignored by the parser. Spaces between options within the brackets are necessary delimiters. For example, `[ option1  option2 ]` is equivalent to `[option1 option2]`.
 ```

+#### Option Grouping & Scoping: Common Patterns
+
+The following table provides a quick reference to common invocation patterns for option grouping and target scoping:
+
+| Pattern                                     | Example                                         | Description                                                                 |
+|---------------------------------------------|-------------------------------------------------|-----------------------------------------------------------------------------|
+| Basic Grouping                              | `{{track [opt1 opt2 opt3]}}`                    | Visually groups space-delimited options.                                    |
+| Multi-line Grouping                         | `{{track [opt1
  opt2
]}}`                     | Improves readability for many options.                                      |
+| Target-Scoped Single Option (no group)      | `{{track target:opt1}}`                         | Applies `opt1` only for `target`. Block included for all valid targets.     |
+| Target-Scoped Multiple Options (via group)  | `{{track target:[opt1 opt2]}}`                  | Applies `opt1` and `opt2` only for `target`. Block included for all.        |
+| Inclusion for Target + Scoped Single Opt  | `{{track +target:opt1}}`                        | Includes block only for `target`, applying `opt1`.                          |
+| Inclusion for Target + Scoped Multi Opts  | `{{track +target:[opt1 opt2]}}`                 | Includes block only for `target`, applying `opt1` and `opt2`.               |
+| Exclusion for Target (scoped opts moot)     | `{{track !target:opt1}}` or `!target:[opt1]`  | Excludes block for `target`.                                                |
+| Group Inclusion + Member Exclusion          | `{{track +group:[opt1] !member}}`               | Includes for `group` with `opt1`, but excludes for `member`.                |
+
 When used with snippets, if the language is omitted (`code`), the system will automatically determine the language based on the snippet file's extension:


````

## 5. Further Improvements and Clarifications

This section covers areas that could benefit from minor clarifications or points to consider for future consistency and ease of use.

### 5.1. Potential Confusion: `target:[options]` vs. `+target:[options]`

**Observation:** The distinction between `{{track target:[option-a option-b]}}` and `{{track +target:[option-a option-b]}}` is subtle but critical. - `target:[options]` applies options _if_ the block is being rendered for that target (i.e., the block is included by default or via another rule). It does _not_ cause the block to be included solely for that target. - `+target:[options]` explicitly includes the block _only_ for that target and applies the specified options.

**Proposal:** Ensure this distinction is very clearly articulated, perhaps with a dedicated note or more explicit phrasing in the relevant examples. The "Further Target Scoping Examples" (added in item #2 above) aims to clarify this through examples. An additional explicit note could be beneficial.

**Suggested Text (example for a note):**

> [!IMPORTANT]
> Differentiating Scoped Options from Scoped Inclusion:
>
> - `target:[my-option]` means "If this track is rendered for `target`, apply `my-option`." The track's general inclusion is determined elsewhere (e.g. by default, or by a `+target` on its own).
> - `+target:[my-option]` means "Render this track _only_ for `target`, and when doing so, apply `my-option`." This controls both inclusion and target-specific options simultaneously.

### 5.2. Clarity: Custom XML Attributes `key="value"` vs. Structured Option `name(value)`

**Observation:**

- `spec/overview.md` (line 283) correctly lists `name(value)` as setting a name and "Custom `key="value"`" for passthrough attributes.
- The description for `name(value)` in the "Track Options" table is "Sets a name with a specified value for the track."
- The "Multi-line Markers for Readability" section (line 264) states: "Note: Using the `name(value)` syntax tells Mixdown to include this attribute in the rendered output". This is true, but _any_ `key="value"` custom attribute is also included in the rendered output if not `tag-omit`.
- The key distinction is that `name(some-name)` specifically sets the XML `name` attribute (e.g. `<instructions name="some-name">`), which might have special meaning for Mixdown or certain targets. Other `key="value"` pairs are generic passthrough attributes.

**Proposal:** Slightly rephrase the note on line 264-265 to emphasize that `name(value)` sets a _specific_ XML attribute named `name`, distinct from general custom attributes.

**Diff for `spec/overview.md`:**

```diff
--- a/spec/overview.md
+++ b/spec/overview.md
@@ -262,8 +262,8 @@
 This is the content of the instructions section.
 {{/instructions}}

-<!-- Note: Using the name(value) syntax tells Mixdown
-  to include this attribute in the rendered output -->
+<!-- Note: Using the name(value) syntax specifically sets the 'name' attribute
+  (e.g., name="important-rules") in the rendered XML output. -->

 ---


```

### 5.3. Simplification Review: `code` vs. `code-auto`

**Observation:** `options-proposal.md` (line 200, "Code Block Options" table) listed `code-auto` for "Auto-detect language". `spec/overview.md` (Comprehensive Option Reference Table, line 868) uses `code` for "Auto-detect code language".

**Confirmation:** The use of `code` in `spec/overview.md` is a good simplification and seems to be the intended final syntax. This is more of a confirmation that the spec reflects the desired state. No change needed if `code` is the final decision.

### 5.4. Enhanced Clarity on `{{link ...}}` Preview Limitations

**Observation:** `spec/overview.md` (line 512, note) states: "Standard Markdown links will work in previews as expected within the `.mixdown/mixes` directory, but `{{link ...}}` will not."

**Proposal:** Briefly add _why_ `{{link ...}}` doesn't work in standard previews to manage user expectations.

**Suggested Addition to the Note (line 513):**

> ...but `{{link ...}}` will not, as it requires compilation by Mixdown to resolve paths relative to the final output directory and apply any target-specific link transformations.

**Diff for `spec/overview.md`:**

````diff
--- a/spec/overview.md
+++ b/spec/overview.md
@@ -510,7 +510,7 @@
 ```

 > [!NOTE]
-> Standard Markdown links will work in previews as expected within the `.mixdown/mixes` directory, but `{{link ...}}` will not.
+> Standard Markdown links will work in previews as expected within the `.mixdown/mixes` directory, but `{{link ...}}` will not, as it requires compilation by Mixdown to resolve paths relative to the final output directory and apply any target-specific link transformations.

 #### Linking to Project Files


````

### 5.5. Variable Scope and Potential Namespace Clarity

**Observation:** Variables `{{$key}}` (alias), `{{$.key}}` (front matter), and `{{$target}}`/`{{$target.id}}` (system) are generally clear. - The `.` in `{{$.key}}` effectively namespaces front matter variables away from aliases. - System variables like `$target` are distinct.

**Consideration (Minor):** Is there any scenario where an alias could be named, for example, `target` (i.e., `{{$target}}`) and clash with the system variable `{{$target}}`? Or does the system variable always take precedence / have a protected namespace?
This is likely handled by a defined order of precedence (e.g., system > front matter > alias, or specific parsing rules).

**Proposal:** If not already implicitly covered by parser design, a brief note on variable resolution order or namespace protection in the "Variables" section could be useful for advanced users, though likely not critical for a general overview. For now, this is more of a thought-point for internal consistency checks rather than a specific doc change unless major ambiguity is perceived.

### 5.6. Target Group Definition Source

**Observation:** The proposal and examples (e.g., `+ide:[code-block] !cursor`) use the concept of "target groups" (like `ide`). The `spec/overview.md` document doesn't explicitly state _where_ these groups are defined (presumably in `mixdown.config.json`).

**Proposal:** Add a brief parenthetical note when target groups are first exemplified, indicating their typical definition source.

**Suggested Location:** In the "Further Target Scoping Examples" added in item #2, or the "Comprehensive Option Reference Table".

**Example text already incorporated into item #2's diff:** `(Assumes ide is a defined group, typically in mixdown.config.json.)`
This seems sufficient for an overview document.

---

This document should serve as a good basis for refining `spec/overview.md`.
