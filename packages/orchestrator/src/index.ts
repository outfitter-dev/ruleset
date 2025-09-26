import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  createNoopParser,
  type ParserOptions,
  type ParserOutput,
  type RulesetParserFn,
} from "@rulesets/parser";
import {
  createNoopProvider,
  evaluateProviderCompatibility,
  PROVIDER_SDK_VERSION,
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
import {
  type CompilationInput,
  type CompilationOutput,
  type CompilationSourceSummary,
  type CompileArtifact,
  type CompileTarget,
  createRulesetError,
  isRulesetError,
  type JsonValue,
  type RulesetCapabilityId,
  type RulesetDependency,
  type RulesetDiagnostic,
  type RulesetDiagnostics,
  type RulesetDocument,
  type RulesetProjectConfig,
  type RulesetProviderConfig,
  type RulesetProviderHandlebarsConfig,
  type RulesetRuleFrontmatter,
  type RulesetRuntimeContext,
  type RulesetSource,
  resolveRulesetCapabilities,
} from "@rulesets/types";
import {
  createNoopValidator,
  type RulesetValidator,
  type ValidationOptions,
} from "@rulesets/validator";
import { executeProviderCompile } from "./provider-executor";

export type PipelineStartEvent = {
  readonly kind: "pipeline:start";
  readonly timestamp: number;
  readonly input: CompilationInput;
};

export type SourceStartEvent = {
  readonly kind: "source:start";
  readonly source: RulesetSource;
};

export type ParseResultEvent = {
  readonly kind: "source:parsed";
  readonly source: RulesetSource;
  readonly document: RulesetDocument;
  readonly diagnostics: RulesetDiagnostics;
};

export type ValidateResultEvent = {
  readonly kind: "source:validated";
  readonly source: RulesetSource;
  readonly document: RulesetDocument;
  readonly diagnostics: RulesetDiagnostics;
};

export type TransformResultEvent = {
  readonly kind: "source:transformed";
  readonly source: RulesetSource;
  readonly document: RulesetDocument;
  readonly diagnostics: RulesetDiagnostics;
};

export type TargetStartEvent = {
  readonly kind: "target:start";
  readonly source: RulesetSource;
  readonly target: CompileTarget;
};

export type TargetCapabilitiesEvent = {
  readonly kind: "target:capabilities";
  readonly source: RulesetSource;
  readonly target: CompileTarget;
  readonly required: readonly string[];
};

export type TargetSkippedEvent = {
  readonly kind: "target:skipped";
  readonly source: RulesetSource;
  readonly target: CompileTarget;
  readonly reason:
    | "missing-capability"
    | "render-error"
    | "provider-error"
    | "incompatible-provider";
  readonly diagnostics: RulesetDiagnostics;
  readonly missingCapabilities?: readonly string[];
};

export type RenderResultEvent = {
  readonly kind: "target:rendered";
  readonly source: RulesetSource;
  readonly target: CompileTarget;
  readonly artifact?: CompileArtifact;
  readonly diagnostics: RulesetDiagnostics;
  readonly ok: boolean;
};

export type ProviderResultEvent = {
  readonly kind: "target:compiled";
  readonly source: RulesetSource;
  readonly target: CompileTarget;
  readonly artifact?: CompileArtifact;
  readonly diagnostics: RulesetDiagnostics;
  readonly ok: boolean;
};

export type TargetCachedEvent = {
  readonly kind: "target:cached";
  readonly source: RulesetSource;
  readonly target: CompileTarget;
  readonly artifact: CompileArtifact;
};

export type ArtifactEmittedEvent = {
  readonly kind: "artifact:emitted";
  readonly source: RulesetSource;
  readonly artifact: CompileArtifact;
};

export type PipelineEndEvent = {
  readonly kind: "pipeline:end";
  readonly timestamp: number;
  readonly output: CompilationOutput;
};

export type CompilationEvent =
  | PipelineStartEvent
  | SourceStartEvent
  | ParseResultEvent
  | ValidateResultEvent
  | TransformResultEvent
  | TargetStartEvent
  | TargetCapabilitiesEvent
  | TargetSkippedEvent
  | RenderResultEvent
  | ProviderResultEvent
  | TargetCachedEvent
  | ArtifactEmittedEvent
  | PipelineEndEvent;

export type CompilationEventHandler = (
  event: CompilationEvent
) => void | Promise<void>;

export type OrchestratorOptions = {
  readonly parser?: RulesetParserFn;
  readonly parserOptions?: ParserOptions;
  readonly validator?: RulesetValidator;
  readonly validationOptions?: ValidationOptions;
  readonly transforms?: readonly RulesetTransform[];
  readonly renderer?: RulesetRenderer;
  readonly rendererOptions?: RendererOptions;
  readonly providers?: readonly ProviderEntry[];
  readonly onEvent?: CompilationEventHandler;
  readonly invalidatePaths?: readonly string[];
};

export type Orchestrator = (
  input: CompilationInput,
  options?: OrchestratorOptions
) => Promise<CompilationOutput>;

const buildProviderRegistry = (
  providers: readonly ProviderEntry[],
  compatibilityIssues: Map<string, RulesetDiagnostics>
): Map<string, ProviderEntry> => {
  const registry = new Map<string, ProviderEntry>();

  for (const provider of providers) {
    const diagnostics = evaluateProviderCompatibility(provider);
    if (diagnostics.length > 0) {
      compatibilityIssues.set(provider.handshake.providerId, diagnostics);
      continue;
    }

    registry.set(provider.handshake.providerId, provider);
  }

  return registry;
};

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
    sdkVersion: PROVIDER_SDK_VERSION,
    capabilities: [],
  };

  const fallback = createNoopProvider(noopHandshake);
  registry.set(targetProviderId, fallback);
  return fallback;
};

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

const shouldFailMissingCapabilities = (
  providerId: string,
  projectConfig?: RulesetProjectConfig
): boolean => {
  const providerConfig = projectConfig?.providers?.[providerId];
  if (providerConfig?.failOnMissingCapabilities !== undefined) {
    return providerConfig.failOnMissingCapabilities;
  }
  return projectConfig?.build?.failOnMissingCapabilities === true;
};

const isNonEmptyArray = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value) && value.length > 0;

const isNonEmptyRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0;

const cloneDiagnostic = (diagnostic: RulesetDiagnostic): RulesetDiagnostic => ({
  ...diagnostic,
  location: diagnostic.location
    ? { ...diagnostic.location }
    : diagnostic.location,
  tags: diagnostic.tags ? [...diagnostic.tags] : diagnostic.tags,
});

const cloneDiagnostics = (
  diagnostics: RulesetDiagnostics
): RulesetDiagnostics => diagnostics.map(cloneDiagnostic);

const cloneArtifact = (artifact: CompileArtifact): CompileArtifact => ({
  target: {
    ...artifact.target,
    capabilities: artifact.target.capabilities
      ? [...artifact.target.capabilities]
      : artifact.target.capabilities,
  },
  contents: artifact.contents,
  diagnostics: cloneDiagnostics(artifact.diagnostics),
});

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

const CACHE_FILENAME = "orchestrator-cache.json";

const DEFAULT_PARTIAL_DIRECTORIES = [
  ".ruleset/partials",
  ".ruleset/_mixins",
  ".ruleset/templates",
];

const PARTIAL_EXTENSIONS = [
  ".rule.md",
  ".ruleset.md",
  ".md",
  ".mdc",
  ".hbs",
  ".handlebars",
  ".txt",
];

const normalizeFsPath = (value: string): string => path.resolve(value);

const fileExists = async (target: string): Promise<boolean> => {
  try {
    const stats = await fs.stat(target);
    return stats.isFile();
  } catch {
    return false;
  }
};

const collectDependencyDirectories = (
  context: RulesetRuntimeContext,
  projectConfig?: RulesetProjectConfig
): readonly string[] => {
  const directories = new Set<string>();

  for (const relative of DEFAULT_PARTIAL_DIRECTORIES) {
    directories.add(path.resolve(context.cwd, relative));
  }

  const projectPartials = projectConfig?.paths?.partials;
  if (projectPartials) {
    directories.add(
      path.isAbsolute(projectPartials)
        ? normalizeFsPath(projectPartials)
        : path.resolve(context.cwd, projectPartials)
    );
  }

  const projectTemplates = projectConfig?.paths?.templates;
  if (projectTemplates) {
    directories.add(
      path.isAbsolute(projectTemplates)
        ? normalizeFsPath(projectTemplates)
        : path.resolve(context.cwd, projectTemplates)
    );
  }

  return [...directories];
};

const resolvePartialDependencyPaths = async (
  dependency: RulesetDependency,
  directories: readonly string[]
): Promise<Set<string>> => {
  const resolved = new Set<string>();
  if (dependency.resolvedPath) {
    resolved.add(normalizeFsPath(dependency.resolvedPath));
  }

  const identifier = dependency.identifier;
  if (!identifier) {
    return resolved;
  }

  const hasExtension = path.extname(identifier) !== "";
  const candidateNames = hasExtension
    ? [identifier]
    : [identifier, ...PARTIAL_EXTENSIONS.map((ext) => `${identifier}${ext}`)];

  for (const directory of directories) {
    for (const candidate of candidateNames) {
      const candidatePath = path.resolve(directory, candidate);
      if (await fileExists(candidatePath)) {
        resolved.add(candidatePath);
      }
    }
  }

  return resolved;
};

const collectResolvedDependencyPaths = async (
  document: RulesetDocument,
  context: RulesetRuntimeContext,
  projectConfig?: RulesetProjectConfig
): Promise<Set<string>> => {
  const dependencies = document.dependencies;
  if (!dependencies || dependencies.length === 0) {
    return new Set();
  }

  const directories = collectDependencyDirectories(context, projectConfig);
  const resolvedPaths = new Set<string>();

  for (const dependency of dependencies) {
    switch (dependency.kind) {
      case "partial":
      case "template": {
        const matches = await resolvePartialDependencyPaths(
          dependency,
          directories
        );
        for (const match of matches) {
          resolvedPaths.add(normalizeFsPath(match));
        }
        break;
      }
      case "asset":
      case "import": {
        if (dependency.resolvedPath) {
          resolvedPaths.add(normalizeFsPath(dependency.resolvedPath));
        }
        break;
      }
      default:
        if (dependency.resolvedPath) {
          resolvedPaths.add(normalizeFsPath(dependency.resolvedPath));
        }
        break;
    }
  }

  return resolvedPaths;
};
const CACHE_VERSION = 2;

type CachedTargetEntry = {
  readonly artifact: CompileArtifact;
};

type CachedSourceEntry = {
  readonly hash: string;
  readonly diagnostics: RulesetDiagnostics;
  readonly targets: Record<string, CachedTargetEntry>;
  readonly dependencies?: readonly string[];
};

type CompilationCacheData = {
  readonly version: number;
  readonly sources: Record<string, CachedSourceEntry>;
};

type CacheState = {
  readonly dir: string;
  data: CompilationCacheData;
  dirty: boolean;
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

const computeSourceHash = (
  source: RulesetSource,
  projectConfigPath?: string
): string => {
  const hash = createHash("sha256");
  hash.update(source.contents);
  if (source.path) {
    hash.update(source.path);
  } else if (source.id) {
    hash.update(source.id);
  }
  if (projectConfigPath) {
    hash.update(projectConfigPath);
  }
  return hash.digest("hex");
};

const getSourceKey = (source: RulesetSource): string =>
  source.path ?? source.id ?? "<anonymous>";

const appendDiagnostics = (
  bucket: RulesetDiagnostic[],
  diagnostics: RulesetDiagnostics
): void => {
  if (diagnostics.length === 0) {
    return;
  }
  bucket.push(...diagnostics);
};

const loadCompilationCache = async (
  cacheDir?: string
): Promise<CacheState | undefined> => {
  if (!cacheDir) {
    return;
  }

  const dir = path.resolve(cacheDir);
  const filePath = path.join(dir, CACHE_FILENAME);

  try {
    const contents = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(contents) as CompilationCacheData;
    if (parsed.version !== CACHE_VERSION || !parsed.sources) {
      return {
        dir,
        data: { version: CACHE_VERSION, sources: {} },
        dirty: false,
      };
    }

    return {
      dir,
      data: {
        version: CACHE_VERSION,
        sources: parsed.sources,
      },
      dirty: false,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        dir,
        data: { version: CACHE_VERSION, sources: {} },
        dirty: false,
      };
    }

    return {
      dir,
      data: { version: CACHE_VERSION, sources: {} },
      dirty: false,
    };
  }
};

const writeCompilationCache = async (state: CacheState): Promise<void> => {
  const filePath = path.join(state.dir, CACHE_FILENAME);
  const payload: CompilationCacheData = {
    version: CACHE_VERSION,
    sources: state.data.sources,
  };

  try {
    await fs.mkdir(state.dir, { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: "utf8",
    });
  } catch (_error) {
    // Swallow file system errors (e.g., read-only cache dir) and disable cache writes.
    state.dirty = false;
    return;
  }

  state.dirty = false;
};

type ResolvedOrchestratorOptions = {
  parser: RulesetParserFn;
  parserOptions: ParserOptions;
  validator: RulesetValidator;
  validationOptions: ValidationOptions;
  transforms: readonly RulesetTransform[];
  renderer: RulesetRenderer;
  rendererOptions: RendererOptions;
  providers: readonly ProviderEntry[];
  invalidatePaths: readonly string[];
};

const diagnosticsFromUnknown = (error: unknown): RulesetDiagnostics => {
  if (Array.isArray(error)) {
    return error as RulesetDiagnostics;
  }

  if (isRulesetError(error)) {
    return [
      {
        level: "error",
        message: error.message,
        hint: error.help,
        tags: ["provider", error.code],
      },
    ];
  }

  if (error instanceof Error) {
    return [
      {
        level: "error",
        message: error.message,
        hint: error.stack,
      },
    ];
  }

  if (typeof error === "string") {
    return [
      {
        level: "error",
        message: error,
      },
    ];
  }

  return [
    {
      level: "error",
      message: "Unknown error during compilation",
    },
  ];
};

const resolveOptions = (
  defaults: OrchestratorOptions,
  overrides?: OrchestratorOptions
): ResolvedOrchestratorOptions => {
  const parser = overrides?.parser ?? defaults.parser ?? createNoopParser();
  const parserOptions: ParserOptions = {
    ...defaults.parserOptions,
    ...overrides?.parserOptions,
  };

  const validator =
    overrides?.validator ?? defaults.validator ?? createNoopValidator();
  const validationOptions: ValidationOptions = {
    ...defaults.validationOptions,
    ...overrides?.validationOptions,
  };

  const transforms = overrides?.transforms ??
    defaults.transforms ?? [identityTransform];

  const renderer =
    overrides?.renderer ?? defaults.renderer ?? createPassthroughRenderer();
  const rendererOptions: RendererOptions = {
    ...defaults.rendererOptions,
    ...overrides?.rendererOptions,
  };

  const providers = overrides?.providers ?? defaults.providers ?? [];

  const invalidatePaths = [
    ...(defaults.invalidatePaths ?? []),
    ...(overrides?.invalidatePaths ?? []),
  ];

  return {
    parser,
    parserOptions,
    validator,
    validationOptions,
    transforms,
    renderer,
    rendererOptions,
    providers,
    invalidatePaths,
  };
};

export const createOrchestratorStream = (defaults: OrchestratorOptions = {}) =>
  async function* orchestratorStream(
    input: CompilationInput,
    overrides?: OrchestratorOptions
  ): AsyncGenerator<CompilationEvent, void, void> {
    const {
      parser,
      parserOptions,
      validator,
      validationOptions,
      transforms,
      renderer,
      rendererOptions,
      providers,
      invalidatePaths,
    } = resolveOptions(defaults, overrides);

    const providerCompatibilityIssues = new Map<string, RulesetDiagnostics>();
    const registry = buildProviderRegistry(
      providers,
      providerCompatibilityIssues
    );
    const providerCapabilityCache: ProviderCapabilityCache = new WeakMap();
    const cacheState = await loadCompilationCache(input.context.cacheDir);

    const aggregatedDiagnostics: RulesetDiagnostic[] = [];
    const artifacts: CompileArtifact[] = [];
    const sourceSummaries: CompilationSourceSummary[] = [];

    const invalidationSet = new Set(
      (invalidatePaths ?? []).map((value) => normalizeFsPath(value))
    );

    yield {
      kind: "pipeline:start",
      timestamp: Date.now(),
      input,
    } satisfies PipelineStartEvent;

    for (const source of input.sources) {
      yield {
        kind: "source:start",
        source,
      } satisfies SourceStartEvent;

      const sourceDiagnostics: RulesetDiagnostic[] = [];

      const parsed: ParserOutput = parser(source, parserOptions);
      appendDiagnostics(aggregatedDiagnostics, parsed.diagnostics);
      appendDiagnostics(sourceDiagnostics, parsed.diagnostics);
      yield {
        kind: "source:parsed",
        source,
        document: parsed.document,
        diagnostics: parsed.diagnostics,
      } satisfies ParseResultEvent;

      const validated = validator(parsed.document, validationOptions);
      appendDiagnostics(aggregatedDiagnostics, validated.diagnostics);
      appendDiagnostics(sourceDiagnostics, validated.diagnostics);
      yield {
        kind: "source:validated",
        source,
        document: validated.document,
        diagnostics: validated.diagnostics,
      } satisfies ValidateResultEvent;

      const transformed = runTransforms(validated.document, ...transforms);
      appendDiagnostics(aggregatedDiagnostics, transformed.diagnostics);
      appendDiagnostics(sourceDiagnostics, transformed.diagnostics);
      yield {
        kind: "source:transformed",
        source,
        document: transformed.document,
        diagnostics: transformed.diagnostics,
      } satisfies TransformResultEvent;

      const documentWithOverrides = applyDocumentOverrides(
        transformed.document,
        input.projectConfig
      );

      const resolvedDependencyPaths = await collectResolvedDependencyPaths(
        documentWithOverrides,
        input.context,
        input.projectConfig
      );

      const sourceKey = cacheState ? getSourceKey(source) : undefined;
      const sourceHash = computeSourceHash(source, input.projectConfigPath);
      const previousCacheEntry =
        sourceKey && cacheState
          ? cacheState.data.sources[sourceKey]
          : undefined;

      const previousDependencies = previousCacheEntry?.dependencies ?? [];
      const dependencyInvalidated = previousDependencies.some((dependency) =>
        invalidationSet.has(normalizeFsPath(dependency))
      );

      const cacheTargets: Record<string, CachedTargetEntry> = {};

      for (const target of input.targets) {
        yield {
          kind: "target:start",
          source,
          target,
        } satisfies TargetStartEvent;

        const requiredCapabilities = deriveRequiredCapabilities(
          documentWithOverrides,
          target,
          input.projectConfig
        );
        const targetWithCapabilities: CompileTarget = {
          ...target,
          capabilities: requiredCapabilities,
        };

        yield {
          kind: "target:capabilities",
          source,
          target: targetWithCapabilities,
          required: requiredCapabilities,
        } satisfies TargetCapabilitiesEvent;

        const compatibilityDiagnostics = providerCompatibilityIssues.get(
          target.providerId
        );

        if (compatibilityDiagnostics && compatibilityDiagnostics.length > 0) {
          appendDiagnostics(aggregatedDiagnostics, compatibilityDiagnostics);
          appendDiagnostics(sourceDiagnostics, compatibilityDiagnostics);

          yield {
            kind: "target:skipped",
            source,
            target: targetWithCapabilities,
            reason: "incompatible-provider",
            diagnostics: compatibilityDiagnostics,
          } satisfies TargetSkippedEvent;

          continue;
        }

        const provider = ensureProvider(registry, target.providerId);

        const missingCapabilities = collectMissingCapabilities(
          provider,
          requiredCapabilities,
          providerCapabilityCache
        );

        const cachedTargetEntry =
          previousCacheEntry &&
          !dependencyInvalidated &&
          previousCacheEntry.hash === sourceHash
            ? previousCacheEntry.targets[target.providerId]
            : undefined;

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

          const diagnostic = {
            level: "error" as const,
            message: `${error.message} Missing: ${missingCapabilities.join(", ")}.`,
            hint:
              capabilitySummary.length > 0
                ? `Details: ${capabilitySummary.join("; ")}`
                : error.help,
            tags: ["provider", target.providerId, "capability"],
          } satisfies RulesetDiagnostic;

          appendDiagnostics(aggregatedDiagnostics, [diagnostic]);
          appendDiagnostics(sourceDiagnostics, [diagnostic]);

          if (
            shouldFailMissingCapabilities(
              target.providerId,
              input.projectConfig
            )
          ) {
            let configurationPath: string | undefined;
            if (
              input.projectConfig?.providers?.[target.providerId]
                ?.failOnMissingCapabilities === true
            ) {
              configurationPath = `providers.${target.providerId}.failOnMissingCapabilities`;
            } else if (
              input.projectConfig?.build?.failOnMissingCapabilities === true
            ) {
              configurationPath = "build.failOnMissingCapabilities";
            }

            throw createRulesetError({
              code: "PROVIDER_CAPABILITY_UNSUPPORTED",
              message: `${diagnostic.message} Hard failure requested via configuration.`,
              diagnostics: [diagnostic],
              details: {
                providerId: target.providerId,
                missing: missingCapabilities,
                configuration: configurationPath,
              },
            });
          }

          const skippedEvent: TargetSkippedEvent = {
            kind: "target:skipped",
            source,
            target: targetWithCapabilities,
            reason: "missing-capability",
            diagnostics: [diagnostic],
            missingCapabilities,
          };
          yield skippedEvent;
          continue;
        }

        if (cachedTargetEntry) {
          const cachedArtifact = cloneArtifact(cachedTargetEntry.artifact);

          if (
            cachedArtifact.target.outputPath ===
            targetWithCapabilities.outputPath
          ) {
            appendDiagnostics(
              aggregatedDiagnostics,
              cachedArtifact.diagnostics
            );
            appendDiagnostics(sourceDiagnostics, cachedArtifact.diagnostics);
            artifacts.push(cachedArtifact);
            cacheTargets[target.providerId] = {
              artifact: cloneArtifact(cachedArtifact),
            };

            yield {
              kind: "target:cached",
              source,
              target: cachedArtifact.target,
              artifact: cachedArtifact,
            } satisfies TargetCachedEvent;

            yield {
              kind: "target:compiled",
              source,
              target: cachedArtifact.target,
              artifact: cachedArtifact,
              diagnostics: cachedArtifact.diagnostics,
              ok: true,
            } satisfies ProviderResultEvent;

            yield {
              kind: "artifact:emitted",
              source,
              artifact: cachedArtifact,
            } satisfies ArtifactEmittedEvent;

            continue;
          }
        }

        const renderResult = renderer(
          documentWithOverrides,
          targetWithCapabilities,
          rendererOptions
        );

        if (!renderResult.ok) {
          const diagnostics = diagnosticsFromUnknown(renderResult.error);
          appendDiagnostics(aggregatedDiagnostics, diagnostics);
          appendDiagnostics(sourceDiagnostics, diagnostics);
          yield {
            kind: "target:rendered",
            source,
            target: targetWithCapabilities,
            diagnostics,
            ok: false,
          } satisfies RenderResultEvent;

          const skippedEvent: TargetSkippedEvent = {
            kind: "target:skipped",
            source,
            target: targetWithCapabilities,
            reason: "render-error",
            diagnostics,
          };
          yield skippedEvent;
          continue;
        }

        const renderedArtifact: CompileArtifact = {
          ...renderResult.value,
          target: {
            ...renderResult.value.target,
            capabilities: normalizeCapabilityIds(
              renderResult.value.target.capabilities ?? requiredCapabilities
            ),
          },
        };

        appendDiagnostics(aggregatedDiagnostics, renderedArtifact.diagnostics);
        appendDiagnostics(sourceDiagnostics, renderedArtifact.diagnostics);
        yield {
          kind: "target:rendered",
          source,
          target: renderedArtifact.target,
          artifact: renderedArtifact,
          diagnostics: renderedArtifact.diagnostics,
          ok: true,
        } satisfies RenderResultEvent;

        const providerTarget: CompileTarget = {
          ...renderedArtifact.target,
          outputPath:
            renderedArtifact.target.outputPath ??
            targetWithCapabilities.outputPath,
        };

        const compileInput: ProviderCompileInput = {
          document: documentWithOverrides,
          context: input.context,
          target: providerTarget,
          projectConfig: input.projectConfig,
          projectConfigPath: input.projectConfigPath,
          rendered: renderedArtifact,
        };

        const providerResult = await executeProviderCompile(
          provider,
          compileInput
        );

        if (!providerResult.ok) {
          const providerDiagnostics = diagnosticsFromUnknown(
            providerResult.error
          );
          appendDiagnostics(aggregatedDiagnostics, providerDiagnostics);
          appendDiagnostics(sourceDiagnostics, providerDiagnostics);

          yield {
            kind: "target:compiled",
            source,
            target: providerTarget,
            artifact: undefined,
            diagnostics: providerDiagnostics,
            ok: false,
          } satisfies ProviderResultEvent;

          const skippedEvent: TargetSkippedEvent = {
            kind: "target:skipped",
            source,
            target: providerTarget,
            reason: "provider-error",
            diagnostics: providerDiagnostics,
          };
          yield skippedEvent;
          continue;
        }

        const normalizedArtifact: CompileArtifact = {
          ...providerResult.value,
          target: {
            ...providerResult.value.target,
            capabilities: normalizeCapabilityIds(
              providerResult.value.target.capabilities ?? requiredCapabilities
            ),
          },
        };

        appendDiagnostics(
          aggregatedDiagnostics,
          normalizedArtifact.diagnostics
        );
        appendDiagnostics(sourceDiagnostics, normalizedArtifact.diagnostics);
        artifacts.push(normalizedArtifact);

        yield {
          kind: "target:compiled",
          source,
          target: normalizedArtifact.target,
          artifact: normalizedArtifact,
          diagnostics: normalizedArtifact.diagnostics,
          ok: true,
        } satisfies ProviderResultEvent;

        yield {
          kind: "artifact:emitted",
          source,
          artifact: normalizedArtifact,
        } satisfies ArtifactEmittedEvent;

        cacheTargets[target.providerId] = {
          artifact: cloneArtifact(normalizedArtifact),
        };
      }

      const dependencyList = Array.from(resolvedDependencyPaths).sort();

      if (cacheState && sourceKey) {
        cacheState.data.sources[sourceKey] = {
          hash: sourceHash,
          diagnostics: cloneDiagnostics(sourceDiagnostics),
          targets: cacheTargets,
          dependencies: dependencyList,
        };
        cacheState.dirty = true;
      }

      sourceSummaries.push({
        sourceId: source.id,
        sourcePath: source.path,
        dependencies: dependencyList,
      });
    }

    const output: CompilationOutput = {
      artifacts,
      diagnostics: aggregatedDiagnostics,
      sourceSummaries,
    };

    if (cacheState?.dirty) {
      await writeCompilationCache(cacheState);
    }

    yield {
      kind: "pipeline:end",
      timestamp: Date.now(),
      output,
    } satisfies PipelineEndEvent;
  };

export const compileRulesetsStream = (
  input: CompilationInput,
  options?: OrchestratorOptions
): AsyncIterable<CompilationEvent> =>
  createOrchestratorStream(options)(input, options);

export const createOrchestrator = (
  defaults: OrchestratorOptions = {}
): Orchestrator => {
  const streamFactory = createOrchestratorStream(defaults);

  return async (input, overrides) => {
    const onEvent = overrides?.onEvent ?? defaults.onEvent;
    let finalOutput: CompilationOutput | undefined;

    for await (const event of streamFactory(input, overrides)) {
      if (onEvent) {
        await onEvent(event);
      }

      if (event.kind === "pipeline:end") {
        finalOutput = event.output;
      }
    }

    return (
      finalOutput ?? {
        artifacts: [],
        diagnostics: [],
      }
    );
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

export type { WatchExecutor, WatchExecutorResult, WatchOptions } from "./watch";
// biome-ignore lint/performance/noBarrelFile: orchestrator exposes watch utility for CLI reuse
export { watchRulesets } from "./watch";
