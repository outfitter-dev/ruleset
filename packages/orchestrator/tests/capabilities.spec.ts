import { describe, expect, test, vi } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createDefaultProviders,
  defineProvider,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderEntry,
  providerCapability,
} from "@rulesets/providers";
import {
  type CompileArtifact,
  type CompileTarget,
  createResultOk,
  RULESETS_VERSION_TAG,
  type RulesetRuntimeContext,
  type RulesetSource,
  type RulesetVersionTag,
} from "@rulesets/types";

import { type CompilationEvent, createOrchestrator } from "../src/index";

const createRuntimeContext = (
  overrides: Partial<RulesetRuntimeContext> = {}
): RulesetRuntimeContext => ({
  version: RULESETS_VERSION_TAG,
  cwd: process.cwd(),
  cacheDir: "/tmp/rulesets-cache",
  env: new Map<string, string>(),
  ...overrides,
});

const createSource = (
  overrides: Partial<RulesetSource> = {}
): RulesetSource => ({
  id: "sample",
  path: "/virtual/sample.rule.md",
  contents: "# Sample\n",
  format: "rule",
  ...overrides,
});

describe("orchestrator capability negotiation", () => {
  test("allows compilation when provider satisfies required capabilities", async () => {
    const orchestrator = createOrchestrator({
      providers: createDefaultProviders(),
    });

    const result = await orchestrator({
      context: createRuntimeContext(),
      sources: [createSource()],
      targets: [
        {
          providerId: "cursor",
          outputPath: "/virtual/output",
          capabilities: ["render:markdown"],
        },
      ],
    });

    expect(result.artifacts.length).toBe(1);
    expect(result.diagnostics.length).toBe(0);
  });

  test("skips providers that are missing required capabilities", async () => {
    const compile = vi.fn(() =>
      createResultOk<CompileArtifact>({
        target: {
          providerId: "noop",
          outputPath: "/virtual/output",
          capabilities: [],
        },
        contents: "noop",
        diagnostics: [],
      })
    );

    const orchestrator = createOrchestrator({
      providers: [
        defineProvider({
          handshake: {
            providerId: "noop",
            version: "0.0.1-test",
            sdkVersion: PROVIDER_SDK_VERSION,
            capabilities: [],
            sandbox: { mode: "in-process" },
          },
          compile,
        }),
      ],
    });

    const result = await orchestrator({
      context: createRuntimeContext(),
      sources: [createSource()],
      targets: [
        {
          providerId: "noop",
          outputPath: "/virtual/output",
          capabilities: ["render:markdown"],
        },
      ],
    });

    expect(result.artifacts.length).toBe(0);
    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0]?.message).toContain("render:markdown");
    expect(result.diagnostics[0]?.level).toBe("error");
    expect(compile).not.toHaveBeenCalled();
  });

  test("surfaces handlebars capability requirement when template enabled", async () => {
    const compile = vi.fn();

    const orchestrator = createOrchestrator({
      providers: [
        defineProvider({
          handshake: {
            providerId: "plain",
            version: "0.0.2-test",
            sdkVersion: PROVIDER_SDK_VERSION,
            capabilities: [providerCapability("render:markdown")],
            sandbox: { mode: "in-process" },
          },
          compile,
        }),
      ],
    });

    const result = await orchestrator({
      context: createRuntimeContext(),
      sources: [createSource({ template: true })],
      targets: [
        {
          providerId: "plain",
          outputPath: "/virtual/output",
        },
      ],
    });

    expect(result.artifacts.length).toBe(0);
    expect(result.diagnostics[0]?.message).toContain("render:handlebars");
    expect(compile).not.toHaveBeenCalled();
  });

  test("passes derived handlebars capabilities to provider compile input", async () => {
    const compile = vi.fn((input: ProviderCompileInput) => {
      expect(input.target.capabilities).toContain("render:handlebars");

      return createResultOk<CompileArtifact>({
        target: input.target,
        contents: "templated",
        diagnostics: [],
      });
    });

    const orchestrator = createOrchestrator({
      providers: [
        defineProvider({
          handshake: {
            providerId: "templated",
            version: "0.0.3-test",
            sdkVersion: PROVIDER_SDK_VERSION,
            capabilities: [providerCapability("render:handlebars")],
            sandbox: { mode: "in-process" },
          },
          compile,
        }),
      ],
    });

    const result = await orchestrator({
      context: createRuntimeContext(),
      sources: [createSource({ template: true })],
      targets: [
        {
          providerId: "templated",
          outputPath: "/virtual/output",
        },
      ],
    });

    expect(compile).toHaveBeenCalledTimes(1);
    expect(result.artifacts.length).toBe(1);
    expect(result.artifacts[0]?.target.capabilities).toContain(
      "render:handlebars"
    );
  });

  test("skips providers with incompatible SDK versions", async () => {
    const compile = vi.fn((input: ProviderCompileInput) =>
      createResultOk<CompileArtifact>({
        target: input.target,
        contents: input.document.source.contents,
        diagnostics: [],
      })
    );

    const incompatibleProvider = defineProvider({
      handshake: {
        providerId: "legacy",
        version: "0.0.1-test",
        sdkVersion: "1.0.0" as RulesetVersionTag,
        capabilities: [providerCapability("render:markdown")],
        sandbox: { mode: "in-process" },
      },
      compile,
    });

    const events: CompilationEvent[] = [];
    const orchestrator = createOrchestrator({
      providers: [incompatibleProvider],
      onEvent: (event) => {
        events.push(event);
      },
    });

    const result = await orchestrator({
      context: createRuntimeContext(),
      sources: [createSource()],
      targets: [
        {
          providerId: "legacy",
          outputPath: "/virtual/output",
        },
      ],
    });

    expect(compile).not.toHaveBeenCalled();
    expect(result.artifacts.length).toBe(0);
    expect(
      result.diagnostics.some(
        (diag) => diag.message.includes("SDK") && diag.tags?.includes("legacy")
      )
    ).toBe(true);

    const skippedEvent = events.find(
      (event): event is TargetSkippedEvent =>
        event.kind === "target:skipped" &&
        event.reason === "incompatible-provider"
    );

    expect(skippedEvent).toBeDefined();
    expect(skippedEvent?.diagnostics.length).toBeGreaterThan(0);
  });

  test("executes providers inside bun subprocess sandbox", async () => {
    const sandboxDir = await mkdtemp(path.join(tmpdir(), "rulesets-sandbox-"));
    const scriptPath = path.join(sandboxDir, "provider.js");

    await writeFile(
      scriptPath,
      `const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(chunks.join(""));
    const artifact = {
      target: payload.input.target,
      contents: payload.input.document.source.contents + " :: sandbox",
      diagnostics: [],
    };
    process.stdout.write(JSON.stringify({ ok: true, artifact }));
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    process.exit(1);
  }
});
`,
      "utf8"
    );

    const compile = vi.fn<ProviderEntry["compile"]>();

    const sandboxedProvider = defineProvider({
      handshake: {
        providerId: "sandbox",
        version: "0.0.4-test",
        sdkVersion: PROVIDER_SDK_VERSION,
        capabilities: [providerCapability("render:markdown")],
        sandbox: {
          mode: "bun-subprocess",
          entry: scriptPath,
        },
      },
      compile,
    });

    const orchestrator = createOrchestrator({ providers: [sandboxedProvider] });

    try {
      const result = await orchestrator({
        context: createRuntimeContext(),
        sources: [createSource()],
        targets: [
          {
            providerId: "sandbox",
            outputPath: "/virtual/output",
          },
        ],
      });

      expect(compile).not.toHaveBeenCalled();
      expect(result.artifacts.length).toBe(1);
      expect(result.artifacts[0]?.contents).toContain(":: sandbox");
    } finally {
      await rm(sandboxDir, { recursive: true, force: true });
    }
  });

  test("hard-fails when configuration requires missing capabilities", async () => {
    const provider = defineProvider({
      handshake: {
        providerId: "strict",
        version: "0.0.5-test",
        sdkVersion: PROVIDER_SDK_VERSION,
        capabilities: [],
        sandbox: { mode: "in-process" },
      },
      compile: () =>
        createResultOk<CompileArtifact>({
          target: {
            providerId: "strict",
            outputPath: "/virtual/output",
          },
          contents: "noop",
          diagnostics: [],
        }),
    });

    const orchestrator = createOrchestrator({ providers: [provider] });

    await expect(
      orchestrator({
        context: createRuntimeContext(),
        sources: [createSource()],
        targets: [
          {
            providerId: "strict",
            outputPath: "/virtual/output",
          },
        ],
        projectConfig: {
          providers: {
            strict: {
              failOnMissingCapabilities: true,
            },
          },
        },
      })
    ).rejects.toMatchObject({ code: "PROVIDER_CAPABILITY_UNSUPPORTED" });
  });

  test("emits streaming events for each pipeline stage", async () => {
    const events: CompilationEvent[] = [];

    const orchestrator = createOrchestrator({
      providers: createDefaultProviders(),
      onEvent: (event) => {
        events.push(event);
      },
    });

    await orchestrator({
      context: createRuntimeContext(),
      sources: [createSource()],
      targets: [
        {
          providerId: "cursor",
          outputPath: "/virtual/output",
        },
      ],
    });

    const kinds = events.map((event) => event.kind);
    expect(kinds[0]).toBe("pipeline:start");
    expect(kinds).toContain("source:parsed");
    expect(kinds).toContain("target:rendered");
    expect(kinds).toContain("target:compiled");
    expect(kinds.at(-1)).toBe("pipeline:end");
  });

  test("reuses cached artifacts when source unchanged", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "rulesets-cache-"));

    const compile = vi.fn((input: ProviderCompileInput) =>
      createResultOk<CompileArtifact>({
        target: input.target,
        contents: input.document.source.contents,
        diagnostics: [],
      })
    );

    const provider = defineProvider({
      handshake: {
        providerId: "memo",
        version: "0.0.1-test",
        sdkVersion: PROVIDER_SDK_VERSION,
        capabilities: [providerCapability("render:markdown")],
        sandbox: { mode: "in-process" },
      },
      compile,
    });

    const orchestrator = createOrchestrator({ providers: [provider] });

    const source = createSource();
    const target: CompileTarget = {
      providerId: "memo",
      outputPath: path.join(cacheDir, "out", "memo.md"),
    };

    try {
      await orchestrator({
        context: createRuntimeContext({ cacheDir }),
        sources: [source],
        targets: [target],
      });

      expect(compile).toHaveBeenCalledTimes(1);

      compile.mockClear();
      const events: CompilationEvent[] = [];

      await orchestrator(
        {
          context: createRuntimeContext({ cacheDir }),
          sources: [source],
          targets: [target],
        },
        {
          onEvent: (event) => {
            events.push(event);
          },
        }
      );

      expect(compile).not.toHaveBeenCalled();
      expect(events.some((event) => event.kind === "target:cached")).toBe(true);
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  test("invalidates cached sources when dependency paths change", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "rulesets-deps-"));
    const rulesDir = path.join(root, ".ruleset", "rules");
    const partialsDir = path.join(root, ".ruleset", "partials");
    const cacheDir = path.join(root, ".ruleset", "cache");
    await mkdir(rulesDir, { recursive: true });
    await mkdir(partialsDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });

    const rulePath = path.join(rulesDir, "example.rule.md");
    const partialPath = path.join(partialsDir, "footer.md");

    await writeFile(
      rulePath,
      `---\nrule:\n  version: "0.4.0"\n---\n\n# Example\n\n{{> footer }}`,
      "utf8"
    );
    await writeFile(partialPath, "Footer", "utf8");

    const compile = vi.fn((input: ProviderCompileInput) =>
      createResultOk<CompileArtifact>({
        target: input.target,
        contents: input.document.source.contents,
        diagnostics: [],
      })
    );

    const provider = defineProvider({
      handshake: {
        providerId: "noop",
        version: "0.0.1-test",
        sdkVersion: PROVIDER_SDK_VERSION,
        capabilities: [providerCapability("render:markdown")],
        sandbox: { mode: "in-process" },
      },
      compile,
    });

    const orchestrator = createOrchestrator({ providers: [provider] });

    const context = createRuntimeContext({
      cwd: root,
      cacheDir,
    });

    const target: CompileTarget = {
      providerId: "noop",
      outputPath: path.join(root, "dist", "noop.md"),
    };

    const source = createSource({
      id: "example.rule.md",
      path: rulePath,
      contents: await readFile(rulePath, "utf8"),
    });

    try {
      const first = await orchestrator({
        context,
        sources: [source],
        targets: [target],
      });

      expect(compile).toHaveBeenCalledTimes(1);
      expect(first.sourceSummaries?.[0]?.dependencies).toContain(partialPath);

      await orchestrator({
        context,
        sources: [source],
        targets: [target],
      });

      expect(compile).toHaveBeenCalledTimes(1);

      await orchestrator(
        {
          context,
          sources: [source],
          targets: [target],
        },
        {
          invalidatePaths: [partialPath],
        }
      );

      expect(compile).toHaveBeenCalledTimes(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
