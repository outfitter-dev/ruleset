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
  RULESETS_VERSION_TAG,
  type RulesetCapabilityId,
  type RulesetDiagnostic,
  type RulesetDiagnostics,
  type RulesetDocument,
  type RulesetProjectConfig,
  type RulesetRuntimeContext,
  type RulesetVersionTag,
} from "@ruleset/types";
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

export type ProviderSandboxMode = "in-process" | "bun-subprocess" | "custom";

export type ProviderSandboxDescriptor = {
  readonly mode: ProviderSandboxMode;
  readonly command?: string;
  readonly entry?: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
};

export type ProviderRuntimeDescriptor = {
  readonly bun?: string;
  readonly node?: string;
};

export const PROVIDER_SDK_VERSION: RulesetVersionTag = RULESETS_VERSION_TAG;

export type ProviderHandshake = {
  readonly providerId: string;
  readonly version: string;
  readonly sdkVersion: RulesetVersionTag;
  readonly capabilities: readonly ProviderCapability[];
  readonly sandbox?: ProviderSandboxDescriptor;
  readonly runtime?: ProviderRuntimeDescriptor;
};

export type ProviderCompileInput = {
  readonly document: RulesetDocument;
  readonly context: RulesetRuntimeContext;
  readonly target: CompileTarget;
  readonly projectConfig?: RulesetProjectConfig;
  readonly projectConfigPath?: string;
  readonly rendered?: CompileArtifact;
};

export type ProviderCompileResult = Result<
  CompileArtifact | readonly CompileArtifact[]
>;

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
    return createResultOk<CompileArtifact | readonly CompileArtifact[]>(
      artifact
    );
  },
});

const SEMVER_MAJOR_PATTERN = /^(\d+)\./;

const parseSemverMajor = (version: string): number | undefined => {
  const match = SEMVER_MAJOR_PATTERN.exec(version);
  if (!match) {
    return;
  }
  return Number.parseInt(match[1] ?? "", 10);
};

const createSdkDiagnostic = (
  providerId: string,
  message: string,
  details?: Record<string, JsonValue>
): RulesetDiagnostic => ({
  level: "error",
  message,
  hint:
    details !== undefined
      ? `Provider ${providerId} is incompatible with SDK ${PROVIDER_SDK_VERSION}. Details: ${JSON.stringify(details)}`
      : `Provider ${providerId} is incompatible with SDK ${PROVIDER_SDK_VERSION}.`,
  tags: ["provider", providerId, "sdk"],
});

export type ProviderCompatibilityOptions = {
  readonly sdkVersion?: RulesetVersionTag;
};

export const evaluateProviderCompatibility = (
  provider: ProviderEntry,
  options: ProviderCompatibilityOptions = {}
): RulesetDiagnostics => {
  const diagnostics: RulesetDiagnostic[] = [];
  const expectedSdkVersion = options.sdkVersion ?? PROVIDER_SDK_VERSION;
  const expectedMajor = parseSemverMajor(expectedSdkVersion);
  const actualSdkVersion = provider.handshake.sdkVersion;
  const actualMajor = parseSemverMajor(actualSdkVersion);

  if (expectedMajor === undefined) {
    diagnostics.push(
      createSdkDiagnostic(
        provider.handshake.providerId,
        `Invalid orchestrator SDK version: ${expectedSdkVersion}`,
        {
          orchestratorSdkVersion: expectedSdkVersion,
        }
      )
    );
    return diagnostics;
  }

  if (actualMajor === undefined) {
    diagnostics.push(
      createSdkDiagnostic(
        provider.handshake.providerId,
        `Provider reports an invalid SDK version: ${actualSdkVersion}`,
        {
          providerSdkVersion: actualSdkVersion,
        }
      )
    );
    return diagnostics;
  }

  if (actualMajor !== expectedMajor) {
    diagnostics.push(
      createSdkDiagnostic(
        provider.handshake.providerId,
        `Provider targets SDK major ${actualMajor}, expected ${expectedMajor}.`,
        {
          expectedSdkVersion,
          providerSdkVersion: actualSdkVersion,
        }
      )
    );
  }

  return diagnostics;
};

export const isProviderCompatible = (
  provider: ProviderEntry,
  options?: ProviderCompatibilityOptions
): boolean => evaluateProviderCompatibility(provider, options).length === 0;

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
export {
  type AgentsMdProvider,
  createAgentsMdProvider,
} from "./providers/agents-md";
export {
  type AmpProvider,
  createAmpProvider,
} from "./providers/amp";
export {
  type ClaudeCodeProvider,
  createClaudeCodeProvider,
} from "./providers/claude-code";
export {
  type ClineProvider,
  createClineProvider,
} from "./providers/cline";
export {
  type CodexProvider,
  createCodexProvider,
} from "./providers/codex";
export {
  type CodexAgentProvider,
  createCodexAgentProvider,
} from "./providers/codex-agent";
export {
  type CopilotProvider,
  createCopilotProvider,
} from "./providers/copilot";
export {
  type CursorProvider,
  createCursorProvider,
} from "./providers/cursor";
export {
  createGeminiProvider,
  type GeminiProvider,
} from "./providers/gemini";
export {
  createOpenCodeProvider,
  type OpenCodeProvider,
} from "./providers/opencode";
export {
  createRooCodeProvider,
  type RooCodeProvider,
} from "./providers/roo-code";
export {
  createWindsurfProvider,
  type WindsurfProvider,
} from "./providers/windsurf";
export {
  createZedProvider,
  type ZedProvider,
} from "./providers/zed";
export type { ProviderSettings } from "./utils";
export {
  buildHandlebarsOptions,
  isPlainObject,
  readProviderConfig,
  resolveProviderSettings,
} from "./utils";
