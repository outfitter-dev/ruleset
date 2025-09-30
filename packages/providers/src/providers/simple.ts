import {
  type CapabilityDescriptor,
  createResultOk,
  type JsonValue,
  RULESET_CAPABILITIES,
} from "@rulesets/types";

import {
  defineProvider,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderCompileResult,
  type ProviderEntry,
} from "../index";
import {
  type CanonicalBasePath,
  createCanonicalArtifact,
  PROVIDER_VERSION,
  type RendererFormat,
  resolveFilesystemArtifact,
} from "../shared";

export type SimpleProviderOptions = {
  readonly providerId: string;
  readonly capabilities?: readonly CapabilityDescriptor[];
  readonly fallbackExtension?: string;
  readonly formatResolver?: (params: {
    readonly target: ProviderCompileInput["target"];
    readonly rendered?: ProviderCompileInput["rendered"];
    readonly config: Record<string, JsonValue>;
  }) => RendererFormat;
  readonly configuredPathResolver?: (
    config: Record<string, JsonValue>
  ) => JsonValue | undefined;
  readonly canonicalOutput?: {
    readonly enabled?: (params: {
      readonly config: Record<string, JsonValue>;
      readonly format: RendererFormat;
    }) => boolean;
    readonly fileName?: string;
    readonly basePath?: CanonicalBasePath;
    readonly configuredPathResolver?: (
      config: Record<string, JsonValue>
    ) => JsonValue | undefined;
    readonly format?: RendererFormat;
    readonly fallbackExtension?: string;
  };
};

const DEFAULT_CAPABILITIES: readonly CapabilityDescriptor[] = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

export const createSimpleFilesystemProvider = (
  options: SimpleProviderOptions
): ProviderEntry => {
  const {
    providerId,
    capabilities = DEFAULT_CAPABILITIES,
    fallbackExtension = ".md",
    formatResolver,
    configuredPathResolver,
    canonicalOutput,
  } = options;

  return defineProvider({
    handshake: {
      providerId,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: (input: ProviderCompileInput): ProviderCompileResult => {
      const { artifact, config, format } = resolveFilesystemArtifact({
        providerId,
        input,
        fallbackExtension,
        formatResolver: formatResolver
          ? ({ target, rendered, config: resolverConfig }) =>
              formatResolver({
                target,
                rendered,
                config: resolverConfig as Record<string, JsonValue>,
              })
          : undefined,
        configuredPathResolver: configuredPathResolver
          ? (resolverConfig) =>
              configuredPathResolver(
                resolverConfig as Record<string, JsonValue>
              )
          : undefined,
      });

      const artifacts = [artifact];

      if (canonicalOutput) {
        const canonicalEnabled = canonicalOutput.enabled
          ? canonicalOutput.enabled({
              config,
              format,
            })
          : true;

        if (canonicalEnabled) {
          const canonicalConfiguredPath = canonicalOutput.configuredPathResolver
            ? canonicalOutput.configuredPathResolver(config)
            : (config.agentsOutputPath as JsonValue | undefined);

          const canonicalArtifact = createCanonicalArtifact({
            artifact,
            context: input.context,
            target: input.target,
            config,
            format: canonicalOutput.format ?? "markdown",
            fileName: canonicalOutput.fileName,
            basePath: canonicalOutput.basePath,
            configuredPath: canonicalConfiguredPath,
            fallbackExtension: canonicalOutput.fallbackExtension ?? ".md",
          });

          if (canonicalArtifact) {
            artifacts.push(canonicalArtifact);
          }
        }
      }

      return createResultOk(artifacts.length === 1 ? artifacts[0] : artifacts);
    },
  });
};
