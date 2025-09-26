import { describe, expect, it } from "bun:test";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

import {
  createAgentsMdProvider,
  createClaudeCodeProvider,
  createCodexProvider,
  createCopilotProvider,
  createCursorProvider,
  createWindsurfProvider,
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

  describe("windsurf", () => {
    it("uses markdown extension by default", async () => {
      const provider = createWindsurfProvider();
      const document = createDocument({
        path: `${cwd}/rules/formatting.rule.md`,
      });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/windsurf/rules/formatting.rule.md`
      );
    });

    it("switches to xml extension when configured", async () => {
      const provider = createWindsurfProvider();
      const document = createDocument({ id: "rules/formatting.rule.md" });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            windsurf: {
              format: "xml",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/windsurf/rules/formatting.rule.xml`
      );
    });
  });

  describe("codex", () => {
    it("falls back to provider scoped directory", async () => {
      const provider = createCodexProvider();
      const document = createDocument({ id: "guides/onboarding.rule.md" });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/codex/guides/onboarding.rule.md`
      );
    });

    it("accepts outputPath overrides", async () => {
      const provider = createCodexProvider();
      const document = createDocument({ id: "welcome.rule.md" });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            codex: {
              outputPath: ".codex/AGENTS.md",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifact.target.outputPath).toBe(`${cwd}/.codex/AGENTS.md`);
    });

    it("emits info diagnostic when shared agents path is requested", async () => {
      const provider = createCodexProvider();
      const document = createDocument({ id: "overview.rule.md" });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            codex: {
              agentsOutputPath: "AGENTS.md",
            },
          },
        } as RulesetProjectConfig,
      });

      const messages = artifact.diagnostics.map(
        (diagnostic) => diagnostic.message
      );
      expect(
        messages.some((message) => message.includes("enableSharedAgents"))
      ).toBe(true);
    });
  });

  describe("agents-md", () => {
    it("writes to AGENTS.md by default", async () => {
      const provider = createAgentsMdProvider();
      const document = createDocument({
        id: "docs/overview.rule.md",
      });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/agents-md/docs/overview.rule.md`
      );
    });

    it("respects outputPath overrides", async () => {
      const provider = createAgentsMdProvider();
      const document = createDocument({ id: "docs/setup.rule.md" });

      const artifact = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            "agents-md": {
              outputPath: "AGENTS.md",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifact.target.outputPath).toBe(`${cwd}/AGENTS.md`);
    });

    it("composes aggregated content when useComposer is true", async () => {
      const provider = createAgentsMdProvider();
      const tempDir = await fsPromises.mkdtemp(
        path.join(process.cwd(), "agents-md-test-")
      );

      try {
        const rulesDir = path.join(tempDir, ".ruleset", "rules");
        await fsPromises.mkdir(rulesDir, { recursive: true });
        await fsPromises.writeFile(
          path.join(rulesDir, "alpha.rule.md"),
          "# Alpha\nContent A\n"
        );
        await fsPromises.writeFile(
          path.join(rulesDir, "beta.rule.md"),
          "# Beta\nContent B\n"
        );

        const document = createDocument({
          id: "docs/intro.rule.md",
          path: path.join(tempDir, "docs", "intro.rule.md"),
        });

        const artifact = await compileWithProvider(provider, {
          context: {
            ...context,
            cwd: tempDir,
            cacheDir: path.join(tempDir, ".ruleset", "cache"),
          },
          document,
          projectConfig: {
            providers: {
              "agents-md": {
                useComposer: true,
              },
            },
          } as RulesetProjectConfig,
        });

        expect(artifact.diagnostics.length).toBeGreaterThanOrEqual(0);
        expect(artifact.contents).toContain("# AGENTS");
        expect(artifact.contents).toContain(
          "<!-- Source: .ruleset/rules/alpha.rule.md -->"
        );
        expect(artifact.contents).toContain("Content A");
        expect(artifact.contents).toContain("Content B");
      } finally {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
