import { describe, expect, it } from "bun:test";

import {
  createClaudeCodeProvider,
  createCopilotProvider,
  createCursorProvider,
  type ProviderEntry,
} from "@rulesets/providers";
import type {
  CompileArtifact,
  RulesetDocument,
  RulesetProjectConfig,
  RulesetRuntimeContext,
} from "@rulesets/types";

const createRuntimeContext = (cwd: string): RulesetRuntimeContext => ({
  version: "0.4.0-next.0",
  cwd,
  cacheDir: `${cwd}/.ruleset/cache`,
  env: new Map(),
});

const createDocument = (params: {
  contents?: string;
  path?: string;
  id?: string;
  frontMatter?: Record<string, unknown>;
}): RulesetDocument => ({
  source: {
    id: params.id ?? "rules/example.rule.md",
    path: params.path,
    contents: params.contents ?? "# Example\n",
    format: "rule",
  },
  metadata: {
    frontMatter: (params.frontMatter ?? {}) as Record<string, unknown>,
  },
  ast: {
    sections: [],
    imports: [],
    variables: [],
    markers: [],
  },
  diagnostics: [],
});

const compileWithProvider = async (
  provider: ProviderEntry,
  options: {
    context: RulesetRuntimeContext;
    document: RulesetDocument;
    projectConfig?: RulesetProjectConfig;
    targetOutput?: string;
    rendered?: CompileArtifact;
  }
) => {
  const { context, document, projectConfig, targetOutput, rendered } = options;

  const result = await provider.compile({
    document,
    context,
    target: {
      providerId: provider.handshake.providerId,
      outputPath: targetOutput ?? `${context.cwd}/.ruleset/dist`,
    },
    projectConfig,
    rendered,
  });

  if (!result.ok) {
    throw new Error(`Provider returned error: ${JSON.stringify(result.error)}`);
  }

  return result.value;
};

describe("first-party providers", () => {
  const cwd = "/virtual/project";
  const context = createRuntimeContext(cwd);

  describe("cursor", () => {
    it("writes artifacts under provider directory by default", async () => {
      const provider = createCursorProvider();
      const document = createDocument({
        path: `${cwd}/.ruleset/rules/core.guidelines.rule.md`,
      });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/cursor/.ruleset/rules/core.guidelines.rule.md`
      );
    });

    it("respects per-document outputPath overrides", async () => {
      const provider = createCursorProvider();
      const document = createDocument({
        path: `${cwd}/rules/quickstart.rule.md`,
        frontMatter: {
          cursor: {
            outputPath: "./.cursor/rules/quickstart.mdc",
          },
        },
      });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.cursor/rules/quickstart.mdc`
      );
    });
  });

  describe("claude-code", () => {
    it("falls back to claude-code directory structure", async () => {
      const provider = createClaudeCodeProvider();
      const document = createDocument({
        id: "guides/welcome.rule.md",
      });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/claude-code/guides/welcome.rule.md`
      );
    });

    it("uses configured output path from project config", async () => {
      const provider = createClaudeCodeProvider();
      const document = createDocument({ id: "welcome.rule.md" });

      const projectConfig: RulesetProjectConfig = {
        providers: {
          "claude-code": {
            outputPath: "./CLAUDE.md",
          },
        },
      } as RulesetProjectConfig;

      const artifact = await compileWithProvider(provider, {
        context,
        document,
        projectConfig,
      });

      expect(artifact.target.outputPath).toBe(`${cwd}/CLAUDE.md`);
    });
  });

  describe("copilot", () => {
    it("normalises directory hints for outputPath overrides", async () => {
      const provider = createCopilotProvider();
      const document = createDocument({ id: "src/features/search.rule.md" });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            copilot: {
              outputPath: "./.github/copilot/",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.github/copilot/search.rule.md`
      );
    });

    it("keeps rendered diagnostics intact", async () => {
      const provider = createCopilotProvider();
      const document = createDocument({});

      const rendered: CompileArtifact = {
        target: {
          providerId: "copilot",
          outputPath: `${cwd}/.ruleset/dist/copilot/placeholder.md`,
        },
        contents: "Rendered",
        diagnostics: [
          {
            level: "warning",
            message: "Example warning",
          },
        ],
      };

      const artifact = await compileWithProvider(provider, {
        context,
        document,
        rendered,
      });

      expect(artifact.diagnostics).toEqual(rendered.diagnostics);
      expect(artifact.contents).toBe("Rendered");
    });
  });
});
