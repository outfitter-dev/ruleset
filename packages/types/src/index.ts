/**
 * Shared type definitions for the Rulesets v0.4 toolchain.
 *
 * These contracts are extracted from the legacy `@rulesets/core` interfaces
 * so that packages can collaborate without depending on the monolithic core
 * bundle.
 */

import type {
  JsonObject as JsonObjectType,
  JsonValue as JsonValueType,
  LiteralUnion,
  ReadonlyDeep,
} from "type-fest";
import { z } from "zod";
import { type JsonSchema7Type, zodToJsonSchema } from "zod-to-json-schema";

export type JsonValue = JsonValueType;

export type JsonObject = JsonObjectType;

export type RulesetVersionTag =
  | `${number}.${number}.${number}`
  | `${number}.${number}.${number}-${string}`;

export const RULESETS_VERSION_TAG: RulesetVersionTag = "0.4.0-next.0";

export type RulesetSource = {
  readonly id: string;
  readonly path?: string;
  readonly contents: string;
  readonly format: "rule" | "ruleset";
  readonly template?: boolean;
};

export type DiagnosticLevel = "error" | "warning" | "info";

export type DiagnosticLocation = {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
};

export type RulesetDiagnostic = {
  readonly level: DiagnosticLevel;
  readonly message: string;
  readonly location?: DiagnosticLocation;
  readonly hint?: string;
  readonly tags?: readonly string[];
};

export type RulesetDiagnostics = readonly RulesetDiagnostic[];

export type RulesetDocumentMetadata = {
  readonly frontMatter: Record<string, JsonValue>;
  readonly hash?: string;
  readonly version?: RulesetVersionTag;
};

export type RulesetDependencyKind = "partial" | "import" | "template" | "asset";

export type RulesetDependency = {
  readonly kind: RulesetDependencyKind;
  readonly identifier: string;
  readonly resolvedPath?: string;
};

export type Section = {
  name: string;
  properties?: Record<string, JsonValue>;
  content?: string;
  rawMarker?: string;
};

export type Import = {
  path: string;
};

export type Variable = {
  name: string;
};

export type Marker = {
  type: "section" | "import" | "variable" | "unknown";
};

export type RulesetAst = {
  readonly sections: readonly Section[];
  readonly imports: readonly Import[];
  readonly variables: readonly Variable[];
  readonly markers: readonly Marker[];
};

export type RulesetDocument = {
  readonly source: RulesetSource;
  readonly metadata: RulesetDocumentMetadata;
  readonly ast: RulesetAst;
  readonly diagnostics?: RulesetDiagnostics;
  readonly dependencies?: readonly RulesetDependency[];
};

export type ParsedDoc = {
  source: {
    path?: string;
    content: string;
    frontmatter?: Record<string, JsonValue>;
    isRule?: boolean;
  };
  ast: RulesetAst;
  errors?: ReadonlyArray<{
    message: string;
    line?: number;
    column?: number;
  }>;
};

export type CompileTarget = {
  readonly providerId: string;
  readonly outputPath: string;
  readonly capabilities?: readonly string[];
};

export type CompiledDoc = {
  source: ParsedDoc["source"];
  ast: RulesetAst;
  output: {
    content: string;
    metadata?: Record<string, JsonValue>;
  };
  context: {
    destinationId: string;
    config: Record<string, JsonValue>;
  };
};

export type CompileArtifact = {
  readonly target: CompileTarget;
  readonly contents: string;
  readonly diagnostics: RulesetDiagnostics;
};

const freezeArray = <TValue>(values?: readonly TValue[]): readonly TValue[] =>
  Object.freeze([...(values ?? [])]);

const freezeDiagnostics = (
  diagnostics?: RulesetDiagnostics
): RulesetDiagnostics | undefined =>
  diagnostics ? (freezeArray(diagnostics) as RulesetDiagnostics) : undefined;

export type ResultOk<TValue> = {
  readonly ok: true;
  readonly value: TValue;
};

export type ResultErr<TError = RulesetError | RulesetDiagnostics> = {
  readonly ok: false;
  readonly error: TError;
};

export type Result<TValue, TError = RulesetError | RulesetDiagnostics> =
  | ResultOk<TValue>
  | ResultErr<TError>;

export const createResultOk = <TValue>(value: TValue): ResultOk<TValue> => ({
  ok: true as const,
  value,
});

export const createResultErr = <TError>(error: TError): ResultErr<TError> => ({
  ok: false as const,
  error,
});

export const isResultOk = <TValue, TError>(
  result: Result<TValue, TError>
): result is ResultOk<TValue> => result.ok === true;

export const isResultErr = <TValue, TError>(
  result: Result<TValue, TError>
): result is ResultErr<TError> => result.ok === false;

export type RulesetRuntimeContext = {
  readonly version: RulesetVersionTag;
  readonly cwd: string;
  readonly cacheDir: string;
  readonly env: ReadonlyMap<string, string>;
};

export type CompilationInput = {
  readonly context: RulesetRuntimeContext;
  readonly sources: readonly RulesetSource[];
  readonly targets: readonly CompileTarget[];
  readonly projectConfig?: RulesetProjectConfig;
  readonly projectConfigPath?: string;
};

export type CompilationOutput = {
  readonly artifacts: readonly CompileArtifact[];
  readonly diagnostics: RulesetDiagnostics;
  readonly sourceSummaries?: readonly CompilationSourceSummary[];
};

export type CompilationSourceSummary = {
  readonly sourceId: string;
  readonly sourcePath?: string;
  readonly dependencies: readonly string[];
};

export type AsyncMaybe<T> = Promise<T> | T;

export type Task<TPayload = void> = () => AsyncMaybe<TPayload>;

export const RULESET_ERROR_CODES = [
  "PROJECT_CONFIG_NOT_FOUND",
  "PROJECT_CONFIG_INVALID",
  "SOURCE_NOT_FOUND",
  "SOURCE_UNREADABLE",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_CAPABILITY_UNSUPPORTED",
  "RENDERER_UNAVAILABLE",
  "TRANSFORM_FAILED",
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
] as const;

export type RulesetErrorCode = (typeof RULESET_ERROR_CODES)[number];

export type RulesetError<TDetails = JsonValue> = ReadonlyDeep<{
  readonly code: RulesetErrorCode;
  readonly message: string;
  readonly details?: TDetails;
  readonly diagnostics?: RulesetDiagnostics;
  readonly cause?: unknown;
  readonly help?: string;
}>;

export type RulesetErrorInput<TDetails = JsonValue> = {
  readonly code: RulesetErrorCode;
  readonly message: string;
  readonly details?: TDetails;
  readonly diagnostics?: RulesetDiagnostics;
  readonly cause?: unknown;
  readonly help?: string;
};

export const createRulesetError = <TDetails = JsonValue>(
  input: RulesetErrorInput<TDetails>
): RulesetError<TDetails> => {
  const { details, diagnostics, ...rest } = input;
  const normalizedDetails =
    details === undefined ? undefined : (details as ReadonlyDeep<TDetails>);
  const normalizedDiagnostics = freezeDiagnostics(diagnostics);

  const error = Object.freeze({
    ...rest,
    ...(normalizedDetails === undefined ? {} : { details: normalizedDetails }),
    ...(normalizedDiagnostics === undefined
      ? {}
      : { diagnostics: normalizedDiagnostics }),
  }) as RulesetError<TDetails>;

  return error;
};

export const isRulesetError = (value: unknown): value is RulesetError =>
  Boolean(
    value &&
      typeof (value as Partial<RulesetError>).code === "string" &&
      typeof (value as Partial<RulesetError>).message === "string"
  );

export type RulesetCapabilityId = LiteralUnion<
  | "render:markdown"
  | "render:handlebars"
  | "render:handlebars:helpers"
  | "render:handlebars:partials"
  | "sandbox:bun-subprocess"
  | "sandbox:in-process"
  | "output:filesystem"
  | "output:sections"
  | "diagnostics:structured"
  | "telemetry:events"
  | "watch:incremental",
  string
>;

export type CapabilityDescriptor = ReadonlyDeep<{
  readonly id: RulesetCapabilityId;
  readonly description: string;
  readonly introducedIn: RulesetVersionTag;
  readonly deprecatedIn?: RulesetVersionTag;
  readonly experimental?: boolean;
  readonly requires: readonly RulesetCapabilityId[];
}>;

export type CapabilityDescriptorInput = {
  readonly id: RulesetCapabilityId;
  readonly description: string;
  readonly introducedIn?: RulesetVersionTag;
  readonly deprecatedIn?: RulesetVersionTag;
  readonly experimental?: boolean;
  readonly requires?: readonly RulesetCapabilityId[];
};

export const defineCapability = (
  descriptor: CapabilityDescriptorInput
): CapabilityDescriptor => {
  const capability = Object.freeze({
    ...descriptor,
    introducedIn: descriptor.introducedIn ?? RULESETS_VERSION_TAG,
    requires: freezeArray(
      descriptor.requires
    ) as readonly RulesetCapabilityId[],
  }) as CapabilityDescriptor;

  return capability;
};

export const RULESET_CAPABILITIES = {
  MARKDOWN_RENDER: defineCapability({
    id: "render:markdown",
    description:
      "Supports Markdown passthrough rendering managed by the orchestrator.",
  }),
  HANDLEBARS_RENDER: defineCapability({
    id: "render:handlebars",
    description:
      "Supports Handlebars templating with orchestrator-managed helpers and partials.",
  }),
  HANDLEBARS_CUSTOM_HELPERS: defineCapability({
    id: "render:handlebars:helpers",
    description:
      "Allows provider-defined Handlebars helpers in addition to orchestrator defaults.",
    requires: ["render:handlebars"],
    experimental: true,
  }),
  HANDLEBARS_CUSTOM_PARTIALS: defineCapability({
    id: "render:handlebars:partials",
    description:
      "Allows provider-defined Handlebars partial injection during rendering.",
    requires: ["render:handlebars"],
    experimental: true,
  }),
  SANDBOX_BUN_SUBPROCESS: defineCapability({
    id: "sandbox:bun-subprocess",
    description:
      "Executes the provider inside a managed Bun subprocess sandbox.",
  }),
  SANDBOX_IN_PROCESS: defineCapability({
    id: "sandbox:in-process",
    description:
      "Runs the provider inside the orchestrator process without sandboxing.",
    experimental: true,
  }),
  OUTPUT_FILESYSTEM: defineCapability({
    id: "output:filesystem",
    description:
      "Writes compiled artifacts to filesystem destinations resolved by the orchestrator.",
  }),
  OUTPUT_SECTIONS: defineCapability({
    id: "output:sections",
    description:
      "Emits section-indexed output for downstream consumers instead of a single file.",
    experimental: true,
  }),
  DIAGNOSTICS_STRUCTURED: defineCapability({
    id: "diagnostics:structured",
    description:
      "Emits structured diagnostics with source locations and severity metadata.",
  }),
  TELEMETRY_EVENTS: defineCapability({
    id: "telemetry:events",
    description:
      "Emits telemetry events back to orchestrator instrumentation hooks.",
    experimental: true,
  }),
  WATCH_INCREMENTAL: defineCapability({
    id: "watch:incremental",
    description:
      "Supports incremental recompilation and watch negotiation with the orchestrator.",
    experimental: true,
  }),
} as const;

const RULESET_CAPABILITY_ENTRIES = Object.values(RULESET_CAPABILITIES).map(
  (capability) => [capability.id, capability] as const
);

const RULESET_CAPABILITY_REGISTRY_INTERNAL = new Map<
  RulesetCapabilityId,
  CapabilityDescriptor
>(RULESET_CAPABILITY_ENTRIES);

const RULESET_CAPABILITY_LIST = Object.freeze(
  Array.from(RULESET_CAPABILITY_REGISTRY_INTERNAL.values())
) as readonly CapabilityDescriptor[];

export const RULESET_CAPABILITY_REGISTRY: ReadonlyMap<
  RulesetCapabilityId,
  CapabilityDescriptor
> = RULESET_CAPABILITY_REGISTRY_INTERNAL;

export const listRulesetCapabilities = (): readonly CapabilityDescriptor[] =>
  RULESET_CAPABILITY_LIST;

export const getRulesetCapability = (
  id: RulesetCapabilityId
): CapabilityDescriptor | undefined =>
  RULESET_CAPABILITY_REGISTRY_INTERNAL.get(id);

export const isKnownRulesetCapability = (
  id: string
): id is RulesetCapabilityId =>
  RULESET_CAPABILITY_REGISTRY_INTERNAL.has(id as RulesetCapabilityId);

export const resolveRulesetCapabilities = (
  ids: readonly string[]
): readonly CapabilityDescriptor[] =>
  Object.freeze(
    ids.flatMap((id) => {
      const capability = RULESET_CAPABILITY_REGISTRY_INTERNAL.get(
        id as RulesetCapabilityId
      );
      return capability ? [capability] : [];
    })
  );

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const RULESET_LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export type RulesetLogLevel = (typeof RULESET_LOG_LEVELS)[number];

export type RulesetProviderPriority = "low" | "medium" | "high";

export type RulesetProjectLogFormat = "pretty" | "json";

export const RULESET_SCHEMA_BASE_URL = "https://ruleset.md/schema" as const;

export const RULESET_SCHEMA_IDS = {
  ruleFrontmatter: `${RULESET_SCHEMA_BASE_URL}/rule-frontmatter.json`,
  frontmatter: `${RULESET_SCHEMA_BASE_URL}/frontmatter.json`,
  providerConfig: `${RULESET_SCHEMA_BASE_URL}/provider-config.json`,
  projectConfig: `${RULESET_SCHEMA_BASE_URL}/project-config.json`,
} as const;

const JSON_SCHEMA_DRAFT_URL =
  "https://json-schema.org/draft/2020-12/schema" as const;

type JsonSchemaWithMeta = JsonSchema7Type & {
  $id?: string;
  $schema?: string;
};

const attachSchemaMetadata = (schema: JsonSchema7Type, id: string): void => {
  const target = schema as JsonSchemaWithMeta;
  target.$id = id;
  target.$schema = JSON_SCHEMA_DRAFT_URL;
};

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
);

const stringArraySchema = z.array(z.string().min(1));

const rulesetVersionSchema = z
  .string()
  .regex(SEMVER_PATTERN, {
    message: "Must be a semantic version (e.g., 0.4.0)",
  })
  .transform((value) => value as RulesetVersionTag);

const rulesetProviderHandlebarsSchema = z
  .object({
    force: z.boolean().optional(),
    strict: z.boolean().optional(),
    noEscape: z.boolean().optional(),
    partials: z.record(z.string()).optional(),
    helpers: stringArraySchema.optional(),
    projectConfigOverrides: z.record(jsonValueSchema).optional(),
  })
  .catchall(jsonValueSchema);

export const rulesetRuleFrontmatterSchema = z
  .object({
    version: rulesetVersionSchema.optional(),
    template: z.boolean().optional(),
    globs: stringArraySchema.optional(),
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    handlebars: z
      .union([z.boolean(), rulesetProviderHandlebarsSchema])
      .optional(),
  })
  .catchall(jsonValueSchema);

export const rulesetFrontmatterSchema = z
  .object({
    rule: rulesetRuleFrontmatterSchema.optional(),
  })
  .catchall(jsonValueSchema);

const rulesetSourceConfigSchema = z
  .object({
    path: z.string().min(1),
    globs: stringArraySchema.optional(),
    template: z.boolean().optional(),
  })
  .catchall(jsonValueSchema);

const rulesetSourceEntrySchema = z.union([
  z.string().min(1),
  rulesetSourceConfigSchema,
]);

export const rulesetProviderConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    outputPath: z.string().min(1).optional(),
    format: z.string().min(1).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    section: z.string().min(1).optional(),
    providers: stringArraySchema.optional(),
    config: z.record(jsonValueSchema).optional(),
    handlebars: z
      .union([z.boolean(), rulesetProviderHandlebarsSchema])
      .optional(),
  })
  .catchall(jsonValueSchema);

const rulesetProjectPathsSchema = z
  .object({
    partials: z.string().min(1).optional(),
    templates: z.string().min(1).optional(),
    cache: z.string().min(1).optional(),
  })
  .catchall(jsonValueSchema);

const rulesetProjectBuildSchema = z
  .object({
    parallel: z.boolean().optional(),
    maxConcurrency: z.number().int().positive().optional(),
    cache: z.boolean().optional(),
  })
  .catchall(jsonValueSchema);

const rulesetProjectLintSchema = z
  .object({
    strict: z.boolean().optional(),
    rules: z.record(jsonValueSchema).optional(),
  })
  .catchall(jsonValueSchema);

const rulesetProjectLogSchema = z
  .object({
    level: z.enum(RULESET_LOG_LEVELS).optional(),
    format: z.enum(["pretty", "json"]).optional(),
    file: z.string().min(1).optional(),
  })
  .catchall(jsonValueSchema);

export const rulesetProjectConfigSchema = z
  .object({
    version: rulesetVersionSchema.optional(),
    extends: stringArraySchema.optional(),
    sources: z.array(rulesetSourceEntrySchema).optional(),
    output: z.string().min(1).optional(),
    rule: rulesetRuleFrontmatterSchema.optional(),
    providers: z.record(rulesetProviderConfigSchema).optional(),
    paths: rulesetProjectPathsSchema.optional(),
    build: rulesetProjectBuildSchema.optional(),
    lint: rulesetProjectLintSchema.optional(),
    log: rulesetProjectLogSchema.optional(),
    env: z.record(z.string()).optional(),
  })
  .catchall(jsonValueSchema);

export type RulesetProviderHandlebarsConfig = z.infer<
  typeof rulesetProviderHandlebarsSchema
>;
export type RulesetRuleFrontmatter = z.infer<
  typeof rulesetRuleFrontmatterSchema
>;
export type RulesetFrontmatter = z.infer<typeof rulesetFrontmatterSchema>;
export type RulesetSourceConfig = z.infer<typeof rulesetSourceConfigSchema>;
export type RulesetSourceEntry = z.infer<typeof rulesetSourceEntrySchema>;
export type RulesetProviderConfig = z.infer<typeof rulesetProviderConfigSchema>;
export type RulesetProjectPathsConfig = z.infer<
  typeof rulesetProjectPathsSchema
>;
export type RulesetProjectBuildConfig = z.infer<
  typeof rulesetProjectBuildSchema
>;
export type RulesetProjectLintConfig = z.infer<typeof rulesetProjectLintSchema>;
export type RulesetProjectLogConfig = z.infer<typeof rulesetProjectLogSchema>;
export type RulesetProjectConfig = z.infer<typeof rulesetProjectConfigSchema>;

export const rulesetRuleFrontmatterJsonSchema: JsonSchema7Type =
  zodToJsonSchema(rulesetRuleFrontmatterSchema, "RulesetRuleFrontmatter");

export const rulesetFrontmatterJsonSchema: JsonSchema7Type = zodToJsonSchema(
  rulesetFrontmatterSchema,
  "RulesetFrontmatter"
);

export const rulesetProviderConfigJsonSchema: JsonSchema7Type = zodToJsonSchema(
  rulesetProviderConfigSchema,
  "RulesetProviderConfig"
);

export const rulesetProjectConfigJsonSchema: JsonSchema7Type = zodToJsonSchema(
  rulesetProjectConfigSchema,
  "RulesetProjectConfig"
);

attachSchemaMetadata(
  rulesetRuleFrontmatterJsonSchema,
  RULESET_SCHEMA_IDS.ruleFrontmatter
);
attachSchemaMetadata(
  rulesetFrontmatterJsonSchema,
  RULESET_SCHEMA_IDS.frontmatter
);
attachSchemaMetadata(
  rulesetProviderConfigJsonSchema,
  RULESET_SCHEMA_IDS.providerConfig
);
attachSchemaMetadata(
  rulesetProjectConfigJsonSchema,
  RULESET_SCHEMA_IDS.projectConfig
);

export const RULESET_SCHEMAS = {
  ruleFrontmatter: rulesetRuleFrontmatterJsonSchema,
  frontmatter: rulesetFrontmatterJsonSchema,
  providerConfig: rulesetProviderConfigJsonSchema,
  projectConfig: rulesetProjectConfigJsonSchema,
} as const;

export type RulesetSchemaName = keyof typeof RULESET_SCHEMAS;

export const getRulesetSchema = (name: RulesetSchemaName): JsonSchema7Type =>
  RULESET_SCHEMAS[name];
