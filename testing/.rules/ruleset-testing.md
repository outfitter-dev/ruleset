# Using This Directory as a Ruleset Integration Test Suite

This document outlines how the `testing/` directory structure—originally designed to test AI agent context loading—can serve as a comprehensive integration test suite for Ruleset itself.

## Concept

The test files in this directory use `@mentions` to reference other files in a pattern that mirrors Ruleset's `[[ @file ]]` import system (slots & variables). This creates a natural testing ground for:

- Import resolution across various path types
- Dependency graph construction and traversal
- Circular reference detection
- File format support beyond `.md`
- Cache invalidation and incremental compilation
- Cross-provider output consistency

## Test Coverage Map

### Import Resolution Tests

| Test File | What It Tests | Ruleset Feature |
|-----------|---------------|-----------------|
| `tests/references.md` | Parent dirs (`@../`), hidden dirs (`@../.config/`), special files | Path resolution, glob matching |
| `tests/mention-formats.md` | Inline, list, code block @mentions; various path styles | Parser flexibility, import syntax |
| `a/chain-a.md` → `b/chain-b.md` → `c/chain-c.md` | Progressive nesting, subdirectory refs (`@b/chain-b.md`) | Nested imports, relative path handling |
| `a/AGENTS.md` → `b/c/d/e/deep.md` | 5-level deep nesting | Deep directory traversal |

### Dependency Graph Tests

| Test File | What It Tests | Ruleset Feature |
|-----------|---------------|-----------------|
| `tests/circular-1.md` ↔ `tests/circular-2.md` | Circular references | Cycle detection, graceful handling |
| `tests/order-1.md` → `order-2.md` → `order-3.md` | Load order | Topological sort, dependency ordering |
| `a/AGENTS.md` (imports chain-a + deep.md) | Multiple imports from one file | Fanout dependency tracking |

### File Format Tests

| Test File | What It Tests | Ruleset Feature |
|-----------|---------------|-----------------|
| `src/utils.js` | JavaScript files | Non-markdown import support |
| `src/config.toml` | TOML files | Config file imports |
| `.config/settings.yml` | YAML in hidden directory | YAML support, hidden dir access |
| `tests/MANIFEST` | No file extension | Extension-less file handling |
| `tests/.testyrc` | Dotfile | Hidden file discovery |

### Discovery & Special Cases

| Test File | What It Tests | Ruleset Feature |
|-----------|---------------|-----------------|
| `tests/.hidden-rules.md` | Hidden markdown files | Glob patterns, hidden file inclusion |
| `tests/secrets.md` | Gitignored files | Whether .gitignore is respected |
| `tests/comments.md` | HTML comments containing metadata | Comment preservation/stripping |

## Test Implementation Strategy

### Approach 1: Snapshot Testing

**Concept:** Compile the entire `testing/` directory for each provider and snapshot the outputs.

**Implementation:**
```typescript
describe('Import Resolution Integration', () => {
  it('should compile testing/ directory with all imports resolved', async () => {
    const result = await orchestrator.compile({
      source: 'testing/',
      providers: ['cursor', 'claude-code', 'windsurf'],
    });

    expect(result).toMatchSnapshot();
  });
});
```

**Advantages:**
- Catches regressions in output format
- Tests all providers simultaneously
- Real-world complexity

**Challenges:**
- Large snapshots
- Provider-specific differences may cause noise

### Approach 2: Assertion-Based Testing

**Concept:** Use CONTEXT LABELs as expected content markers.

**Example rule file structure:**
```markdown
---
ruleset:
  version: 0.4.0
---

# Test Chain Imports

[[ @chain-a.md ]]
[[ @b/c/d/e/deep.md ]]
```

**Implementation:**
```typescript
describe('Chain Import Resolution', () => {
  it('should resolve 3-level nested chain imports', async () => {
    const result = await orchestrator.compile({
      source: 'testing/a/AGENTS.md',
      provider: 'cursor',
    });

    const output = result.artifacts[0].content;

    // All chain files should be included (via [[ @chain-a.md ]] which chains to b and c)
    expect(output).toContain('🔗 Chain A (testing/a/chain-a.md)');
    expect(output).toContain('🔗 Chain B (testing/a/b/chain-b.md)');
    expect(output).toContain('🔗 Chain C (testing/a/b/c/chain-c.md)');

    // Deep file should also be included (via [[ @b/c/d/e/deep.md ]])
    expect(output).toContain('🗂️ Deep (testing/a/b/c/d/e/deep.md)');
  });

  it('should handle circular references without infinite loops', async () => {
    const result = await orchestrator.compile({
      source: 'testing/tests/circular-1.md',
      provider: 'cursor',
    });

    const output = result.artifacts[0].content;

    // Both files should appear exactly once
    const circular1Count = (output.match(/♻️ Circular 1/g) || []).length;
    const circular2Count = (output.match(/♻️ Circular 2/g) || []).length;

    expect(circular1Count).toBe(1);
    expect(circular2Count).toBe(1);
  });
});
```

**Advantages:**
- Precise, targeted tests
- Clear failure messages
- Easy to understand intent

**Challenges:**
- More test code to maintain
- Needs updating when test files change

### Approach 3: Dependency Graph Validation

**Concept:** Test the internal dependency graph structure directly.

**Implementation:**
```typescript
describe('Dependency Graph Construction', () => {
  it('should build correct graph for chain imports', async () => {
    const graph = await orchestrator.buildDependencyGraph({
      source: 'testing/a/AGENTS.md',
    });

    // Verify graph structure
    expect(graph.nodes).toHaveLength(5); // AGENTS.md, chain-a, chain-b, chain-c, deep.md

    // Verify edges
    expect(graph.hasEdge('a/AGENTS.md', 'a/chain-a.md')).toBe(true);
    expect(graph.hasEdge('a/chain-a.md', 'a/b/chain-b.md')).toBe(true);
    expect(graph.hasEdge('a/b/chain-b.md', 'a/b/c/chain-c.md')).toBe(true);
  });

  it('should detect circular dependencies', async () => {
    const graph = await orchestrator.buildDependencyGraph({
      source: 'testing/tests/circular-1.md',
    });

    expect(graph.hasCycle()).toBe(true);
    expect(graph.getCycles()).toEqual([
      ['tests/circular-1.md', 'tests/circular-2.md', 'tests/circular-1.md']
    ]);
  });
});
```

**Advantages:**
- Tests internal implementation
- Fast (no compilation needed)
- Great for debugging

**Challenges:**
- Coupled to internal APIs
- Doesn't test full compilation

### Approach 4: Watch Mode & Cache Invalidation

**Concept:** Modify files and verify cache invalidation propagates correctly.

**Implementation:**
```typescript
describe('Incremental Compilation', () => {
  it('should invalidate dependents when chain-c changes', async () => {
    // Initial compilation
    const result1 = await orchestrator.compile({
      source: 'testing/a/AGENTS.md',
      cache: true,
    });

    // Modify chain-c.md
    await fs.writeFile(
      'testing/a/b/c/chain-c.md',
      '# Updated\n\nCONTEXT LABEL: 🔗 Chain C (UPDATED)'
    );

    // Recompile
    const result2 = await orchestrator.compile({
      source: 'testing/a/AGENTS.md',
      cache: true,
    });

    // Verify cache stats
    expect(result2.cacheStats).toEqual({
      hit: 2,  // docs/AGENTS.md, src/AGENTS.md unchanged
      miss: 4, // AGENTS.md, chain-a, chain-b, chain-c all rebuilt
    });

    // Verify updated content appears
    expect(result2.artifacts[0].content).toContain('Chain C (UPDATED)');
  });
});
```

**Advantages:**
- Tests critical watch mode functionality
- Validates cache correctness
- Real-world use case

**Challenges:**
- File system mutations in tests
- Cleanup between tests
- Timing considerations

## Recommended Test Structure

```
packages/orchestrator/tests/
├── integration/
│   ├── import-resolution.test.ts       # Tests path handling, nesting
│   ├── dependency-graph.test.ts        # Tests graph construction, cycles
│   ├── file-formats.test.ts            # Tests non-.md imports
│   ├── cache-invalidation.test.ts      # Tests incremental compilation
│   └── cross-provider.test.ts          # Tests provider consistency
└── fixtures/
    └── testing/ -> ../../../../testing/  # Symlink to this directory
```

## Test Data Maintenance

### Dual Purpose
This directory serves two purposes:
1. AI agent context testing (current)
2. Ruleset integration testing (future)

**Strategy:**
- Keep CONTEXT LABELs—they're useful markers for both purposes
- Keep file structure—it represents real-world complexity
- Add `.ruleset/config.json` to configure Ruleset-specific behavior
- Add `.ruleset/rules/` for source rules if needed

### Making It Ruleset-Aware

**Add configuration:**
```json
// testing/.ruleset/config.json
{
  "sources": {
    "rules": [
      "AGENTS.md",
      "a/AGENTS.md",
      "docs/AGENTS.md",
      "src/AGENTS.md"
    ]
  },
  "providers": {
    "enabled": ["cursor", "claude-code", "windsurf"]
  }
}
```

**Add test expectations:**
```yaml
# testing/.rules/test-expectations.yml
tests:
  - name: "Chain import resolution"
    source: "a/AGENTS.md"
    expects:
      - contains: "🔗 Chain A"
      - contains: "🔗 Chain B"
      - contains: "🔗 Chain C"
      - contains: "🗂️ Deep"

  - name: "Circular reference handling"
    source: "tests/circular-1.md"
    expects:
      - contains: "♻️ Circular 1"
      - contains: "♻️ Circular 2"
      - not: "Maximum call stack"
```

## Integration with Existing Tests

### Current Test Suite
```
packages/
├── parser/tests/          # Unit tests for parser
├── validator/tests/       # Unit tests for validator
├── renderer/tests/        # Unit tests for renderer
└── orchestrator/tests/    # Where integration tests would live
```

### Proposed Addition
```
packages/orchestrator/tests/
├── unit/                  # Existing unit tests
├── integration/           # NEW: Tests using testing/ fixture
│   └── ...test.ts
└── fixtures/
    └── testing/           # Symlink to /testing/
```

## Benefits

1. **Real-world complexity** - Not artificial test data
2. **Multiple concerns tested together** - Path resolution + imports + cycles + formats
3. **Already built** - Existing directory structure is perfect
4. **Self-documenting** - CONTEXT LABELs explain what should happen
5. **Cross-provider validation** - Ensure all providers handle imports consistently
6. **Regression prevention** - Catches subtle path resolution bugs

## Next Steps (When Ready)

1. Add `.ruleset/config.json` to make this directory compilable
2. Choose testing approach (recommend: Assertion-based + Dependency Graph)
3. Write first integration test using one chain file
4. Expand coverage to all test scenarios
5. Add to CI pipeline
6. Use for provider development (test new providers against this suite)

## Slot Syntax Reference

Ruleset uses the **double bracket** `[[ ]]` syntax for composition:

```markdown
[[ @file.md ]]          # Import entire file (relative to current file)
[[ @../src/utils.js ]]  # Import from parent directory
[[ @b/chain-b.md ]]     # Import from subdirectory
[[ $project.name ]]     # Variable interpolation
[[ team-contact ]]      # Named slot (defined in config)
```

This syntax maps directly to the `@mentions` used in the test files, making them perfect integration test fixtures.

**Key documentation:**
- `COMPOSER_CONCEPT.md` - Full slots & variables specification
- `examples/SUMMARY.md` - Working examples with `[[ ]]` syntax
- `examples/COMPARISON.md` - Before/after comparison

## Open Questions

- Should `.gitignore` be respected for `[[ @ ]]` imports, or is that a user config option?
- How should circular imports behave? (Include once? Error? Warn?)
- Should watch mode recompile on hidden file changes (`.hidden-rules.md`)?
- Do all providers need to handle non-.md imports the same way?
- Does `[[ @file ]]` syntax support glob patterns or only explicit paths?

---

**Status:** Design document
**Implementation:** Deferred until post-v0.4.0
**Priority:** Medium (nice-to-have for comprehensive testing)
