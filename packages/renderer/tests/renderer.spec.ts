import { describe, expect, it } from "bun:test";

import { createPassthroughRenderer } from "@rulesets/renderer";
import type { RulesetDocument } from "@rulesets/types";

const createDocument = (contents: string): RulesetDocument => ({
  source: {
    id: "sample.rule.md",
    contents,
    format: "rule",
  },
  metadata: {
    frontMatter: {},
  },
  ast: {
    sections: [],
    imports: [],
    variables: [],
    markers: [],
  },
});

describe("createPassthroughRenderer", () => {
  it("returns the original document contents", () => {
    const render = createPassthroughRenderer();
    const document = createDocument("# Hello world");
    const target = {
      providerId: "noop",
      outputPath: "/virtual/output",
    };

    const result = render(document, target);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    expect(result.value.contents).toBe("# Hello world");
    expect(result.value.target).toEqual(target);
  });
});
