import {
  type CapabilityDescriptor,
  type CapabilityDescriptorInput,
  type CompileArtifact,
  type CompileTarget,
  createResultErr,
  createResultOk,
  createRulesetError,
  defineCapability,
  getRulesetCapability,
  type JsonValue,
  type Result,
  type RulesetCapabilityId,
  type RulesetDiagnostics,
  type RulesetDocument,
  type RulesetProjectConfig,
  type RulesetRuntimeContext,
} from "@rulesets/types";
import type { HelperDelegate } from "handlebars";

export type ProviderCapabilityId = RulesetCapabilityId;

export type ProviderCapabilityInput =
  | ProviderCapabilityId
  | CapabilityDescriptor
  | (CapabilityDescriptorInput & { readonly optional?: boolean });

export type ProviderCapabilityOptions = {
  readonly optional?: boolean;
};

const asCapabilityDescriptor = (
  capability: ProviderCapabilityInput
): CapabilityDescriptor => {
  if (typeof capability === "string") {
    const known = getRulesetCapability(capability);
    if (known) {
      return known;
    }

    return defineCapability({
      id: capability,
      description: `Custom capability (${capability})`,
      experimental: true,
    });
  }

  if ("introducedIn" in capability) {
    return capability as CapabilityDescriptor;
  }

  const { optional: _optional, ...descriptor } = capability;
  return defineCapability(descriptor);
};

export type ProviderCapability = CapabilityDescriptor & {
  readonly optional?: boolean;
};

export type ProviderHandshake = {
  readonly providerId: string;
  readonly version: string;
  readonly capabilities: readonly ProviderCapability[];
};

export type ProviderCompileInput = {
  readonly document: RulesetDocument;
  readonly context: RulesetRuntimeContext;
  readonly target: CompileTarget;
  readonly projectConfig?: RulesetProjectConfig;
  readonly projectConfigPath?: string;
  readonly rendered?: CompileArtifact;
};

export type ProviderCompileResult = Result<CompileArtifact>;

export type ProviderEntry = {
  readonly handshake: ProviderHandshake;
  readonly compile: (
    input: ProviderCompileInput
  ) => Promise<ProviderCompileResult> | ProviderCompileResult;
};

export type DestinationHandlebarsOptions = {
  readonly force?: boolean;
  readonly helpers?: Record<string, HelperDelegate>;
  readonly partials?: Record<string, string>;
  readonly strict?: boolean;
  readonly noEscape?: boolean;
};

export type DestinationCompilationOptions = {
  readonly handlebars?: DestinationHandlebarsOptions;
  readonly projectConfigOverrides?: Record<string, JsonValue>;
};

export type ProviderLogger = {
  warn(message: string, metadata?: Record<string, unknown>): void;
  info?(message: string, metadata?: Record<string, unknown>): void;
  debug?(message: string, metadata?: Record<string, unknown>): void;
};

export const defineProvider = (entry: ProviderEntry): ProviderEntry => entry;

export const createNoopProvider = (
  handshake: ProviderHandshake
): ProviderEntry => ({
  handshake,
  compile: ({ document, target, rendered }) => {
    const artifact: CompileArtifact = {
      target: {
        ...target,
        capabilities: rendered?.target.capabilities ?? target.capabilities,
      },
      contents: rendered?.contents ?? document.source.contents,
      diagnostics: rendered?.diagnostics ?? [],
    };
    return createResultOk(artifact);
  },
});

export const providerCapability = (
  capability: ProviderCapabilityInput,
  options?: ProviderCapabilityOptions
): ProviderCapability => {
  const descriptor = asCapabilityDescriptor(capability);
  const optionalFromInput =
    typeof capability === "object" && "optional" in capability
      ? capability.optional
      : undefined;
  const optional = options?.optional ?? optionalFromInput ?? false;

  if (optional) {
    return Object.freeze({
      ...descriptor,
      optional: true,
    }) as ProviderCapability;
  }

  return Object.freeze({ ...descriptor }) as ProviderCapability;
};

export const unsupportedCapability = (
  capability: ProviderCapabilityInput,
  diagnostics?: RulesetDiagnostics
): ProviderCompileResult => {
  if (diagnostics && diagnostics.length > 0) {
    return createResultErr(diagnostics);
  }

  const descriptor = asCapabilityDescriptor(capability);

  return createResultErr(
    createRulesetError({
      code: "PROVIDER_CAPABILITY_UNSUPPORTED",
      message: `Capability ${descriptor.id} is not supported by this provider.`,
      details: {
        capability: descriptor.id,
      },
    })
  );
};

// biome-ignore lint/performance/noBarrelFile: re-exporting shared helpers keeps the public surface stable during the migration
export { createDefaultProviders } from "./first-party";
export type { ProviderSettings } from "./utils";
export {
  buildHandlebarsOptions,
  isPlainObject,
  readProviderConfig,
  resolveProviderSettings,
} from "./utils";
