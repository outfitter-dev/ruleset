import { describe, expect, it } from "vitest";
import { parse } from "../src";

describe("parser", () => {
  describe("parse", () => {
    it("should parse a document with frontmatter and body", () => {
      const content = `---
rule:
  version: '0.2.0'
title: Test Rule
cursor:
  path: ".cursor/rules/test.mdc"
---

# Test Content

This is the body content.`;

      const result = parse(content);

      expect(result.source.content).toBe(content);
      expect(result.source.frontmatter).toEqual({
        rule: { version: "0.2.0" },
        title: "Test Rule",
        cursor: {
          path: ".cursor/rules/test.mdc",
        },
      });
      expect(result.ast.sections).toEqual([]);
      expect(result.ast.imports).toEqual([]);
      expect(result.ast.variables).toEqual([]);
      expect(result.ast.markers).toEqual([]);
      expect(result.errors).toBeUndefined();
    });

    it("should parse a document without frontmatter", () => {
      const content = `# Test Content

This is a document without frontmatter.`;

      const result = parse(content);

      expect(result.source.content).toBe(content);
      expect(result.source.frontmatter).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });

    it("should handle empty frontmatter", () => {
      const content = `---
---

# Test Content`;

      const result = parse(content);

      expect(result.source.frontmatter).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });

    it("should report error for invalid YAML frontmatter", () => {
      const content = `---
invalid: yaml: content
  bad indentation
---

# Test Content`;

      const result = parse(content);

      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].message).toContain(
        "Invalid YAML syntax in frontmatter"
      );
      expect(result.errors?.[0].line).toBe(1);
    });

    it("should report error for unclosed frontmatter", () => {
      const content = `---
title: Test
description: Missing closing delimiter

# Test Content`;

      const result = parse(content);

      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].message).toContain(
        "Unclosed frontmatter block"
      );
      expect(result.errors?.[0].line).toBe(1);
    });

    it("should handle empty content", () => {
      const content = "";

      const result = parse(content);

      expect(result.source.content).toBe("");
      expect(result.source.frontmatter).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });

    it("should preserve body content exactly as-is", () => {
      const content = `---
title: Test
---

# Test Content

This has {{sections}} and {{$variables}} and {{>imports}} that should be preserved.`;

      const result = parse(content);

      const expectedBody =
        "\n# Test Content\n\nThis has {{sections}} and {{$variables}} and {{>imports}} that should be preserved.";
      expect(result.source.content).toContain(expectedBody);
    });
  });

  describe("schema validation", () => {
    it("should validate rule metadata schema", () => {
      const content = `---
rule:
  version: 123
  template: "not-boolean"
---

# Test Content`;

      const result = parse(content);

      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.[0].message).toContain(
        "Schema validation error: rule.version"
      );
      expect(result.errors?.[0].message).toContain("Expected string");
      expect(result.errors?.[1].message).toContain(
        "Schema validation error: rule.template"
      );
      expect(result.errors?.[1].message).toContain("Expected boolean");
    });

    it("should allow valid rule metadata without errors", () => {
      const content = `---
rule:
  version: "0.2.0"
  template: true
  globs: ["**/*.md"]
  name: "test-rule"
  description: "A test rule"
---

# Test Content`;

      const result = parse(content);

      expect(result.errors).toBeUndefined();
      expect(result.source.frontmatter).toEqual({
        rule: {
          version: "0.2.0",
          template: true,
          globs: ["**/*.md"],
          name: "test-rule",
          description: "A test rule",
        },
      });
    });

    it("should allow frontmatter without rule metadata", () => {
      const content = `---
title: Test Rule
cursor:
  path: ".cursor/rules/test.mdc"
---

# Test Content`;

      const result = parse(content);

      expect(result.errors).toBeUndefined();
      expect(result.source.frontmatter).toEqual({
        title: "Test Rule",
        cursor: {
          path: ".cursor/rules/test.mdc",
        },
      });
    });
  });
});
