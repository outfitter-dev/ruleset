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

  const agentsOutput = config.agentsOutputPath;
  if (typeof agentsOutput === "string" && agentsOutput.trim().length > 0) {
    return agentsOutput;
  }

  return;
};

const shouldEmitSharedWarning = (
  config: Record<string, JsonValue>
): boolean => {
  const enableSharedAgents = config.enableSharedAgents;
  if (enableSharedAgents === false) {
    return false;
  }
  return typeof config.agentsOutputPath === "string";
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
      const { artifact, config } = resolveFilesystemArtifact({
        providerId: PROVIDER_ID,
        input,
        fallbackExtension: ".md",
        configuredPathResolver: resolveConfiguredPath,
      });

      if (shouldEmitSharedWarning(config)) {
        const diagnostic = createDiagnostic({
          level: "info",
          message:
            "codex.enableSharedAgents is not yet supported in the new provider pipeline; only the primary artifact will be written.",
          hint: "Configure codex.outputPath to control the main output location. The agentsOutputPath setting is currently ignored.",
          tags: ["provider", "codex", "shared-agents"],
        });

        return createResultOk({
          ...artifact,
          diagnostics: [...artifact.diagnostics, diagnostic],
        });
      }

      return createResultOk(artifact);
    },
  });

export type CodexProvider = ReturnType<typeof createCodexProvider>;
