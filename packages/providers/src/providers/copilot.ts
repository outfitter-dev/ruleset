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

const PROVIDER_ID = "copilot";

const COPILOT_CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const resolveFormat = (target: CompileTarget): "markdown" | "xml" =>
  hasCapability(target, "output:sections") ? "xml" : "markdown";

export const createCopilotProvider = () =>
  defineProvider({
    handshake: {
      providerId: PROVIDER_ID,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities: COPILOT_CAPABILITIES,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: (input: ProviderCompileInput): ProviderCompileResult => {
      const { artifact } = resolveFilesystemArtifact({
        providerId: PROVIDER_ID,
        input,
        fallbackExtension: ".md",
        formatResolver: ({ target: resolvedTarget }) =>
          resolveFormat(resolvedTarget),
      });

      return createResultOk(artifact);
    },
  });

export type CopilotProvider = ReturnType<typeof createCopilotProvider>;
