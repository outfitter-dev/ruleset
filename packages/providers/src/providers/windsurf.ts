import {
  type CompileTarget,
  createResultOk,
  RULESET_CAPABILITIES,
} from "@rulesets/types";
import {
  defineProvider,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderCompileResult,
} from "../index";
import {
  hasCapability,
  PROVIDER_VERSION,
  resolveFilesystemArtifact,
} from "../shared";

const PROVIDER_ID = "windsurf";

const WINDSURF_CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_SECTIONS,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const normalizeFormat = (value: unknown): "markdown" | "xml" | undefined => {
  if (typeof value !== "string") {
    return;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "xml") {
    return "xml";
  }
  if (normalized === "markdown") {
    return "markdown";
  }
  return;
};

const resolveFormat = (
  target: CompileTarget,
  config: Record<string, unknown>
) => {
  const configuredFormat = normalizeFormat(config.format);
  if (configuredFormat) {
    return configuredFormat;
  }
  return hasCapability(target, "output:sections") ? "xml" : "markdown";
};

export const createWindsurfProvider = () =>
  defineProvider({
    handshake: {
      providerId: PROVIDER_ID,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities: WINDSURF_CAPABILITIES,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: (input: ProviderCompileInput): ProviderCompileResult => {
      const { artifact } = resolveFilesystemArtifact({
        providerId: PROVIDER_ID,
        input,
        fallbackExtension: ".md",
        formatResolver: ({ target: resolvedTarget, config }) =>
          resolveFormat(resolvedTarget, config),
      });

      return createResultOk(artifact);
    },
  });

export type WindsurfProvider = ReturnType<typeof createWindsurfProvider>;
