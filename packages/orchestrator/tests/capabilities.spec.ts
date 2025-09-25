import { describe, expect, test, vi } from "bun:test";

import {
  createDefaultProviders,
  defineProvider,
  type ProviderCompileInput,
  providerCapability,
} from "@rulesets/providers";
import {
  type CompileArtifact,
  createResultOk,
  RULESETS_VERSION_TAG,
  type RulesetRuntimeContext,
  type RulesetSource,
} from "@rulesets/types";

import { createOrchestrator } from "../src/index";

const createRuntimeContext = (): RulesetRuntimeContext => ({
  version: RULESETS_VERSION_TAG,
  cwd: process.cwd(),
  cacheDir: "/tmp/rulesets-cache",
  env: new Map<string, string>(),
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
            capabilities: [],
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
            capabilities: [providerCapability("render:markdown")],
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
            capabilities: [providerCapability("render:handlebars")],
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
});
