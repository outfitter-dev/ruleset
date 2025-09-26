import { describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import path from "node:path";

import { compile, compileStream, createCompiler } from "@rulesets/lib";
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
    expect(output.sourceSummaries?.[0]?.dependencies).toEqual([]);
  });

  it("supports streaming events via compileStream()", async () => {
    const providers = [createProvider()];
    const emitted: string[] = [];
    const stream = compileStream(
      {
        context: createRuntimeContext(),
        sources: [source],
        targets: [createTarget("/virtual/output/noop.md")],
      },
      {
        providers,
        onEvent: (event) => {
          emitted.push(event.kind);
        },
      }
    );

    const kinds: string[] = [];
    for await (const event of stream) {
      kinds.push(event.kind);
    }

    expect(kinds).toHaveLength(emitted.length);
    expect(kinds[0]).toBe("pipeline:start");
    expect(kinds.at(-1)).toBe("pipeline:end");
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

  it("exposes a stream helper honoring default and override handlers", async () => {
    const defaultEvents: string[] = [];
    const overrideEvents: string[] = [];

    const compiler = createCompiler({
      providers: [createProvider()],
      onEvent: (event) => {
        defaultEvents.push(event.kind);
      },
    });

    const stream = compiler.stream(
      {
        context: createRuntimeContext(),
        sources: [source],
        targets: [createTarget("/virtual/output/noop.md")],
      },
      {
        onEvent: (event) => {
          overrideEvents.push(event.kind);
        },
      }
    );

    const kinds: string[] = [];
    for await (const event of stream) {
      kinds.push(event.kind);
    }

    expect(kinds).toHaveLength(defaultEvents.length);
    expect(kinds).toHaveLength(overrideEvents.length);
    expect(kinds[0]).toBe("pipeline:start");
    expect(kinds.at(-1)).toBe("pipeline:end");
  });
});
