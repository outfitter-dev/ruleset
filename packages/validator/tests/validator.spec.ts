import { parseRuleset } from "@rulesets/parser";
import { validateDocument } from "@rulesets/validator";
import { describe, expect, it } from "vitest";

const EXPECTED_STRICT_ERROR_COUNT = 4;

const parse = (contents: string) =>
  parseRuleset({
    id: "test",
    path: "test.rule.md",
    contents,
    format: "rule",
  });

describe("@rulesets/validator", () => {
  it("warns when frontmatter is missing in non-strict mode", () => {
    const { document } = parse("# Hello\n\nBody");
    const result = validateDocument(document);
    expect(result.diagnostics.some((diag) => diag.level === "warning")).toBe(
      true
    );
  });

  it("errors when frontmatter is missing in strict mode", () => {
    const { document } = parse("# Hello\n\nBody");
    const result = validateDocument(document, { strict: true });
    expect(result.diagnostics.some((diag) => diag.level === "error")).toBe(
      true
    );
  });

  it("validates rule metadata structure", () => {
    const { document } = parse(`---
rule:
  version: 123
  template: "yes"
  globs: [123]
---

# Heading`);
    const result = validateDocument(document, { strict: true });
    const errorMessages = result.diagnostics
      .filter((diag) => diag.level === "error")
      .map((diag) => diag.message);
    expect(errorMessages).toHaveLength(EXPECTED_STRICT_ERROR_COUNT);
    expect(
      errorMessages.some(
        (message) =>
          message.includes("rule.version") && message.includes("semantic")
      )
    ).toBe(true);
    expect(
      errorMessages.some(
        (message) =>
          message.includes("rule.template") && message.includes("boolean")
      )
    ).toBe(true);
  });

  it("accepts valid rule metadata", () => {
    const { document } = parse(`---
rule:
  version: 0.4.0
  template: true
  globs:
    - "**/*.md"
description: Sample
---

# Heading`);
    const result = validateDocument(document);
    expect(result.diagnostics.every((diag) => diag.level !== "error")).toBe(
      true
    );
  });

  it("warns when Handlebars braces used without template flag", () => {
    const { document } = parse(`---
rule:
  version: 0.4.0
---

# Heading

Use {{helper}} syntax.`);
    const result = validateDocument(document);
    expect(
      result.diagnostics.some((diag) =>
        diag.message.includes("Handlebars-style braces")
      )
    ).toBe(true);
  });

  it("requires H1 heading in body", () => {
    const { document } = parse(`---
rule:
  version: 0.4.0
---

Paragraph without heading.`);
    const result = validateDocument(document, { strict: true });
    expect(
      result.diagnostics.some((diag) => diag.message.includes("H1 heading"))
    ).toBe(true);
  });
});
