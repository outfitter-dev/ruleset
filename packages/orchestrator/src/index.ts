import {
  createNoopParser,
  type ParserOptions,
  type ParserOutput,
  type RulesetParserFn,
} from "@rulesets/parser";
import {
  createNoopProvider,
  type ProviderCompileInput,
  type ProviderEntry,
  type ProviderHandshake,
} from "@rulesets/providers";
import {
  createPassthroughRenderer,
  type RendererOptions,
  type RulesetRenderer,
} from "@rulesets/renderer";
import {
  identityTransform,
  type RulesetTransform,
  runTransforms,
} from "@rulesets/transform";
import type {
  CompilationInput,
  CompilationOutput,
  CompileArtifact,
  CompileTarget,
  JsonValue,
  RulesetCapabilityId,
  RulesetDiagnostics,
  RulesetDocument,
  RulesetProjectConfig,
  RulesetProviderConfig,
  RulesetProviderHandlebarsConfig,
  RulesetRuleFrontmatter,
} from "@rulesets/types";
import {
  createRulesetError,
  resolveRulesetCapabilities,
} from "@rulesets/types";
import {
  createNoopValidator,
  type RulesetValidator,
  type ValidationOptions,
} from "@rulesets/validator";

export type OrchestratorOptions = {
  readonly parser?: RulesetParserFn;
  readonly parserOptions?: ParserOptions;
  readonly validator?: RulesetValidator;
  readonly validationOptions?: ValidationOptions;
  readonly transforms?: readonly RulesetTransform[];
  readonly renderer?: RulesetRenderer;
  readonly rendererOptions?: RendererOptions;
  readonly providers?: readonly ProviderEntry[];
};

export type Orchestrator = (
  input: CompilationInput,
  options?: OrchestratorOptions
) => Promise<CompilationOutput>;

const buildProviderRegistry = (
  providers: readonly ProviderEntry[]
): Map<string, ProviderEntry> =>
  new Map(
    providers.map((provider) => [provider.handshake.providerId, provider])
  );

const ensureProvider = (
  registry: Map<string, ProviderEntry>,
  targetProviderId: string
): ProviderEntry => {
  const existing = registry.get(targetProviderId);
  if (existing) {
    return existing;
  }

  const noopHandshake: ProviderHandshake = {
    providerId: targetProviderId,
    version: "0.0.0-placeholder",
    capabilities: [],
  };

  const fallback = createNoopProvider(noopHandshake);
  registry.set(targetProviderId, fallback);
  return fallback;
};

const collectDiagnostics = (
  accumulator: RulesetDiagnostics,
  next: RulesetDiagnostics
): RulesetDiagnostics => [...accumulator, ...next];

const normalizeCapabilityIds = (
  capabilities?: readonly string[]
): readonly string[] => {
  if (!capabilities || capabilities.length === 0) {
    return [];
  }

  const normalized = new Set<string>();
  for (const capability of capabilities) {
    if (typeof capability === "string" && capability.trim().length > 0) {
      normalized.add(capability);
    }
  }

  return [...normalized];
};

type ProviderCapabilityCache = WeakMap<ProviderEntry, Set<string>>;

const getProviderCapabilityIds = (
  provider: ProviderEntry,
  cache: ProviderCapabilityCache
): Set<string> => {
  const cached = cache.get(provider);
  if (cached) {
    return cached;
  }

  const capabilityIds = new Set<string>(
    provider.handshake.capabilities?.map((capability) => capability.id) ?? []
  );

  cache.set(provider, capabilityIds);
  return capabilityIds;
};

const collectMissingCapabilities = (
  provider: ProviderEntry,
  required: readonly string[],
  cache: ProviderCapabilityCache
): readonly string[] => {
  if (required.length === 0) {
    return [];
  }

  const providerCapabilities = getProviderCapabilityIds(provider, cache);
  return required.filter(
    (capabilityId) => !providerCapabilities.has(capabilityId)
  );
};

const isJsonObject = (
  value: JsonValue | undefined
): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyArray = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value) && value.length > 0;

const isNonEmptyRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0;

type HandlebarsDirective = {
  readonly enabled: boolean;
  readonly helpers?: unknown;
  readonly partials?: unknown;
};

const normalizeHandlebarsDirective = (
  value: JsonValue | undefined
): HandlebarsDirective | undefined => {
  if (value === undefined) {
    return;
  }

  if (typeof value === "boolean") {
    return { enabled: value };
  }

  if (isJsonObject(value)) {
    return {
      enabled: true,
      helpers: value.helpers,
      partials: value.partials,
    };
  }

  return;
};

const normalizeConfigHandlebarsDirective = (
  value:
    | boolean
    | RulesetProviderHandlebarsConfig
    | RulesetRuleFrontmatter["handlebars"]
    | RulesetProviderConfig["handlebars"]
    | undefined
): HandlebarsDirective | undefined => {
  if (value === undefined) {
    return;
  }

  if (typeof value === "boolean") {
    return { enabled: value };
  }

  return {
    enabled: true,
    helpers: value.helpers,
    partials: value.partials,
  };
};

type HandlebarsRequirements = {
  requiresHandlebars: boolean;
  requiresHelpers: boolean;
  requiresPartials: boolean;
};

const evaluateHandlebarsRequirements = (
  document: RulesetDocument,
  projectConfig: RulesetProjectConfig | undefined,
  providerId: string
): HandlebarsRequirements => {
  let requiresHandlebars = document.source.template === true;
  let requiresHelpers = false;
  let requiresPartials = false;

  const considerDirective = (directive: HandlebarsDirective | undefined) => {
    if (!directive || directive.enabled === false) {
      return;
    }

    requiresHandlebars = true;

    if (isNonEmptyArray(directive.helpers)) {
      requiresHelpers = true;
    }

    if (isNonEmptyRecord(directive.partials)) {
      requiresPartials = true;
    }
  };

  const frontMatter = document.metadata.frontMatter;
  const ruleFrontmatter = isJsonObject(frontMatter?.rule)
    ? (frontMatter?.rule as Record<string, JsonValue>)
    : undefined;

  if (ruleFrontmatter?.template === true) {
    requiresHandlebars = true;
  }

  considerDirective(normalizeHandlebarsDirective(ruleFrontmatter?.handlebars));

  const projectRuleDirective = normalizeConfigHandlebarsDirective(
    projectConfig?.rule?.handlebars
  );
  const providerRuleDirective = normalizeConfigHandlebarsDirective(
    projectConfig?.providers?.[providerId]?.handlebars
  );

  if (projectConfig?.rule?.template === true) {
    requiresHandlebars = true;
  }

  considerDirective(projectRuleDirective);
  considerDirective(providerRuleDirective);

  const providerFrontmatter = frontMatter?.[providerId];
  if (isJsonObject(providerFrontmatter)) {
    considerDirective(
      normalizeHandlebarsDirective(
        providerFrontmatter.handlebars as JsonValue | undefined
      )
    );
  }

  return {
    requiresHandlebars,
    requiresHelpers,
    requiresPartials,
  };
};

const deriveRequiredCapabilities = (
  document: RulesetDocument,
  target: CompileTarget,
  projectConfig: RulesetProjectConfig | undefined
): readonly string[] => {
  const explicit = normalizeCapabilityIds(target.capabilities);
  const capabilities = new Set<string>(explicit);

  const { requiresHandlebars, requiresHelpers, requiresPartials } =
    evaluateHandlebarsRequirements(document, projectConfig, target.providerId);

  const hasRenderCapability = [...capabilities].some((capabilityId) =>
    capabilityId.startsWith("render:")
  );

  if (requiresHandlebars) {
    capabilities.add("render:handlebars");
  }

  if (!(hasRenderCapability || requiresHandlebars)) {
    capabilities.add("render:markdown");
  }

  if (requiresHelpers) {
    capabilities.add("render:handlebars:helpers");
  }

  if (requiresPartials) {
    capabilities.add("render:handlebars:partials");
  }

  return [...capabilities];
};

const applyDocumentOverrides = (
  document: RulesetDocument,
  projectConfig?: RulesetProjectConfig
): RulesetDocument => {
  const shouldForceTemplate =
    document.source?.template === true ||
    projectConfig?.rule?.template === true;

  if (!shouldForceTemplate) {
    return document;
  }

  const currentFrontMatter = document.metadata.frontMatter ?? {};
  const currentRuleValue = currentFrontMatter.rule as JsonValue | undefined;
  const nextRule = isJsonObject(currentRuleValue)
    ? { ...currentRuleValue }
    : {};

  if (nextRule.template === true) {
    return document;
  }

  const nextFrontMatter: Record<string, JsonValue> = {
    ...currentFrontMatter,
    rule: {
      ...nextRule,
      template: true,
    },
  };

  return {
    ...document,
    metadata: {
      ...document.metadata,
      frontMatter: nextFrontMatter,
    },
  };
};

export const createOrchestrator =
  (defaults: OrchestratorOptions = {}): Orchestrator =>
  async (input, overrides) => {
    const parser = overrides?.parser ?? defaults.parser ?? createNoopParser();
    const parserOptions = {
      ...defaults.parserOptions,
      ...overrides?.parserOptions,
    };
    const validator =
      overrides?.validator ?? defaults.validator ?? createNoopValidator();
    const validationOptions = {
      ...defaults.validationOptions,
      ...overrides?.validationOptions,
    };
    const transforms = overrides?.transforms ??
      defaults.transforms ?? [identityTransform];
    const _renderer =
      overrides?.renderer ?? defaults.renderer ?? createPassthroughRenderer();
    const _rendererOptions = {
      ...defaults.rendererOptions,
      ...overrides?.rendererOptions,
    };
    const providerEntries = overrides?.providers ?? defaults.providers ?? [];
    const registry = buildProviderRegistry(providerEntries);
    const providerCapabilityCache: ProviderCapabilityCache = new WeakMap();

    const artifacts: CompileArtifact[] = [];
    let diagnostics: RulesetDiagnostics = [];

    for (const source of input.sources) {
      const parsed: ParserOutput = parser(source, parserOptions);
      diagnostics = collectDiagnostics(diagnostics, parsed.diagnostics);

      const validated = validator(parsed.document, validationOptions);
      diagnostics = collectDiagnostics(diagnostics, validated.diagnostics);

      const transformed = runTransforms(validated.document, ...transforms);
      diagnostics = collectDiagnostics(diagnostics, transformed.diagnostics);

      const documentWithOverrides = applyDocumentOverrides(
        transformed.document,
        input.projectConfig
      );

      for (const target of input.targets) {
        const provider = ensureProvider(registry, target.providerId);
        const requiredCapabilities = deriveRequiredCapabilities(
          documentWithOverrides,
          target,
          input.projectConfig
        );
        const missingCapabilities = collectMissingCapabilities(
          provider,
          requiredCapabilities,
          providerCapabilityCache
        );

        if (missingCapabilities.length > 0) {
          const knownCapabilities =
            resolveRulesetCapabilities(missingCapabilities);
          const knownCapabilityIds = new Set<RulesetCapabilityId>(
            knownCapabilities.map((capability) => capability.id)
          );
          const unknownCapabilities = missingCapabilities.filter(
            (capabilityId) =>
              !knownCapabilityIds.has(capabilityId as RulesetCapabilityId)
          );

          const error = createRulesetError({
            code: "PROVIDER_CAPABILITY_UNSUPPORTED",
            message: `Provider "${target.providerId}" is missing required capabilities.`,
            details: {
              providerId: target.providerId,
              missing: missingCapabilities,
            },
            help: "Declare the capability in the provider handshake or adjust the compile target.",
          });

          const capabilitySummary = [
            ...knownCapabilities.map(
              (capability) => `${capability.id} (${capability.description})`
            ),
            ...unknownCapabilities,
          ];

          const diagnosticMessage = `${error.message} Missing: ${missingCapabilities.join(", ")}.`;

          diagnostics = collectDiagnostics(diagnostics, [
            {
              level: "error",
              message: diagnosticMessage,
              hint:
                capabilitySummary.length > 0
                  ? `Details: ${capabilitySummary.join("; ")}`
                  : error.help,
              tags: ["provider", target.providerId, "capability"],
            },
          ]);

          continue;
        }

        const targetWithCapabilities: CompileTarget = {
          ...target,
          capabilities: requiredCapabilities,
        };

        const compileInput: ProviderCompileInput = {
          document: documentWithOverrides,
          context: input.context,
          target: targetWithCapabilities,
          projectConfig: input.projectConfig,
          projectConfigPath: input.projectConfigPath,
        };

        const result = await provider.compile(compileInput);

        if (result.ok) {
          const artifactCapabilities = normalizeCapabilityIds(
            result.value.target.capabilities ?? requiredCapabilities
          );

          const artifact: CompileArtifact = {
            ...result.value,
            target: {
              ...result.value.target,
              capabilities: artifactCapabilities,
            },
          };

          artifacts.push(artifact);
          diagnostics = collectDiagnostics(diagnostics, artifact.diagnostics);
        } else if (Array.isArray(result.error)) {
          diagnostics = collectDiagnostics(diagnostics, result.error);
        }
      }
    }

    return {
      artifacts,
      diagnostics,
    };
  };

export const compileRulesets: Orchestrator = (input, options) =>
  createOrchestrator(options)(input, options);

export const dryRun: Orchestrator = async (_input, _options) => ({
  artifacts: [],
  diagnostics: [
    {
      level: "info",
      message: "Dry run – compilation not executed",
    },
  ],
});
