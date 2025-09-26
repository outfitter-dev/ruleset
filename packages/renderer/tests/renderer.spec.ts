import { describe, expect, it } from "bun:test";

import {
  createHandlebarsRenderer,
  type HandlebarsTemplateContext,
} from "@rulesets/renderer";
import type { RulesetDocument } from "@rulesets/types";

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
