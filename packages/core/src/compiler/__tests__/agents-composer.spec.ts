import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RulesetParser } from "../../parser";
import { AgentsComposer } from "../agents-composer";

describe("AgentsComposer", () => {
  let tempDir: string;
  let composer: AgentsComposer;
  let parser: RulesetParser;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "agents-composer-test-"));
    parser = new RulesetParser();
    composer = new AgentsComposer(parser);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("compose", () => {
    it("should handle empty directory", async () => {
      const result = await composer.compose({
        includeGlobs: [`${tempDir}/**/*.md`],
        baseDir: tempDir,
      });

      expect(result.content).toBe(
        "# AGENTS\n\nNo rule files found for composition."
      );
      expect(result.metadata).toEqual({});
      expect(result.sources).toEqual([]);
    });

    it("should compose multiple rule files", async () => {
      // Create test rule files
      const rulesDir = path.join(tempDir, ".ruleset", "rules");
      await fs.mkdir(rulesDir, { recursive: true });

      const rule1 = `---
rule:
  version: "1.0"
  template: false
description: "First rule"
---

# Instructions

Follow these guidelines:
- Use TypeScript
- Write tests
`;

      const rule2 = `---
rule:
  version: "2.0"
  template: false
description: "Second rule"
---

# Code Standards

Maintain these standards:
- Use ESLint
- Follow conventions
`;

      await fs.writeFile(path.join(rulesDir, "rule1.md"), rule1);
      await fs.writeFile(path.join(rulesDir, "rule2.md"), rule2);

      const result = await composer.compose({
        includeGlobs: [`${rulesDir}/**/*.md`],
        baseDir: tempDir,
      });

      expect(result.sources).toHaveLength(2);
      expect(result.content).toContain("# AGENTS");
      expect(result.content).toContain(
        "This file is composed from 2 rule files"
      );
      expect(result.content).toContain("# Instructions");
      expect(result.content).toContain("# Code Standards");
      expect(result.content).toContain("Use TypeScript");
      expect(result.content).toContain("Use ESLint");
    });

    it("should merge front matter correctly", async () => {
      const rulesDir = path.join(tempDir, ".ruleset", "rules");
      await fs.mkdir(rulesDir, { recursive: true });

      const rule1 = `---
rule:
  version: "1.0"
tags: ["typescript", "testing"]
labels: ["backend"]
---

# Content 1
`;

      const rule2 = `---
rule:
  version: "2.0"
tags: ["eslint", "conventions"]
labels: ["frontend"]
---

# Content 2
`;

      await fs.writeFile(path.join(rulesDir, "rule1.md"), rule1);
      await fs.writeFile(path.join(rulesDir, "rule2.md"), rule2);

      const result = await composer.compose({
        includeGlobs: [`${rulesDir}/**/*.md`],
        baseDir: tempDir,
      });

      expect(result.metadata.tags).toEqual([
        "typescript",
        "testing",
        "eslint",
        "conventions",
      ]);
      expect(result.metadata.labels).toEqual(["backend", "frontend"]);
      expect((result.metadata.rule as any).version).toBe("1.0"); // First one wins
    });

    it("should deduplicate headings when enabled", async () => {
      const rulesDir = path.join(tempDir, ".ruleset", "rules");
      await fs.mkdir(rulesDir, { recursive: true });

      const rule1 = `---
rule:
  version: "1.0"
---

# Instructions

First instructions
`;

      const rule2 = `---
rule:
  version: "2.0"
---

# Instructions

Second instructions (should be skipped)

# Different Section

This should remain
`;

      await fs.writeFile(path.join(rulesDir, "rule1.md"), rule1);
      await fs.writeFile(path.join(rulesDir, "rule2.md"), rule2);

      const result = await composer.compose({
        includeGlobs: [`${rulesDir}/**/*.md`],
        baseDir: tempDir,
        deduplicateHeadings: true,
      });

      expect(result.content).toContain("First instructions");
      expect(result.content).not.toContain("Second instructions");
      expect(result.content).toContain("Different Section");
      expect(result.content).toContain("This should remain");
    });

    it("should keep duplicate headings when deduplication disabled", async () => {
      const rulesDir = path.join(tempDir, ".ruleset", "rules");
      await fs.mkdir(rulesDir, { recursive: true });

      const rule1 = `---
rule:
  version: "1.0"
---

# Instructions

First instructions
`;

      const rule2 = `---
rule:
  version: "2.0"
---

# Instructions

Second instructions
`;

      await fs.writeFile(path.join(rulesDir, "rule1.md"), rule1);
      await fs.writeFile(path.join(rulesDir, "rule2.md"), rule2);

      const result = await composer.compose({
        includeGlobs: [`${rulesDir}/**/*.md`],
        baseDir: tempDir,
        deduplicateHeadings: false,
      });

      expect(result.content).toContain("First instructions");
      expect(result.content).toContain("Second instructions");
    });

    it("should resolve file references", async () => {
      const rulesDir = path.join(tempDir, ".ruleset", "rules");
      await fs.mkdir(rulesDir, { recursive: true });

      // Create referenced file
      const referencedContent = "This is referenced content";
      await fs.writeFile(
        path.join(tempDir, "referenced.md"),
        referencedContent
      );

      const rule1 = `---
rule:
  version: "1.0"
---

# Instructions

See @referenced for details.
`;

      await fs.writeFile(path.join(rulesDir, "rule1.md"), rule1);

      const result = await composer.compose({
        includeGlobs: [`${rulesDir}/**/*.md`],
        baseDir: tempDir,
        resolveFileReferences: true,
      });

      expect(result.content).toContain("[referenced](./referenced.md)");
    });

    it("should skip files without rule metadata", async () => {
      const rulesDir = path.join(tempDir, ".ruleset", "rules");
      await fs.mkdir(rulesDir, { recursive: true });

      const validRule = `---
rule:
  version: "1.0"
---

# Valid Rule
`;

      const invalidRule = `---
description: "Not a rule file"
---

# Invalid Rule
`;

      const noFrontmatter = `# No Frontmatter Rule
`;

      await fs.writeFile(path.join(rulesDir, "valid.md"), validRule);
      await fs.writeFile(path.join(rulesDir, "invalid.md"), invalidRule);
      await fs.writeFile(
        path.join(rulesDir, "no-frontmatter.md"),
        noFrontmatter
      );

      const result = await composer.compose({
        includeGlobs: [`${rulesDir}/**/*.md`],
        baseDir: tempDir,
      });

      expect(result.sources).toHaveLength(1);
      expect(result.content).toContain("Valid Rule");
      expect(result.content).not.toContain("Invalid Rule");
      expect(result.content).not.toContain("No Frontmatter Rule");
    });

  });
});
