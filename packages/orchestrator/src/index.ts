import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createNoopParser,
  type ParserOptions,
  type ParserOutput,
  type RulesetParserFn,
} from "@ruleset/parser";
import {
  createNoopProvider,
  evaluateProviderCompatibility,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderEntry,
  type ProviderHandshake,
} from "@ruleset/providers";
import {
  createHandlebarsRenderer,
  type HandlebarsHelper,
  type HandlebarsHelperMap,
  type RendererFormat,
  type RendererOptions,
  type RulesetRenderer,
} from "@ruleset/renderer";
import {
  identityTransform,
  type RulesetTransform,
  runTransforms,
} from "@ruleset/transform";
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
} from "@ruleset/types";
import {
  createNoopValidator,
  type RulesetValidator,
  type ValidationOptions,
} from "@ruleset/validator";
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

const cloneArtifacts = (
  artifacts: readonly CompileArtifact[]
): CompileArtifact[] => artifacts.map(cloneArtifact);

type HandlebarsDirective = {
  readonly enabled: boolean;
  readonly force?: boolean;
  readonly strict?: boolean;
  readonly noEscape?: boolean;
  readonly helpers?: readonly string[];
  readonly partials?: Record<string, string>;
  readonly projectConfigOverrides?: Record<string, JsonValue>;
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
    const helpers = toStringArray(value.helpers);
    const partials = toPartialRecord(value.partials);
    const overrides = toJsonRecord(value.projectConfigOverrides);
    const force = typeof value.force === "boolean" ? value.force : undefined;
    const strict = typeof value.strict === "boolean" ? value.strict : undefined;
    const noEscape =
      typeof value.noEscape === "boolean" ? value.noEscape : undefined;

    return {
      enabled: true,
      force,
      strict,
      noEscape,
      helpers,
      partials,
      projectConfigOverrides: overrides,
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

  const helpers = toStringArray(value.helpers);
  const partials = toPartialRecord(value.partials);
  const rawOverrides = (value as { projectConfigOverrides?: unknown })
    .projectConfigOverrides;
  const overrides = toJsonRecord(rawOverrides);
  const force = value.force === true ? true : undefined;
  const strict = typeof value.strict === "boolean" ? value.strict : undefined;
  const noEscape =
    typeof value.noEscape === "boolean" ? value.noEscape : undefined;
  const enabledField =
    typeof (value as { enabled?: unknown }).enabled === "boolean"
      ? ((value as { enabled?: boolean }).enabled as boolean)
      : undefined;

  return {
    enabled: enabledField ?? true,
    force,
    strict,
    noEscape,
    helpers,
    partials,
    projectConfigOverrides: overrides,
  };
};

type HandlebarsRequirements = {
  requiresHandlebars: boolean;
  requiresHelpers: boolean;
  requiresPartials: boolean;
};

type AggregatedHandlebarsSettings = {
  readonly enabled: boolean;
  readonly force: boolean;
  readonly strict?: boolean;
  readonly noEscape?: boolean;
  readonly helperModules: readonly string[];
  readonly inlinePartials: Record<string, string>;
  readonly projectConfigOverrides?: Record<string, JsonValue>;
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

const toStringArray = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) {
    return;
  }

  const entries = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : undefined))
    .filter((entry): entry is string => Boolean(entry));

  return entries.length > 0 ? entries : undefined;
};

const toPartialRecord = (
  value: unknown
): Record<string, string> | undefined => {
  if (!isPlainObjectLike(value)) {
    return;
  }

  const record: Record<string, string> = {};
  for (const [name, template] of Object.entries(value)) {
    if (typeof template === "string" && template.trim().length > 0) {
      record[name] = template;
    }
  }

  return Object.keys(record).length > 0 ? record : undefined;
};

const toJsonRecord = (
  value: unknown
): Record<string, JsonValue> | undefined => {
  const candidate = value as JsonValue | undefined;
  if (!isJsonObject(candidate)) {
    return;
  }
  return candidate as Record<string, JsonValue>;
};

const isPlainObjectLike = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeRendererFormat = (
  value: unknown
): RendererFormat | undefined => {
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

const resolveProviderFormat = (
  document: RulesetDocument,
  projectConfig: RulesetProjectConfig | undefined,
  providerId: string
): RendererFormat => {
  let format: RendererFormat = "markdown";

  const projectFormat = normalizeRendererFormat(
    projectConfig?.providers?.[providerId]?.format
  );
  if (projectFormat) {
    format = projectFormat;
  }

  const frontMatter = document.metadata.frontMatter;
  if (frontMatter) {
    const providerOverride = frontMatter[providerId];

    if (isJsonObject(providerOverride)) {
      const overrideFormat = normalizeRendererFormat(providerOverride.format);
      if (overrideFormat) {
        format = overrideFormat;
      }
    } else {
      const overrideFormat = normalizeRendererFormat(providerOverride);
      if (overrideFormat) {
        format = overrideFormat;
      }
    }
  }

  return format;
};

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

  // Add sources.partials directories
  const sources = projectConfig?.sources;
  if (sources?.partials) {
    for (const partialPath of sources.partials) {
      directories.add(
        path.isAbsolute(partialPath)
          ? normalizeFsPath(partialPath)
          : path.resolve(context.cwd, partialPath)
      );
    }
  }

  // Add paths.partials directory (legacy config structure)
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
): Promise<string[]> => {
  const resolved = new Set<string>();
  if (dependency.resolvedPath) {
    resolved.add(normalizeFsPath(dependency.resolvedPath));
  }

  const identifier = dependency.identifier;
  if (!identifier) {
    return [...resolved];
  }

  const hasExtension = path.extname(identifier) !== "";
  const candidateNames = hasExtension
    ? [identifier]
    : [identifier, ...PARTIAL_EXTENSIONS.map((ext) => `${identifier}${ext}`)];

  for (const directory of directories) {
    for (const candidate of candidateNames) {
      const candidatePath = path.resolve(directory, candidate);
      if (await fileExists(candidatePath)) {
        resolved.add(normalizeFsPath(candidatePath));
      }
    }
  }

  return [...resolved];
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
          resolvedPaths.add(match);
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

type LoadedHandlebarsPartials = {
  readonly partials: Record<string, string>;
  readonly diagnostics: RulesetDiagnostics;
  readonly paths: readonly string[];
};

const loadHandlebarsPartials = async (
  document: RulesetDocument,
  directories: readonly string[]
): Promise<LoadedHandlebarsPartials> => {
  const dependencies = document.dependencies;
  if (!dependencies || dependencies.length === 0) {
    return { partials: {}, diagnostics: [], paths: [] };
  }

  const partials = new Map<string, string>();
  const diagnostics: RulesetDiagnostic[] = [];
  const paths = new Set<string>();

  for (const dependency of dependencies) {
    if (dependency.kind !== "partial" && dependency.kind !== "template") {
      continue;
    }

    const identifier = dependency.identifier;
    if (!identifier) {
      continue;
    }

    const matches = await resolvePartialDependencyPaths(
      dependency,
      directories
    );

    for (const match of matches) {
      paths.add(match);
    }

    if (matches.length === 0) {
      diagnostics.push({
        level: "warning",
        message: `No partial found for identifier '${identifier}'.`,
        tags: ["renderer", "handlebars", "partial"],
      });
      continue;
    }

    const partialPath = matches[0];
    try {
      const contents = await fs.readFile(partialPath, "utf8");
      partials.set(identifier, contents);
    } catch (error) {
      diagnostics.push({
        level: "warning",
        message: `Failed to load partial '${identifier}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        tags: ["renderer", "handlebars", "partial"],
      });
    }
  }

  return {
    partials: Object.fromEntries(partials),
    diagnostics: diagnostics as RulesetDiagnostics,
    paths: [...paths],
  };
};

type LoadedHandlebarsHelpers = {
  readonly helpers: HandlebarsHelperMap;
  readonly diagnostics: RulesetDiagnostics;
  readonly paths: readonly string[];
};

const importHelperModule = async (
  specifier: string,
  cwd: string
): Promise<{ module: unknown; resolvedPath?: string }> => {
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const resolvedPath = path.isAbsolute(specifier)
      ? specifier
      : path.resolve(cwd, specifier);
    const module = await import(pathToFileURL(resolvedPath).href);
    return { module, resolvedPath };
  }

  const module = await import(specifier);
  return { module };
};

const selectHelperExports = (
  moduleNamespace: unknown
): Record<string, HandlebarsHelper> => {
  const helpers: Record<string, HandlebarsHelper> = {};

  if (!isPlainObjectLike(moduleNamespace)) {
    return helpers;
  }

  const { default: defaultExport, ...namedExports } = moduleNamespace as Record<
    string,
    unknown
  >;

  if (isPlainObjectLike(defaultExport)) {
    for (const [name, candidate] of Object.entries(defaultExport)) {
      if (typeof candidate === "function") {
        helpers[name] = candidate as HandlebarsHelper;
      }
    }
  }

  for (const [name, candidate] of Object.entries(namedExports)) {
    if (typeof candidate === "function") {
      helpers[name] = candidate as HandlebarsHelper;
    }
  }

  return helpers;
};

const loadHandlebarsHelpers = async (
  helperModules: readonly string[] | undefined,
  context: RulesetRuntimeContext
): Promise<LoadedHandlebarsHelpers> => {
  if (!helperModules || helperModules.length === 0) {
    return { helpers: {}, diagnostics: [], paths: [] };
  }

  const diagnostics: RulesetDiagnostic[] = [];
  const aggregatedHelpers: Record<string, HandlebarsHelper> = {};
  const paths = new Set<string>();

  for (const entry of helperModules) {
    const specifier = entry.trim();
    if (!specifier) {
      continue;
    }

    try {
      const { module, resolvedPath } = await importHelperModule(
        specifier,
        context.cwd
      );
      if (resolvedPath) {
        paths.add(normalizeFsPath(resolvedPath));
      }

      const helpers = selectHelperExports(module);
      if (Object.keys(helpers).length === 0) {
        diagnostics.push({
          level: "warning",
          message: `Helper module '${specifier}' did not export any helpers.`,
          tags: ["renderer", "handlebars", "helpers"],
        });
        continue;
      }

      Object.assign(aggregatedHelpers, helpers);
    } catch (error) {
      diagnostics.push({
        level: "error",
        message: `Failed to load Handlebars helpers from '${specifier}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        tags: ["renderer", "handlebars", "helpers"],
      });
    }
  }

  return {
    helpers: Object.freeze(aggregatedHelpers) as HandlebarsHelperMap,
    diagnostics: diagnostics as RulesetDiagnostics,
    paths: [...paths],
  };
};

type HandlebarsTemplateContextInput = {
  readonly document: RulesetDocument;
  readonly target: CompileTarget;
  readonly provider: ProviderEntry;
  readonly runtimeContext: RulesetRuntimeContext;
  readonly projectConfig?: RulesetProjectConfig;
  readonly overrides?: Record<string, JsonValue>;
};

const buildHandlebarsTemplateContext = (
  input: HandlebarsTemplateContextInput
): Record<string, unknown> => {
  const {
    document,
    target,
    provider,
    runtimeContext,
    projectConfig,
    overrides,
  } = input;

  const frontMatter = document.metadata.frontMatter ?? {};
  const ruleFrontMatter = isJsonObject(frontMatter.rule)
    ? (frontMatter.rule as Record<string, JsonValue>)
    : undefined;

  const metadata: Record<string, unknown> = {
    description: frontMatter.description,
    version:
      (typeof ruleFrontMatter?.version === "string"
        ? ruleFrontMatter.version
        : frontMatter.version) ?? document.metadata.version,
    globs: Array.isArray(ruleFrontMatter?.globs)
      ? ruleFrontMatter.globs.filter(
          (value): value is string => typeof value === "string"
        )
      : undefined,
  };

  const env = Object.fromEntries(runtimeContext.env);

  return {
    provider: {
      id: provider.handshake.providerId,
      version: provider.handshake.version,
      capabilities: provider.handshake.capabilities.map((capability) =>
        "id" in capability ? capability.id : capability
      ),
    },
    file: {
      id: document.source.id,
      path: document.source.path,
      format: document.source.format,
      name: frontMatter.name,
      frontmatter: frontMatter,
      metadata,
    },
    project: projectConfig,
    overrides,
    runtime: {
      cwd: runtimeContext.cwd,
      cacheDir: runtimeContext.cacheDir,
      version: runtimeContext.version,
      env,
    },
    target: {
      outputPath: target.outputPath,
      capabilities: target.capabilities,
    },
    timestamp: new Date().toISOString(),
  };
};
const CACHE_VERSION = 3;

type CachedTargetEntry = {
  readonly artifacts: readonly CompileArtifact[];
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

const deriveHandlebarsSettings = (
  document: RulesetDocument,
  projectConfig: RulesetProjectConfig | undefined,
  providerId: string
): AggregatedHandlebarsSettings => {
  const requirement = evaluateHandlebarsRequirements(
    document,
    projectConfig,
    providerId
  );

  const directives: HandlebarsDirective[] = [];

  const frontMatter = document.metadata.frontMatter;
  const ruleFrontMatter = isJsonObject(frontMatter?.rule)
    ? normalizeHandlebarsDirective(
        (frontMatter?.rule as Record<string, JsonValue>).handlebars as
          | JsonValue
          | undefined
      )
    : undefined;

  const providerFrontMatter = isJsonObject(frontMatter?.[providerId])
    ? normalizeHandlebarsDirective(
        (frontMatter?.[providerId] as Record<string, JsonValue>).handlebars as
          | JsonValue
          | undefined
      )
    : undefined;

  const projectRuleDirective = normalizeConfigHandlebarsDirective(
    projectConfig?.rule?.handlebars
  );

  const providerConfigDirective = normalizeConfigHandlebarsDirective(
    projectConfig?.providers?.[providerId]?.handlebars
  );

  if (projectRuleDirective) {
    directives.push(projectRuleDirective);
  }

  if (ruleFrontMatter) {
    directives.push(ruleFrontMatter);
  }

  if (providerConfigDirective) {
    directives.push(providerConfigDirective);
  }

  if (providerFrontMatter) {
    directives.push(providerFrontMatter);
  }

  let enabled = requirement.requiresHandlebars;
  let force = false;
  let strict: boolean | undefined;
  let noEscape: boolean | undefined;
  const helperModules: string[] = [];
  const inlinePartialRecords: Record<string, string>[] = [];
  let overrides: Record<string, JsonValue> | undefined;

  for (const directive of directives) {
    if (directive.enabled === true) {
      enabled = true;
    }

    if (directive.force === true) {
      force = true;
    }

    if (directive.strict !== undefined) {
      strict = directive.strict;
    }

    if (directive.noEscape !== undefined) {
      noEscape = directive.noEscape;
    }

    if (directive.helpers) {
      for (const helperPath of directive.helpers) {
        if (!helperModules.includes(helperPath)) {
          helperModules.push(helperPath);
        }
      }
    }

    if (directive.partials) {
      inlinePartialRecords.push(directive.partials);
    }

    if (directive.projectConfigOverrides) {
      overrides = {
        ...(overrides ?? {}),
        ...directive.projectConfigOverrides,
      };
    }
  }

  const inlinePartials = Object.assign({}, ...inlinePartialRecords);

  return {
    enabled,
    force,
    strict,
    noEscape,
    helperModules,
    inlinePartials,
    projectConfigOverrides: overrides,
  };
};

const deriveRequiredCapabilities = (
  document: RulesetDocument,
  target: CompileTarget,
  projectConfig: RulesetProjectConfig | undefined,
  formatOverride?: RendererFormat
): readonly string[] => {
  const explicit = normalizeCapabilityIds(target.capabilities);
  const capabilities = new Set<string>(explicit);

  const resolvedFormat =
    formatOverride ??
    resolveProviderFormat(document, projectConfig, target.providerId);

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

  if (resolvedFormat === "xml") {
    capabilities.add("output:sections");
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
    overrides?.renderer ?? defaults.renderer ?? createHandlebarsRenderer();
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

        const renderFormat = resolveProviderFormat(
          documentWithOverrides,
          input.projectConfig,
          target.providerId
        );

        const requiredCapabilities = deriveRequiredCapabilities(
          documentWithOverrides,
          target,
          input.projectConfig,
          renderFormat
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
          const cachedArtifacts = cloneArtifacts(cachedTargetEntry.artifacts);
          const primaryCachedArtifact = cachedArtifacts[0];

          if (
            primaryCachedArtifact &&
            primaryCachedArtifact.target.outputPath ===
              targetWithCapabilities.outputPath
          ) {
            for (const cachedArtifact of cachedArtifacts) {
              appendDiagnostics(
                aggregatedDiagnostics,
                cachedArtifact.diagnostics
              );
              appendDiagnostics(sourceDiagnostics, cachedArtifact.diagnostics);
              artifacts.push(cachedArtifact);
            }

            cacheTargets[target.providerId] = {
              artifacts: cloneArtifacts(cachedArtifacts),
            };

            yield {
              kind: "target:cached",
              source,
              target: primaryCachedArtifact.target,
              artifact: primaryCachedArtifact,
            } satisfies TargetCachedEvent;

            for (const cachedArtifact of cachedArtifacts) {
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
            }

            continue;
          }
        }

        const handlebarsSettings = deriveHandlebarsSettings(
          documentWithOverrides,
          input.projectConfig,
          target.providerId
        );

        const dependencyDirectories = collectDependencyDirectories(
          input.context,
          input.projectConfig
        );

        const partialsResult = await loadHandlebarsPartials(
          documentWithOverrides,
          dependencyDirectories
        );

        for (const partialPath of partialsResult.paths) {
          resolvedDependencyPaths.add(normalizeFsPath(partialPath));
        }

        const helpersResult = await loadHandlebarsHelpers(
          handlebarsSettings.helperModules,
          input.context
        );

        for (const helperPath of helpersResult.paths) {
          resolvedDependencyPaths.add(normalizeFsPath(helperPath));
        }

        const baseHandlebarsOptions = rendererOptions.handlebars;

        const basePartials: Record<string, string> =
          baseHandlebarsOptions?.partials
            ? (Object.fromEntries(
                Object.entries(baseHandlebarsOptions.partials)
              ) as Record<string, string>)
            : {};

        const mergedPartials: Record<string, string> = {
          ...partialsResult.partials,
          ...basePartials,
          ...handlebarsSettings.inlinePartials,
        };

        const helpersFromLoader: Record<string, HandlebarsHelper> =
          Object.fromEntries(Object.entries(helpersResult.helpers)) as Record<
            string,
            HandlebarsHelper
          >;

        const helpersFromBase: Record<string, HandlebarsHelper> =
          baseHandlebarsOptions?.helpers
            ? (Object.fromEntries(
                Object.entries(baseHandlebarsOptions.helpers)
              ) as Record<string, HandlebarsHelper>)
            : {};

        const mergedHelpers: Record<string, HandlebarsHelper> = {
          ...helpersFromBase,
          ...helpersFromLoader,
        };

        const templateContext = buildHandlebarsTemplateContext({
          document: documentWithOverrides,
          target: targetWithCapabilities,
          provider,
          runtimeContext: input.context,
          projectConfig: input.projectConfig,
          overrides: handlebarsSettings.projectConfigOverrides,
        });

        const rendererDiagnostics = [
          ...(baseHandlebarsOptions?.diagnostics ?? []),
          ...partialsResult.diagnostics,
          ...helpersResult.diagnostics,
        ];

        const invocationOptions: RendererOptions = {
          ...rendererOptions,
          transforms,
          format: renderFormat,
          handlebars: {
            ...(baseHandlebarsOptions ?? {}),
            enabled:
              (baseHandlebarsOptions?.enabled ?? false) ||
              handlebarsSettings.enabled,
            force:
              (baseHandlebarsOptions?.force ?? false) ||
              handlebarsSettings.force,
            strict: handlebarsSettings.strict ?? baseHandlebarsOptions?.strict,
            noEscape:
              handlebarsSettings.noEscape ?? baseHandlebarsOptions?.noEscape,
            partials: mergedPartials,
            helpers: mergedHelpers,
            context: templateContext,
            diagnostics: rendererDiagnostics,
            label:
              baseHandlebarsOptions?.label ?? provider.handshake.providerId,
          },
        };

        const renderResult = renderer(
          documentWithOverrides,
          targetWithCapabilities,
          invocationOptions
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

        const providerArtifactsRaw = Array.isArray(providerResult.value)
          ? providerResult.value
          : [providerResult.value];

        const normalizedArtifacts: CompileArtifact[] = providerArtifactsRaw.map(
          (artifactCandidate) => {
            const candidateTarget = artifactCandidate.target ?? {};
            const normalizedTarget: CompileTarget = {
              ...providerTarget,
              ...candidateTarget,
              outputPath:
                candidateTarget.outputPath ?? providerTarget.outputPath,
              capabilities: normalizeCapabilityIds(
                candidateTarget.capabilities ?? requiredCapabilities
              ),
            };

            return {
              target: normalizedTarget,
              contents: artifactCandidate.contents,
              diagnostics: artifactCandidate.diagnostics ?? [],
            } satisfies CompileArtifact;
          }
        );

        for (const normalizedArtifact of normalizedArtifacts) {
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
        }

        if (normalizedArtifacts.length > 0) {
          cacheTargets[target.providerId] = {
            artifacts: cloneArtifacts(normalizedArtifacts),
          };
        }
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
