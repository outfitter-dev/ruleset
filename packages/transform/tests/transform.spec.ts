import { describe, expect, it } from "bun:test";

import {
  composeTransforms,
  identityTransform,
  type RulesetTransform,
  runTransforms,
} from "@ruleset/transform";
import type { RulesetDocument } from "@ruleset/types";

const createDocument = (
  overrides: Partial<RulesetDocument> = {}
): RulesetDocument => ({
  source: {
    id: "sample.rule.md",
    contents: "# Sample",
    format: "rule",
    ...(overrides.source ?? {}),
  },
  metadata: {
    frontMatter: {},
    ...(overrides.metadata ?? {}),
  },
  ast: {
    sections: [],
    imports: [],
    variables: [],
    markers: [],
    ...(overrides.ast ?? {}),
  },
  diagnostics: overrides.diagnostics,
  dependencies: overrides.dependencies,
});

describe("transform helpers", () => {
  it("identityTransform returns the same document reference", () => {
    const document = createDocument();
    const result = identityTransform(document);

    expect(result).toBe(document);
  });

  it("composeTransforms composes functions in order", () => {
    const markers: string[] = [];

    const first: RulesetTransform = (document) => {
      markers.push("first");
      return document;
    };
    const second: RulesetTransform = (document) => {
      markers.push("second");
      return document;
    };

    const composed = composeTransforms(first, second);
    composed(createDocument());

    expect(markers).toEqual(["first", "second"]);
  });

  it("runTransforms returns diagnostics alongside the document", () => {
    const document = createDocument();
    const result = runTransforms(document, identityTransform);

    expect(result.document).toBe(document);
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.diagnostics.length).toBe(0);
  });

  it("runTransforms populates partial dependencies", () => {
    const document = createDocument({
      source: {
        id: "with-partials.rule.md",
        contents: "# Example\n{{> footer }}\n{{> header}}",
        format: "rule",
      },
    });

    const result = runTransforms(document);

    expect(result.document.dependencies).toEqual([
      { kind: "partial", identifier: "footer" },
      { kind: "partial", identifier: "header" },
    ]);
  });
});
