# Rulesets Improvements & Design Ideas

This document captures design ideas and planned improvements that aren't yet ready for implementation. Think of this as the design incubator—ideas mature here before moving into PLAN.md or implementation.

---

## Output Configuration & Composition Files (2025-09-30)

### Project Structure Changes

**Current structure:**
- Config: `.ruleset/config.*`
- Sources: `.ruleset/rules/`
- Partials: `.ruleset/partials/`

**Proposed structure:**
- Config: `.ruleset.yaml` (root level)
- Sources: `.rules/src/`
- Partials: `.rules/src/partials/`
- Build manifest: `.rules/history.json`

**Rationale:** Config at root makes more sense (it's project metadata, not inside the rules directory). `.rules/src/` makes it clear these are sources, and keeps all rules-related content in one place.

---

### Output Configuration Pattern

Use `boolean | string | array | object` pattern for flexible configuration:

```yaml
# Simple (most common)
unified: true              # Use default .rules/
providers: true            # All enabled providers

# Custom paths
unified: .agents/rules     # Custom unified location
providers: [cursor, windsurf]  # Specific providers only

# Advanced (full control)
output:
  unified: .rules
  providers:
    cursor:
      path: .cursor/rules
    windsurf:
      enabled: false
```

**Key insight:** `unified` is your canonical/personal reference location (one place). `providers` controls whether to also write to tool-specific directories.

---

### Composition Files (Meta-Rules)

**Problem:** Different tools have different conventions:
- AGENTS.md / CLAUDE.md → Single aggregated file
- Cursor / Windsurf → Multiple separate files
- Need to route same source content to different output styles

**Solution:** Composition files that aggregate multiple rules with fine-grained control.

#### File Detection (Content-Based, Not Naming)

**No special naming required.** Any `.md` file can be:
- A regular rule (has `ruleset:` frontmatter key)
- A composition file (has YAML code blocks with inclusion directives)
- Both (has its own content AND composes other rules)

Detection is purely based on **content**, not filename patterns.

```
.rules/src/
├── AGENTS.md           # Composition file (no special prefix needed)
├── CLAUDE.md           # Composition file
├── core.md             # Regular rule
└── conventions/
    └── typescript.md   # Regular rule
```

**Rule file detection:**
```yaml
---
ruleset:
  version: 0.4.0
---
# Content here
```

**Composition file detection:**
```yaml
---
ruleset:
  version: 0.4.0
---

```yaml
file: core.md    # Relative to .rules/src/
mode: embed
```
```

#### Two Approaches

**1. YAML Code Blocks (for complex compositions):**

```markdown
---
ruleset:
  version: 0.4.0
name: AGENTS
output: .agents/AGENTS.md
providers:
  all: true
  cursor: false
---

# Project Rules

```yaml
file: core.md                 # Simple: single file, relative to .rules/src/
heading: true
mode: embed
```

```yaml
file:
  glob: conventions/*.md      # File glob pattern
  tags: public,onboarding     # Tag filter: comma-separated, supports wildcards/negation
heading:
  text: title
  level: inherit
mode:
  claude: mention
  agents: embed
```
```

**2. Root Config (for simple aggregations):**

```yaml
# .ruleset.yaml
compositions:
  - name: AGENTS
    output: .agents/AGENTS.md
    sections:
      - file: core.md           # Relative to .rules/src/
        heading: true
        mode: embed
      - file:
          glob: conventions/*.md  # Glob pattern
        heading:
          text: title
          level: inherit
        mode: embed
```

Both use the same schema. YAML blocks are insertion points that get replaced with actual content during compilation.

---

### YAML Block Schema

```yaml
# File inclusion (paths relative to .rules/src/)
file: string              # Simple: single file path (e.g., "core.md")
file:                     # Advanced: object form with filters
  path: string            # Explicit path (e.g., "core.md")
  glob: string            # File glob pattern (e.g., "conventions/*.md")
  tags: string            # Tag glob pattern (e.g., "public,*security*,!internal")
                          # Supports: exact match, wildcards (*), negation (!)

# Heading control (hybrid: boolean | string | object)
heading: true             # Auto-detect title, inherit context level
heading: "Custom"         # Custom text at context level
heading:                  # Full control
  text: title | "Custom" | false
  level: inherit | 2 | +1 | -1
  normalize: true         # Auto-adjust nested headings
  strip: true            # Remove original heading from content

# Mode control (how to include)
mode: embed | mention | link
mode:                     # Provider-specific
  claude: mention         # @filename
  agents: embed          # Full content
  cursor: link           # [Title](./path)

# Filtering
filter:
  tags: [public]          # Include if has ANY tag
  providers: [cursor]     # Include if provider enabled
  exclude-tags: [internal]

# Transformations
wrap: xml | code-block    # Wrap content
format: markdown | xml    # Output format
```

---

### Heading Options (Hybrid Approach - Preferred)

The `heading` key supports progressive disclosure:

```yaml
# Simple boolean
heading: true             # Use file's title, inherit context
heading: false            # No heading wrapper

# String shorthand
heading: "Custom Text"    # Custom text at context level

# Object (full control)
heading:
  text: title | "Custom" | false
  level: inherit | 1-6 | +1 | -1
  normalize: true
  strip: true
```

**`text` values:**
- `title` - Use file's frontmatter title or H1
- `"Custom"` - Custom string
- `false` - No heading

**`level` values:**
- `inherit` - Match context level (smart default)
- `2` - Force specific level (##)
- `+1`, `-1` - Relative increment/decrement
- `normalize: true` - Auto-adjust all nested headings

---

### Mode Types

**embed** - Include full content inline
**mention** - Render as @mention (for tools that support it)
**link** - Render as markdown link `[Title](./path)`

Provider-specific modes allow routing the same source differently:

```yaml
mode:
  claude: mention      # See @typescript in Claude
  agents: embed        # Full content in AGENTS.md
  cursor: link         # Link to separate file in Cursor
```

---

### Example: Complete Composition

```markdown
---
# .rules/src/AGENTS.md (no special prefix needed)
ruleset:
  version: 0.4.0
name: AGENTS
output: .agents/AGENTS.md
providers:
  all: true
---

# {{name}} - Project Rules

```yaml
file: core.md
heading: true
mode: embed
```

## Conventions

```yaml
file:
  glob: conventions/*.md
  tags: public,!internal     # Include 'public' but not 'internal' tags
heading:
  text: title
  level: inherit
  normalize: true
mode:
  claude: mention
  agents: embed
```

## Security

```yaml
file:
  glob: security/*.md
heading:
  text: "Security Guidelines"
  level: 2
wrap: xml
mode: embed
```
```

**Renders for `agents` provider:**

```markdown
# AGENTS - Project Rules

## Core Conventions
[Full CORE.md content]

## Conventions

### TypeScript Standards
[Full content with normalized headings]

### Git Workflow
[Full content with normalized headings]

## Security
<security_guidelines>
[Content from security/*.md files]
</security_guidelines>
```

**Renders for `claude` provider:**

```markdown
# AGENTS - Project Rules

## Core Conventions
[Full CORE.md content]

## Conventions

@conventions/typescript
@conventions/git

## Security
<security_guidelines>
[Content from security/*.md files]
</security_guidelines>
```

---

### Build Manifest

`.rules/history.json` tracks source → output mappings:

```json
{
  "version": "1.0",
  "lastBuild": "2025-09-30T12:34:56Z",
  "sources": {
    ".rules/src/CORE.md": {
      "hash": "abc123",
      "outputs": [
        {
          "path": ".cursor/rules/CORE.mdc",
          "hash": "def456",
          "provider": "cursor",
          "timestamp": "2025-09-30T12:34:56Z"
        },
        {
          "path": ".windsurf/rules/CORE.md",
          "hash": "ghi789",
          "provider": "windsurf",
          "timestamp": "2025-09-30T12:34:56Z"
        }
      ]
    }
  }
}
```

**Benefits:**
- Integrity checking (detect manual edits)
- Source tracking (know what produced each output)
- Cleanup (remove outputs for deleted sources)
- Audit trail

---

### Implementation Notes

**Processing flow:**
1. Parse composition frontmatter
2. Find YAML code blocks in body
3. Resolve rule paths (globs, filters)
4. Load and process each rule
5. Apply transformations (heading, mode, wrap)
6. Replace YAML block with rendered content
7. Track in build manifest

**Context awareness:**
- Track previous heading level for `inherit`
- Maintain provider context for mode selection
- Preserve markdown structure between blocks

---

### Future Enhancements

- Handlebars helpers for dynamic inclusion
- Conditional blocks based on provider capabilities
- Section extraction (`file.sections.name`)
- Custom mode plugins
- Tag-based filtering in source frontmatter
- Provider group syntax improvements

---

---

## Global Configuration Structure

### XDG Base Directory Compliance

**Decision:** Follow XDG Base Directory specification for global configuration.

**Paths:**
- **macOS/Linux (XDG):** `~/.config/ruleset/`
- **macOS (fallback):** `~/.ruleset/`
- **Windows:** `%APPDATA%\ruleset\`

**Structure:**
```
~/.config/ruleset/
├── config.yaml          # Global user settings
├── history.json         # Command audit trail (global)
└── rules/               # Global rules (optional)
    └── shared.md
```

### Global vs Project Configuration

**Global config (`~/.config/ruleset/config.yaml`):**
- Default providers to enable
- Default output paths
- User preferences (formatting, logging)
- Telemetry settings
- Global helper modules

**Project config (`.ruleset.yaml` at project root):**
- Source paths
- Output configuration
- Provider-specific settings
- Compositions
- Project-specific helpers

**Precedence:** Project config overrides global config.

**Example global config:**
```yaml
# ~/.config/ruleset/config.yaml
providers:
  default: [cursor, claude-code, agents]

output:
  unified: .rules

preferences:
  format: yaml
  logLevel: info

telemetry:
  enabled: false
```

---

## Hash Validation & Change Detection

### Build Manifest Format

Build manifest (`.rules/history.json`) tracks content hashes for integrity checking:

```json
{
  "version": "1.0",
  "lastBuild": "2025-09-30T12:34:56Z",
  "sources": {
    ".rules/src/core.md": {
      "hash": "sha256:abc123...",
      "lastModified": "2025-09-30T12:34:56Z",
      "outputs": [
        {
          "path": ".cursor/rules/core.mdc",
          "hash": "sha256:def456...",
          "provider": "cursor",
          "timestamp": "2025-09-30T12:34:56Z"
        }
      ]
    }
  }
}
```

### Hash Algorithm

- **Algorithm:** SHA-256
- **Source hash:** Hash of file content (excluding frontmatter metadata that doesn't affect output)
- **Output hash:** Hash of rendered output content
- **Comparison:** String equality check

### Validation Behavior

**On compile:**
1. Calculate source file hash
2. Compare with manifest entry
3. If changed → recompile
4. If unchanged → check output files

**Output validation:**
1. Read output file from disk
2. Calculate current hash
3. Compare with manifest hash
4. If mismatch → **warn** (manual edit detected)

**Warning format:**
```
⚠️  Manual edit detected: .cursor/rules/core.mdc
    Expected: sha256:def456...
    Actual:   sha256:xyz789...

    This file was modified outside of Rulesets.
    Run `rules sync` to update source or recompile to overwrite.
```

### Sync Command (Future)

**Purpose:** Reconcile manual edits back to source files.

**Workflow:**
```bash
rules sync

# Output:
⚠️  3 files have been manually edited:
  1. .cursor/rules/core.mdc
  2. .windsurf/rules/conventions.md
  3. .agents/AGENTS.md

Options:
  [s] Show diff for file
  [u] Update source with changes
  [o] Overwrite (recompile from source)
  [i] Ignore (mark as expected)
  [q] Quit
```

**Diff detection:**
1. Load source file
2. Recompile to memory (don't write)
3. Compare with disk version
4. Extract differences
5. Present as unified diff
6. Allow selective updates back to source

**Use cases:**
- Fix typo directly in output file → sync back to source
- Add provider-specific note → update source frontmatter
- Detect accidental overwrites → restore from source

---

## Composition File Parsing & Rendering

### Architecture

**Components:**
1. **Frontmatter parser** - Extract metadata
2. **YAML block extractor** - Find ```yaml blocks in markdown
3. **File resolver** - Expand globs, apply filters
4. **Content loader** - Read source files
5. **Transform pipeline** - Apply heading/mode/wrap transformations
6. **Renderer** - Replace YAML blocks with rendered content

### YAML Block Extraction Strategy

**Step 1: Identify blocks**
```typescript
// Regex pattern for YAML code blocks
const YAML_BLOCK_PATTERN = /^```yaml\s*\n([\s\S]*?)\n```$/gm;

// Extract all blocks with their positions
interface YAMLBlock {
  raw: string;           // Full ```yaml...``` text
  content: string;       // YAML content only
  startIndex: number;    // Position in document
  endIndex: number;      // End position
}
```

**Step 2: Parse YAML content**
```typescript
import yaml from 'yaml';

interface FileInclusion {
  file: string | {
    path?: string;
    glob?: string;
    tags?: string;
  };
  heading?: boolean | string | {
    text: string | 'title' | false;
    level?: 'inherit' | number;
    normalize?: boolean;
    strip?: boolean;
  };
  mode?: 'embed' | 'mention' | 'link' | Record<string, 'embed' | 'mention' | 'link'>;
  wrap?: 'xml' | 'code-block';
  format?: 'markdown' | 'xml';
}

const inclusion = yaml.parse(block.content) as FileInclusion;
```

**Step 3: Validate schema**
```typescript
// Zod schema for validation
import { z } from 'zod';

const FileInclusionSchema = z.object({
  file: z.union([
    z.string(),
    z.object({
      path: z.string().optional(),
      glob: z.string().optional(),
      tags: z.string().optional(),
    }),
  ]),
  heading: z.union([
    z.boolean(),
    z.string(),
    z.object({
      text: z.union([z.literal('title'), z.string(), z.literal(false)]),
      level: z.union([z.literal('inherit'), z.number().min(1).max(6)]),
      normalize: z.boolean().optional(),
      strip: z.boolean().optional(),
    }),
  ]).optional(),
  mode: z.union([
    z.enum(['embed', 'mention', 'link']),
    z.record(z.enum(['embed', 'mention', 'link'])),
  ]).optional(),
  wrap: z.enum(['xml', 'code-block']).optional(),
  format: z.enum(['markdown', 'xml']).optional(),
});
```

### File Resolution

**Step 1: Normalize file specification**
```typescript
function normalizeFileSpec(file: FileInclusion['file']): {
  path?: string;
  glob?: string;
  tags?: string;
} {
  if (typeof file === 'string') {
    return { path: file };
  }
  return file;
}
```

**Step 2: Resolve glob patterns**
```typescript
import { glob } from 'glob';
import path from 'path';

async function resolveFiles(
  spec: { path?: string; glob?: string; tags?: string },
  srcDir: string
): Promise<string[]> {
  if (spec.path) {
    return [path.join(srcDir, spec.path)];
  }

  if (spec.glob) {
    const pattern = path.join(srcDir, spec.glob);
    const matches = await glob(pattern);

    if (spec.tags) {
      return filterByTags(matches, spec.tags);
    }

    return matches;
  }

  return [];
}
```

**Step 3: Tag filtering**
```typescript
function filterByTags(files: string[], tagPattern: string): string[] {
  const patterns = parseTagPattern(tagPattern);
  // tagPattern: "public,!internal,*security*"
  // Returns: { include: ['public', '*security*'], exclude: ['internal'] }

  return files.filter(file => {
    const frontmatter = parseFrontmatter(file);
    const tags = frontmatter.tags || [];

    return matchesTagPattern(tags, patterns);
  });
}

function parseTagPattern(pattern: string): {
  include: string[];
  exclude: string[];
} {
  const parts = pattern.split(',').map(p => p.trim());
  return {
    include: parts.filter(p => !p.startsWith('!')),
    exclude: parts.filter(p => p.startsWith('!')).map(p => p.slice(1)),
  };
}

function matchesTagPattern(
  tags: string[],
  patterns: { include: string[]; exclude: string[] }
): boolean {
  // Check excludes first
  for (const exclude of patterns.exclude) {
    if (tags.some(tag => matchWildcard(tag, exclude))) {
      return false;
    }
  }

  // Check includes
  if (patterns.include.length === 0) return true;

  return patterns.include.some(include =>
    tags.some(tag => matchWildcard(tag, include))
  );
}

function matchWildcard(str: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*') + '$'
  );
  return regex.test(str);
}
```

### Transform Pipeline

**Step 1: Load source content**
```typescript
interface SourceFile {
  path: string;
  frontmatter: Record<string, unknown>;
  content: string;
  title: string;  // From frontmatter or H1
}

async function loadSource(filePath: string): Promise<SourceFile> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const { frontmatter, content } = parseFrontmatter(raw);
  const title = frontmatter.name || extractH1(content) || path.basename(filePath, '.md');

  return { path: filePath, frontmatter, content, title };
}
```

**Step 2: Apply heading transformations**
```typescript
function applyHeadingTransform(
  source: SourceFile,
  heading: FileInclusion['heading'],
  contextLevel: number
): { heading?: string; content: string } {
  // Normalize to object form
  const h = normalizeHeading(heading);

  if (h === null) {
    return { content: source.content };
  }

  const headingText = h.text === 'title' ? source.title : h.text;
  const level = h.level === 'inherit' ? contextLevel + 1 : h.level;

  let content = source.content;

  if (h.strip) {
    content = stripFirstHeading(content);
  }

  if (h.normalize) {
    content = normalizeHeadingLevels(content, level);
  }

  const headingMd = headingText ? `${'#'.repeat(level)} ${headingText}\n\n` : '';

  return {
    heading: headingMd,
    content,
  };
}
```

**Step 3: Apply mode transformation**
```typescript
function applyModeTransform(
  source: SourceFile,
  mode: FileInclusion['mode'],
  provider: string,
  content: string
): string {
  const m = typeof mode === 'string' ? mode : (mode?.[provider] || 'embed');

  switch (m) {
    case 'embed':
      return content;

    case 'mention':
      // Convert path to @mention format
      const mention = pathToMention(source.path);
      return `@${mention}`;

    case 'link':
      const linkPath = pathToRelative(source.path);
      return `[${source.title}](${linkPath})`;

    default:
      return content;
  }
}

function pathToMention(filePath: string): string {
  // .rules/src/conventions/typescript.md → conventions/typescript
  return filePath
    .replace(/^\.rules\/src\//, '')
    .replace(/\.md$/, '');
}
```

**Step 4: Apply wrapping**
```typescript
function applyWrapping(
  content: string,
  wrap?: 'xml' | 'code-block',
  source?: SourceFile
): string {
  if (!wrap) return content;

  switch (wrap) {
    case 'xml':
      const tagName = pathToTagName(source.path);
      return `<${tagName}>\n${content}\n</${tagName}>`;

    case 'code-block':
      return `\`\`\`markdown\n${content}\n\`\`\``;

    default:
      return content;
  }
}

function pathToTagName(filePath: string): string {
  // conventions/typescript.md → conventions_typescript
  return pathToMention(filePath).replace(/\//g, '_');
}
```

### Rendering Process

**Step 1: Process composition file**
```typescript
async function renderComposition(
  compositionPath: string,
  provider: string,
  srcDir: string
): Promise<string> {
  // Load composition file
  const raw = await fs.readFile(compositionPath, 'utf-8');
  const { frontmatter, content } = parseFrontmatter(raw);

  // Extract YAML blocks
  const blocks = extractYAMLBlocks(content);

  // Process each block
  const rendered: string[] = [];
  let lastIndex = 0;
  let contextLevel = 0;

  for (const block of blocks) {
    // Keep content before block
    const before = content.slice(lastIndex, block.startIndex);
    rendered.push(before);

    // Update context level from preceding headings
    contextLevel = detectContextLevel(before);

    // Parse and render block
    const inclusion = yaml.parse(block.content) as FileInclusion;
    const blockContent = await renderInclusion(
      inclusion,
      provider,
      srcDir,
      contextLevel
    );

    rendered.push(blockContent);
    lastIndex = block.endIndex;
  }

  // Add remaining content
  rendered.push(content.slice(lastIndex));

  return rendered.join('');
}
```

**Step 2: Render single inclusion**
```typescript
async function renderInclusion(
  inclusion: FileInclusion,
  provider: string,
  srcDir: string,
  contextLevel: number
): Promise<string> {
  // Resolve files
  const spec = normalizeFileSpec(inclusion.file);
  const files = await resolveFiles(spec, srcDir);

  if (files.length === 0) {
    return `<!-- No files matched: ${JSON.stringify(spec)} -->`;
  }

  // Process each file
  const rendered = await Promise.all(
    files.map(async (filePath) => {
      const source = await loadSource(filePath);

      // Apply transformations
      const { heading, content } = applyHeadingTransform(
        source,
        inclusion.heading,
        contextLevel
      );

      const modeContent = applyModeTransform(
        source,
        inclusion.mode,
        provider,
        content
      );

      const wrapped = applyWrapping(
        modeContent,
        inclusion.wrap,
        source
      );

      return (heading || '') + wrapped;
    })
  );

  return rendered.join('\n\n');
}
```

### Context Level Detection

```typescript
function detectContextLevel(markdown: string): number {
  // Find the last heading in the text
  const headings = markdown.match(/^#{1,6}\s+/gm);
  if (!headings || headings.length === 0) return 0;

  const lastHeading = headings[headings.length - 1];
  return lastHeading.split('#').length - 1;
}
```

### Error Handling

**File not found:**
```typescript
if (files.length === 0) {
  const warning = `<!-- Warning: No files matched ${spec.glob || spec.path} -->`;
  logger.warn(`Composition inclusion matched no files`, { spec });
  return warning;
}
```

**Invalid YAML:**
```typescript
try {
  const inclusion = yaml.parse(block.content);
  FileInclusionSchema.parse(inclusion);
} catch (error) {
  logger.error(`Invalid YAML block in ${compositionPath}`, { error });
  return `<!-- Error: Invalid YAML block - ${error.message} -->`;
}
```

**Tag parsing errors:**
```typescript
try {
  const patterns = parseTagPattern(spec.tags);
} catch (error) {
  logger.warn(`Invalid tag pattern: ${spec.tags}`, { error });
  // Fall back to no filtering
  return files;
}
```

---

## Status

This design is **draft** and needs validation before implementation. Next steps:
1. Validate with actual use cases (✅ done in `.rules/example/`)
2. Prototype YAML block parser
3. Implement composition rendering
4. Test with real providers
5. Document formally once proven
