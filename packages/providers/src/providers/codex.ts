import path from "node:path";

import {
  createResultOk,
  type JsonValue,
  RULESET_CAPABILITIES,
  type RulesetRuntimeContext,
} from "@ruleset/types";
import {
  defineProvider,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderCompileResult,
} from "../index";
import {
  PROVIDER_VERSION,
  resolveConfiguredOutputPath,
  resolveFilesystemArtifact,
} from "../shared";

const PROVIDER_ID = "codex";

const CODEX_CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const resolveConfiguredPath = (config: Record<string, JsonValue>) => {
  const outputPath = config.outputPath;
  if (typeof outputPath === "string" && outputPath.trim().length > 0) {
    return outputPath;
  }

  return;
};

const isTruthy = (value: JsonValue | undefined): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return;
};

const sharedAgentsEnabled = (config: Record<string, JsonValue>): boolean => {
  const resolved = isTruthy(config.enableSharedAgents);
  // Default to true unless explicitly disabled.
  return resolved !== false;
};

const resolveSharedOutputPath = (params: {
  context: RulesetRuntimeContext;
  targetOutputBase: string;
  providerId: string;
  config: Record<string, JsonValue>;
  format: "markdown" | "xml";
}): string => {
  const { context, targetOutputBase, providerId, config, format } = params;

  const providerBase = path.normalize(path.join(targetOutputBase, providerId));

  const fallbackPath = path.join(providerBase, "AGENTS.md");

  const configuredPath =
    typeof config.agentsOutputPath === "string"
      ? config.agentsOutputPath
      : undefined;

  return resolveConfiguredOutputPath({
    context,
    fallbackPath,
    configuredPath,
    format,
    fallbackExtension: ".md",
  });
};

export const createCodexProvider = () =>
  defineProvider({
    handshake: {
      providerId: PROVIDER_ID,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities: CODEX_CAPABILITIES,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: (input: ProviderCompileInput): ProviderCompileResult => {
      const { artifact, config, format } = resolveFilesystemArtifact({
        providerId: PROVIDER_ID,
        input,
        fallbackExtension: ".md",
        configuredPathResolver: resolveConfiguredPath,
      });

      const artifacts = [artifact];

      if (sharedAgentsEnabled(config)) {
        const sharedOutputPath = resolveSharedOutputPath({
          context: input.context,
          targetOutputBase: input.target.outputPath,
          providerId: PROVIDER_ID,
          config,
          format,
        });

        if (
          path.normalize(sharedOutputPath) !==
          path.normalize(artifact.target.outputPath)
        ) {
          artifacts.push({
            target: {
              ...artifact.target,
              outputPath: sharedOutputPath,
            },
            contents: artifact.contents,
            diagnostics: artifact.diagnostics,
          });
        }
      }

      return artifacts.length === 1
        ? createResultOk(artifacts[0] ?? artifact)
        : createResultOk(artifacts);
    },
  });

export type CodexProvider = ReturnType<typeof createCodexProvider>;
