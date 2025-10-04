import { describe, expect, it } from "bun:test";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

import {
  createAgentsMdProvider,
  createAmpProvider,
  createClaudeCodeProvider,
  createClineProvider,
  createCodexAgentProvider,
  createCodexProvider,
  createCopilotProvider,
  createCursorProvider,
  createGeminiProvider,
  createOpenCodeProvider,
  createRooCodeProvider,
  createWindsurfProvider,
  createZedProvider,
  type ProviderEntry,
} from "@ruleset/providers";
import type {
  CompileArtifact,
  RulesetDocument,
  RulesetProjectConfig,
  RulesetRuntimeContext,
} from "@ruleset/types";

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
): Promise<CompileArtifact[]> => {
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

  return Array.isArray(result.value) ? [...result.value] : [result.value];
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

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/cursor/.ruleset/rules/core.guidelines.rule.md`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/cursor/.ruleset/rules/AGENTS.md`
      );
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
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

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.cursor/rules/quickstart.mdc`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.cursor/rules/AGENTS.md`
      );
    });
  });

  describe("claude-code", () => {
    it("falls back to claude-code directory structure", async () => {
      const provider = createClaudeCodeProvider();
      const document = createDocument({
        id: "guides/welcome.rule.md",
      });

      const [artifact] = await compileWithProvider(provider, {
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

      const [artifact] = await compileWithProvider(provider, {
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

      const artifacts = await compileWithProvider(provider, {
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

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.github/copilot/search.rule.md`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.github/copilot/AGENTS.md`
      );
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
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

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
        rendered,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.diagnostics).toEqual(rendered.diagnostics);
      expect(primary.contents).toBe("Rendered");
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
    });
  });

  describe("windsurf", () => {
    it("uses markdown extension by default", async () => {
      const provider = createWindsurfProvider();
      const document = createDocument({
        path: `${cwd}/rules/formatting.rule.md`,
      });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/windsurf/rules/formatting.rule.md`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/windsurf/rules/AGENTS.md`
      );
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
    });

    it("switches to xml extension when configured", async () => {
      const provider = createWindsurfProvider();
      const document = createDocument({ id: "rules/formatting.rule.md" });

      const artifacts = await compileWithProvider(provider, {
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

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/windsurf/rules/formatting.rule.xml`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/windsurf/rules/AGENTS.md`
      );
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
    });
  });

  describe("codex", () => {
    it("falls back to provider scoped directory", async () => {
      const provider = createCodexProvider();
      const document = createDocument({ id: "guides/onboarding.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, shared] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/codex/guides/onboarding.rule.md`
      );

      expect(shared.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/codex/AGENTS.md`
      );
      expect(shared.contents).toBe(primary.contents);
      expect(shared.diagnostics).toEqual(primary.diagnostics);
    });

    it("accepts outputPath overrides", async () => {
      const provider = createCodexProvider();
      const document = createDocument({ id: "welcome.rule.md" });

      const artifacts = await compileWithProvider(provider, {
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

      expect(artifacts).toHaveLength(2);

      const [primary, shared] = artifacts;
      expect(primary.target.outputPath).toBe(`${cwd}/.codex/AGENTS.md`);
      expect(shared.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/codex/AGENTS.md`
      );
    });

    it("emits shared agents artifact when requested", async () => {
      const provider = createCodexProvider();
      const document = createDocument({ id: "overview.rule.md" });

      const artifacts = await compileWithProvider(provider, {
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

      expect(artifacts).toHaveLength(2);

      const [primary, shared] = artifacts;
      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/codex/overview.rule.md`
      );
      expect(shared.target.outputPath).toBe(`${cwd}/AGENTS.md`);
      expect(shared.contents).toBe(primary.contents);
      expect(shared.diagnostics).toEqual(primary.diagnostics);
    });

    it("skips shared artifact when disabled", async () => {
      const provider = createCodexProvider();
      const document = createDocument({ id: "overview.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            codex: {
              agentsOutputPath: "AGENTS.md",
              enableSharedAgents: false,
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/codex/overview.rule.md`
      );
    });
  });

  describe("amp", () => {
    it("writes artifacts under amp directory by default", async () => {
      const provider = createAmpProvider();
      const document = createDocument({ id: "docs/overview.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/amp/docs/overview.rule.md`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/amp/docs/AGENTS.md`
      );
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
    });

    it("respects outputPath overrides", async () => {
      const provider = createAmpProvider();
      const document = createDocument({ id: "docs/overview.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            amp: {
              outputPath: "./AGENTS.md",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.target.outputPath).toBe(`${cwd}/AGENTS.md`);
    });
  });

  describe("gemini", () => {
    it("writes artifacts under gemini directory by default", async () => {
      const provider = createGeminiProvider();
      const document = createDocument({ id: "docs/quickstart.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/gemini/docs/quickstart.rule.md`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/gemini/docs/AGENTS.md`
      );
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
    });

    it("accepts configured GEMINI.md output", async () => {
      const provider = createGeminiProvider();
      const document = createDocument({ id: "docs/quickstart.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            gemini: {
              outputPath: "./AGENTS.md",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.target.outputPath).toBe(`${cwd}/AGENTS.md`);
    });
  });

  describe("opencode", () => {
    it("defaults to provider scoped output", async () => {
      const provider = createOpenCodeProvider();
      const document = createDocument({ id: "docs/reference.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/opencode/docs/reference.rule.md`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/opencode/docs/AGENTS.md`
      );
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
    });

    it("normalises directory output overrides", async () => {
      const provider = createOpenCodeProvider();
      const document = createDocument({ id: "docs/reference.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            opencode: {
              outputPath: "./.opencode/rules/",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.opencode/rules/reference.rule.md`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.opencode/rules/AGENTS.md`
      );
    });
  });

  describe("zed", () => {
    it("writes artifacts under zed directory by default", async () => {
      const provider = createZedProvider();
      const document = createDocument({ id: "docs/checklist.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifacts).toHaveLength(2);

      const [primary, canonical] = artifacts;

      expect(primary.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/zed/docs/checklist.rule.md`
      );

      expect(canonical.target.outputPath).toBe(
        `${cwd}/.ruleset/dist/zed/docs/AGENTS.md`
      );
      expect(canonical.contents).toBe(primary.contents);
      expect(canonical.diagnostics).toEqual(primary.diagnostics);
    });

    it("supports configured rules directories", async () => {
      const provider = createZedProvider();
      const document = createDocument({ id: "docs/checklist.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            zed: {
              outputPath: "./.zed/rules/AGENTS.md",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.target.outputPath).toBe(
        `${cwd}/.zed/rules/AGENTS.md`
      );
    });
  });

  describe("codex-agent", () => {
    it("writes aggregated sections to AGENTS.md", async () => {
      const provider = createCodexAgentProvider();
      const first = createDocument({
        path: `${cwd}/.ruleset/rules/backend.rule.md`,
        contents: "Backend guidance",
      });
      const second = createDocument({
        path: `${cwd}/.ruleset/rules/frontend.rule.md`,
        contents: "Frontend guidance",
      });

      await compileWithProvider(provider, {
        context,
        document: first,
      });
      const [artifact] = await compileWithProvider(provider, {
        context,
        document: second,
      });

      expect(artifact.target.outputPath).toBe(`${cwd}/AGENTS.md`);
      expect(artifact.contents).toContain(
        "## Source: .ruleset/rules/backend.rule.md"
      );
      expect(artifact.contents).toContain(
        "## Source: .ruleset/rules/frontend.rule.md"
      );
      expect(artifact.contents).toContain("Backend guidance");
      expect(artifact.contents).toContain("Frontend guidance");
    });

    it("respects outputPath override", async () => {
      const provider = createCodexAgentProvider();
      const document = createDocument({ id: "docs/platform.rule.md" });

      const [artifact] = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            "codex-agent": {
              outputPath: "./.codex/AGENTS.md",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifact.target.outputPath).toBe(`${cwd}/.codex/AGENTS.md`);
    });
  });

  describe("roo-code", () => {
    it("writes to roo common rules directory by default", async () => {
      const provider = createRooCodeProvider();
      const document = createDocument({ id: "guides/overview.rule.md" });

      const [artifact] = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/.roo/rules/guides/overview.rule.md`
      );
    });

    it("writes mode-specific rules when mode provided", async () => {
      const provider = createRooCodeProvider();
      const document = createDocument({ id: "debugging.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            "roo-code": {
              mode: "debug",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.target.outputPath).toBe(
        `${cwd}/.roo/rules-debug/debugging.rule.md`
      );
    });

    it("supports multiple modes and optional common output", async () => {
      const provider = createRooCodeProvider();
      const document = createDocument({ id: "reference.rule.md" });

      const artifacts = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            "roo-code": {
              modes: ["architect", "docs-writer"],
              includeCommon: true,
            },
          },
        } as RulesetProjectConfig,
      });

      const expectedArtifacts = 3;
      expect(artifacts).toHaveLength(expectedArtifacts);
      const outputPaths = artifacts.map(
        (artifact) => artifact.target.outputPath
      );
      expect(outputPaths).toContain(`${cwd}/.roo/rules/reference.rule.md`);
      expect(outputPaths).toContain(
        `${cwd}/.roo/rules-architect/reference.rule.md`
      );
      expect(outputPaths).toContain(
        `${cwd}/.roo/rules-docs-writer/reference.rule.md`
      );
    });
  });

  describe("cline", () => {
    it("writes aggregated rules to .clinerules by default", async () => {
      const provider = createClineProvider();
      const document = createDocument({
        path: `${cwd}/.ruleset/rules/overview.rule.md`,
        contents: "Project overview",
      });

      const [artifact] = await compileWithProvider(provider, {
        context,
        document,
      });

      expect(artifact.target.outputPath).toBe(`${cwd}/.clinerules`);
      expect(artifact.contents).toContain("Project overview");
    });

    it("aggregates multiple documents into single rules file", async () => {
      const provider = createClineProvider();
      const alpha = createDocument({
        path: `${cwd}/.ruleset/rules/alpha.rule.md`,
        contents: "Alpha guidance",
      });
      const beta = createDocument({
        path: `${cwd}/.ruleset/rules/beta.rule.md`,
        contents: "Beta guidance",
      });

      await compileWithProvider(provider, {
        context,
        document: alpha,
      });
      const [artifact] = await compileWithProvider(provider, {
        context,
        document: beta,
      });

      expect(artifact.target.outputPath).toBe(`${cwd}/.clinerules`);
      expect(artifact.contents).toContain("Alpha guidance");
      expect(artifact.contents).toContain("Beta guidance");
      expect(artifact.contents).toContain(
        "# Source: .ruleset/rules/alpha.rule.md"
      );
      expect(artifact.contents).toContain(
        "# Source: .ruleset/rules/beta.rule.md"
      );
    });

    it("respects outputPath override", async () => {
      const provider = createClineProvider();
      const document = createDocument({ id: "docs/reference.rule.md" });

      const [artifact] = await compileWithProvider(provider, {
        context,
        document,
        projectConfig: {
          providers: {
            cline: {
              outputPath: "./config/.rules/clinerules.txt",
            },
          },
        } as RulesetProjectConfig,
      });

      expect(artifact.target.outputPath).toBe(
        `${cwd}/config/.rules/clinerules.txt`
      );
    });
  });

  describe("agents-md", () => {
    it("writes to AGENTS.md by default", async () => {
      const provider = createAgentsMdProvider();
      const document = createDocument({
        id: "docs/overview.rule.md",
      });

      const [artifact] = await compileWithProvider(provider, {
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

      const [artifact] = await compileWithProvider(provider, {
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

        const artifacts = await compileWithProvider(provider, {
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

        expect(artifacts.length).toBeGreaterThanOrEqual(1);
        const [artifact] = artifacts;
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
