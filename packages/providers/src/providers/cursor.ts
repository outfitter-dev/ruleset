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
  buildDefaultOutputPath,
  hasCapability,
  mergeProviderConfig,
  PROVIDER_VERSION,
  resolveConfiguredOutputPath,
  selectRenderedArtifact,
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
      const { document, context, target, projectConfig, rendered } = input;

      const format = resolveFormat(rendered?.target ?? target);

      const fallbackPath = buildDefaultOutputPath({
        context,
        target,
        providerId: CURSOR_PROVIDER_ID,
        document,
        format,
        fallbackExtension: ".md",
      });

      const config = mergeProviderConfig(
        document,
        projectConfig,
        CURSOR_PROVIDER_ID
      );

      const desiredOutputPath = resolveConfiguredOutputPath({
        context,
        fallbackPath,
        configuredPath: config.outputPath,
        format,
        fallbackExtension: ".md",
      });

      const artifact = selectRenderedArtifact({
        rendered,
        document,
        target: {
          ...target,
          outputPath: desiredOutputPath,
        },
      });

      return createResultOk({
        ...artifact,
        target: {
          ...artifact.target,
          outputPath: desiredOutputPath,
        },
      });
    },
  });

export type CursorProvider = ReturnType<typeof createCursorProvider>;
