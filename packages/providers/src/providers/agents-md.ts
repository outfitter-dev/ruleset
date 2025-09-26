import { promises as fs } from "node:fs";

import {
  createResultOk,
  type JsonValue,
  RULESET_CAPABILITIES,
} from "@rulesets/types";

import {
  defineProvider,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderCompileResult,
} from "../index";
import {
  createDiagnostic,
  PROVIDER_VERSION,
  resolveFilesystemArtifact,
} from "../shared";

const PROVIDER_ID = "agents-md";

const AGENTS_CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

type AgentsMdConfig = {
  outputPath?: JsonValue;
  useComposer?: JsonValue;
  detectSymlinks?: JsonValue;
};

const resolveBoolean = (value: JsonValue | undefined): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return;
};

const resolveComposerFlag = (config: AgentsMdConfig): boolean =>
  resolveBoolean(config.useComposer) === true;

const resolveSymlinkFlag = (config: AgentsMdConfig): boolean => {
  const resolved = resolveBoolean(config.detectSymlinks);
  return resolved !== false;
};

const resolveOutputPath = (config: AgentsMdConfig): JsonValue | undefined =>
  config.outputPath;

const normalizePath = async (outputPath: string, detectSymlinks: boolean) => {
  if (!detectSymlinks) {
    return outputPath;
  }

  try {
    const stats = await fs.lstat(outputPath);
    if (stats.isSymbolicLink()) {
      return await fs.realpath(outputPath);
    }
  } catch {
    return outputPath;
  }

  return outputPath;
};

export const createAgentsMdProvider = () =>
  defineProvider({
    handshake: {
      providerId: PROVIDER_ID,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities: AGENTS_CAPABILITIES,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: async (
      input: ProviderCompileInput
    ): Promise<ProviderCompileResult> => {
      const artifactContext = resolveFilesystemArtifact({
        providerId: PROVIDER_ID,
        input,
        fallbackExtension: ".md",
        configuredPathResolver: resolveOutputPath,
      });

      const config = artifactContext.config as AgentsMdConfig;
      const detectSymlinks = resolveSymlinkFlag(config);

      const normalizedOutput = await normalizePath(
        artifactContext.outputPath,
        detectSymlinks
      );

      const diagnostics = [...artifactContext.artifact.diagnostics];

      if (resolveComposerFlag(config)) {
        diagnostics.push(
          createDiagnostic({
            level: "warning",
            message:
              "agents-md.useComposer is not yet supported in the new provider stack; emitting single-source content instead.",
            hint: "Re-run without useComposer or wait for the composer port to land.",
            tags: ["provider", "agents-md", "useComposer"],
          })
        );
      }

      return createResultOk({
        ...artifactContext.artifact,
        target: {
          ...artifactContext.artifact.target,
          outputPath: normalizedOutput,
        },
        diagnostics,
      });
    },
  });

export type AgentsMdProvider = ReturnType<typeof createAgentsMdProvider>;
