import { describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import path from "node:path";

import { compile, createCompiler } from "@rulesets/lib";
import { createNoopProvider, providerCapability } from "@rulesets/providers";
import { RULESETS_VERSION_TAG } from "@rulesets/types";

type MinimalContext = Parameters<typeof compile>[0]["context"];

type MinimalTarget = Parameters<typeof compile>[0]["targets"][number];

const createRuntimeContext = (): MinimalContext => ({
  version: RULESETS_VERSION_TAG,
  cwd: process.cwd(),
  cacheDir: path.join(tmpdir(), "rulesets-lib-cache"),
  env: new Map<string, string>(),
});

const createTarget = (outputPath: string): MinimalTarget => ({
  providerId: "noop",
  outputPath,
});

const createProvider = () =>
  createNoopProvider({
    providerId: "noop",
    version: "0.0.0-test",
    capabilities: [providerCapability("render:markdown")],
  });

describe("@rulesets/lib compile helpers", () => {
  const source = {
    id: "sample.rule.md",
    contents: "# Hello",
    format: "rule" as const,
  };

  it("delegates compile() to the orchestrator layer", async () => {
    const providers = [createProvider()];
    const output = await compile(
      {
        context: createRuntimeContext(),
        sources: [source],
        targets: [createTarget("/virtual/output/noop.md")],
      },
      { providers }
    );

    expect(output.artifacts).toHaveLength(1);
    expect(output.artifacts[0]?.contents).toBe("# Hello");
  });

  it("creates a compiler with preconfigured defaults", async () => {
    const compiler = createCompiler({ providers: [createProvider()] });
    const output = await compiler.compile({
      context: createRuntimeContext(),
      sources: [source],
      targets: [createTarget("/virtual/output/noop.md")],
    });

    expect(output.artifacts).toHaveLength(1);
    expect(output.artifacts[0]?.target.providerId).toBe("noop");
  });
});
