import {
  buildHandlebarsOptions,
  readProviderConfig,
  resolveProviderSettings,
} from "@rulesets/providers";
import type { JsonValue, RulesetDocument } from "@rulesets/types";
import { describe, expect, it, vi } from "vitest";

const makeDocument = (
  frontmatter: Record<string, unknown>
): RulesetDocument => ({
  source: {
    id: "test",
    path: "test.rule.md",
    contents: "---\n---\n# Heading",
    format: "rule",
  },
  metadata: {
    frontMatter: frontmatter as Record<string, JsonValue>,
    version: "0.4.0-next.0",
  },
  ast: {
    sections: [],
    imports: [],
    variables: [],
    markers: [],
  },
});

describe("@rulesets/providers utils", () => {
  const makeLogger = () => ({
    warn: vi.fn(),
    info: vi.fn(),
  });

  it("reads provider configuration from frontmatter", () => {
    const document = makeDocument({ cursor: { enabled: true } });
    const config = readProviderConfig(document, "cursor");
    expect(config).toEqual({ enabled: true });
  });

  it("returns undefined when configuration is missing", () => {
    const document = makeDocument({});
    const config = readProviderConfig(document, "cursor");
    expect(config).toBeUndefined();
  });

  it("captures raw boolean provider toggles", () => {
    const settings = resolveProviderSettings({ cursor: false }, "cursor");
    expect(settings).toEqual({ enabled: false, source: "provider" });
  });

  it("builds Handlebars options from boolean config", () => {
    const logger = makeLogger();
    const options = buildHandlebarsOptions({
      providerId: "cursor",
      config: { handlebars: true },
      logger,
    });

    expect(options).toEqual({
      handlebars: {
        force: true,
        helpers: undefined,
        partials: undefined,
      },
      projectConfigOverrides: undefined,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("validates partial names and types", () => {
    const logger = makeLogger();
    const options = buildHandlebarsOptions({
      providerId: "cursor",
      config: {
        handlebars: {
          partials: {
            header: "Header content",
            "invalid name": "bad",
            invalidType: 42,
          },
        },
      },
      logger,
    });

    expect(options?.handlebars?.partials).toEqual({ header: "Header content" });
    expect(logger.warn).toHaveBeenCalled();
  });
});
