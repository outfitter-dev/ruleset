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

const CURSOR_CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const CURSOR_PROVIDER_ID = "cursor";

const resolveFormat = (target: CompileTarget): "markdown" | "xml" =>
  hasCapability(target, "output:sections") ? "xml" : "markdown";

export const createCursorProvider = () =>
  defineProvider({
    handshake: {
      providerId: CURSOR_PROVIDER_ID,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities: CURSOR_CAPABILITIES,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: (input: ProviderCompileInput): ProviderCompileResult => {
      const { artifact } = resolveFilesystemArtifact({
        providerId: CURSOR_PROVIDER_ID,
        input,
        fallbackExtension: ".md",
        formatResolver: ({ target: resolvedTarget }) =>
          resolveFormat(resolvedTarget),
      });

      return createResultOk(artifact);
    },
  });

export type CursorProvider = ReturnType<typeof createCursorProvider>;
