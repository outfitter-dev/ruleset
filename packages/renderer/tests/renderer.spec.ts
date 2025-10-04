import { describe, expect, it } from "bun:test";

import {
  createHandlebarsRenderer,
  type HandlebarsTemplateContext,
  type RendererFormatHandler,
  registerRendererFormat,
  resetRendererFormatsForTest,
  unregisterRendererFormat,
} from "@ruleset/renderer";
import { createResultOk, type RulesetDocument } from "@ruleset/types";

const createDocument = (
  contents: string,
  overrides: Partial<RulesetDocument> = {}
): RulesetDocument => ({
  source: {
    id: overrides.source?.id ?? "sample.rule.md",
    contents,
    format: overrides.source?.format ?? "rule",
    path: overrides.source?.path,
    template: overrides.source?.template,
  },
  metadata: overrides.metadata ?? {
    frontMatter: overrides.metadata?.frontMatter ?? {},
  },
  ast:
    overrides.ast ??
    ({
      sections: [],
      imports: [],
      variables: [],
      markers: [],
    } satisfies RulesetDocument["ast"]),
  dependencies: overrides.dependencies,
});

describe("createHandlebarsRenderer", () => {
  it("passes through content when Handlebars is not requested", () => {
    const renderer = createHandlebarsRenderer();
    const document = createDocument("# Hello world\n");
    const target = {
      providerId: "noop",
      outputPath: "/virtual/output",
      capabilities: ["render:markdown"],
    } as const;

    const result = renderer(document, target);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    expect(result.value.contents).toBe("# Hello world\n");
  });

  it("renders templates with default helpers when capability present", () => {
    const renderer = createHandlebarsRenderer();
    const document = createDocument("Hello {{uppercase user}}!\n");
    const target = {
      providerId: "cursor",
      outputPath: "/virtual/cursor.md",
      capabilities: ["render:handlebars"],
    } as const;
    const context: HandlebarsTemplateContext = {
      user: "world",
    };

    const result = renderer(document, target, {
      handlebars: {
        context,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    expect(result.value.contents).toBe("Hello WORLD!\n");
  });

  it("preserves frontmatter when rendering with Handlebars", () => {
    const renderer = createHandlebarsRenderer();
    const source = ["---", "name: example", "---", "Hello {{name}}", ""].join(
      "\n"
    );
    const document = createDocument(source, {
      metadata: { frontMatter: { name: "example" } },
    });
    const target = {
      providerId: "agents-md",
      outputPath: "/virtual/agents.md",
      capabilities: ["render:handlebars"],
    } as const;

    const result = renderer(document, target, {
      handlebars: {
        context: { name: "Rulesets" },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    const expected = ["---", "name: example", "---", "Hello Rulesets", ""].join(
      "\n"
    );
    expect(result.value.contents).toBe(expected);
  });

  it("renders with provided partials", () => {
    const renderer = createHandlebarsRenderer();
    const document = createDocument("Intro\n{{> footer }}\n");
    const target = {
      providerId: "claude-code",
      outputPath: "/virtual/claude.md",
      capabilities: ["render:handlebars", "render:handlebars:partials"],
    } as const;
    const context: HandlebarsTemplateContext = {
      provider: {
        id: "claude-code",
      },
    };

    const result = renderer(document, target, {
      handlebars: {
        context,
        partials: {
          footer: "Compiled for {{provider.id}}",
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    expect(result.value.contents).toBe("Intro\nCompiled for claude-code");
  });

  it("renders XML sections when format is xml", () => {
    const renderer = createHandlebarsRenderer();
    const document = createDocument(
      [
        "## Instructions",
        "Follow the steps",
        "",
        "## Examples",
        "- Example one",
        "",
      ].join("\n")
    );
    const target = {
      providerId: "xml-provider",
      outputPath: "/virtual/output.xml",
      capabilities: ["render:markdown"],
    } as const;

    const result = renderer(document, target, { format: "xml" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    const expected = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<ruleset>",
      "  <instructions>",
      "    <![CDATA[Follow the steps]]>",
      "  </instructions>",
      "  <examples>",
      "    <![CDATA[- Example one]]>",
      "  </examples>",
      "</ruleset>",
    ].join("\n");

    expect(result.value.contents).toBe(expected);
  });

  it("normalises invalid section names for XML output", () => {
    const renderer = createHandlebarsRenderer();
    const document = createDocument(
      ["## 123 Start", "Content", "", "## 123 Start", "More"].join("\n")
    );
    const target = {
      providerId: "xml-provider",
      outputPath: "/virtual/output.xml",
      capabilities: ["render:markdown"],
    } as const;

    const result = renderer(document, target, { format: "xml" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    expect(result.value.contents).toContain("<section_1_123_start>");
    expect(
      result.value.diagnostics.some((diagnostic) =>
        diagnostic.message.includes("normalised")
      )
    ).toBe(true);
  });

  it("supports custom renderer formats via registry", () => {
    resetRendererFormatsForTest();
    const renderer = createHandlebarsRenderer();
    const document = createDocument("Hello world\n");
    const target = {
      providerId: "json-provider",
      outputPath: "/virtual/output.json",
      capabilities: ["render:markdown"],
    } as const;

    const handler: RendererFormatHandler = ({ artifact }) =>
      createResultOk({
        ...artifact,
        contents: JSON.stringify({ contents: artifact.contents }),
        diagnostics: [],
      });

    registerRendererFormat({ id: "json", handler });

    const result = renderer(document, target, { format: "json" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    expect(result.value.contents).toBe(
      JSON.stringify({ contents: "Hello world\n" })
    );

    unregisterRendererFormat("json");
  });

  it("allows per-render format overrides without global registration", () => {
    const renderer = createHandlebarsRenderer();
    const document = createDocument("content\n");
    const target = {
      providerId: "inline-provider",
      outputPath: "/virtual/output.custom",
      capabilities: ["render:markdown"],
    } as const;

    const result = renderer(document, target, {
      format: "custom-inline",
      formats: [
        {
          id: "custom-inline",
          handler: ({ artifact }) =>
            createResultOk({
              ...artifact,
              contents: artifact.contents.trim().toUpperCase(),
              diagnostics: [],
            }),
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected renderer to succeed");
    }

    expect(result.value.contents).toBe("CONTENT");
  });

  it("reports diagnostics when a renderer format is missing", () => {
    resetRendererFormatsForTest();
    const renderer = createHandlebarsRenderer();
    const document = createDocument("noop\n");
    const target = {
      providerId: "missing-format",
      outputPath: "/virtual/output.bin",
      capabilities: ["render:markdown"],
    } as const;

    const result = renderer(document, target, { format: "not-registered" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected renderer to fail");
    }

    expect(result.error).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          message: expect.stringContaining("not registered"),
        }),
      ])
    );
  });

  it("returns diagnostics when Handlebars compilation fails", () => {
    const renderer = createHandlebarsRenderer();
    const document = createDocument(
      "{{#unknownHelper}}oops{{/unknownHelper}}\n"
    );
    const target = {
      providerId: "windsurf",
      outputPath: "/virtual/windsurf.md",
      capabilities: ["render:handlebars"],
    } as const;

    const result = renderer(document, target, {
      handlebars: {
        context: {},
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected renderer to fail");
    }

    expect(result.error).toHaveLength(1);
    expect(result.error[0]?.message).toContain("Handlebars rendering failed");
  });
});
