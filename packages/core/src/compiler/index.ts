import { isPlainObject, resolveProviderSettings } from "@rulesets/providers";
import type { JsonValue } from "@rulesets/types";
import type { HelperDelegate } from "handlebars";
import type { CompiledDoc, ParsedDoc } from "../interfaces";
import type { Logger } from "../interfaces/logger";
import { extractBodyFromContent } from "../utils/frontmatter";
import { HandlebarsRulesetCompiler } from "./handlebars-compiler";

export { HandlebarsRulesetCompiler };

const handlebarsCompiler = new HandlebarsRulesetCompiler();

function prefersHandlebars(
  frontmatter: Record<string, unknown> | undefined,
  projectConfig: Record<string, unknown>
): boolean {
  const ruleValue = frontmatter?.rule;
  const rule =
    ruleValue && typeof ruleValue === "object" && !Array.isArray(ruleValue)
      ? (ruleValue as Record<string, unknown>)
      : undefined;
  const frontmatterTemplate =
    typeof rule?.template === "boolean"
      ? (rule.template as boolean)
      : undefined;
  if (frontmatterTemplate !== undefined) {
    return frontmatterTemplate;
  }

  const projectRuleValue = projectConfig.rule;
  const projectRule =
    projectRuleValue &&
    typeof projectRuleValue === "object" &&
    !Array.isArray(projectRuleValue)
      ? (projectRuleValue as Record<string, unknown>)
      : undefined;
  const projectTemplate =
    typeof projectRule?.template === "boolean"
      ? (projectRule.template as boolean)
      : undefined;
  if (projectTemplate !== undefined) {
    return projectTemplate;
  }

  const rulesets = frontmatter?.rulesets as Record<string, unknown> | undefined;
  if (
    typeof rulesets?.compiler === "string" &&
    rulesets.compiler === "handlebars"
  ) {
    return true;
  }

  const projectCompiler = projectConfig.compiler;
  if (typeof projectCompiler === "string" && projectCompiler === "handlebars") {
    return true;
  }

  return false;
}

export type CompileOptions = {
  projectConfig?: Record<string, unknown>;
  logger?: Logger;
  handlebars?: {
    force?: boolean;
    helpers?: Record<string, HelperDelegate>;
    partials?: Record<string, string>;
    strict?: boolean;
    noEscape?: boolean;
  };
  providerInfo?: {
    id: string;
    name?: string;
  };
  registryInfo?: {
    destinations: string[];
  };
};

/**
 * Creates a minimal compiled document for empty files.
 *
 * @param source - Source document information
 * @param destinationId - Target destination ID
 * @param projectConfig - Project configuration
 * @returns Minimal CompiledDoc structure for empty content
 */
function toJsonRecord(
  record: Record<string, unknown>
): Record<string, JsonValue> {
  return record as Record<string, JsonValue>;
}

function createEmptyCompiledDoc(
  source: ParsedDoc["source"],
  destinationId: string,
  projectConfig: Record<string, unknown>
): CompiledDoc {
  return {
    source: {
      path: source.path,
      content: source.content,
      frontmatter: source.frontmatter,
    },
    ast: {
      sections: [],
      imports: [],
      variables: [],
      markers: [],
    },
    output: {
      content: "",
      metadata: toJsonRecord({}),
    },
    context: createCompilationContext(
      destinationId,
      projectConfig,
      source.frontmatter
    ),
  };
}

/**
 * Creates metadata object from frontmatter and destination-specific config.
 *
 * @param frontmatter - Parsed frontmatter
 * @param destinationId - Target destination ID
 * @returns Compiled metadata object with all pass-through fields
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy metadata mapping scheduled for refactor
function createOutputMetadata(
  frontmatter: Record<string, unknown> | undefined,
  destinationId: string
): Record<string, JsonValue> {
  const providerFrontmatter = isPlainObject(frontmatter)
    ? (frontmatter as Record<string, JsonValue>)
    : undefined;

  const allMetadata = providerFrontmatter ? { ...providerFrontmatter } : {};

  // Extract structured rule fields
  let ruleVersion: string | undefined;
  let ruleGlobs: string[] | undefined;

  if (providerFrontmatter) {
    const ruleValue = providerFrontmatter.rule;
    if (ruleValue && isPlainObject(ruleValue)) {
      const rule = ruleValue as Record<string, unknown>;

      // Extract version
      if (typeof rule.version === "string" && rule.version.trim().length > 0) {
        ruleVersion = rule.version;
      }

      // Extract globs
      if (Array.isArray(rule.globs)) {
        ruleGlobs = rule.globs
          .filter(
            (g): g is string => typeof g === "string" && g.trim().length > 0
          )
          .map((g) => g.trim());
      }
    }
  }

  // Apply structured field overrides for consistent access
  const structuredMetadata = {
    title: allMetadata.title,
    description: allMetadata.description,
    version: ruleVersion ?? allMetadata.version,
    created: allMetadata.created,
    updated: allMetadata.updated,
    labels: allMetadata.labels,
    ...(ruleGlobs && { "rule.globs": ruleGlobs }),
  };

  // Include destination-specific metadata if available
  const destinationSettings = resolveProviderSettings(
    providerFrontmatter,
    destinationId
  );
  const destinationMetadata = destinationSettings?.config ?? {};

  return toJsonRecord({
    ...allMetadata, // All original frontmatter (pass-through)
    ...structuredMetadata, // Structured field overrides
    ...destinationMetadata, // Destination-specific overrides
  });
}

/**
 * Creates compilation context with merged configuration.
 *
 * @param destinationId - Target destination ID
 * @param projectConfig - Project-level configuration
 * @param frontmatter - Parsed frontmatter
 * @returns Compilation context object
 */
function createCompilationContext(
  destinationId: string,
  projectConfig: Record<string, unknown>,
  frontmatter: Record<string, unknown> | undefined
): CompiledDoc["context"] {
  const providerFrontmatter = isPlainObject(frontmatter)
    ? (frontmatter as Record<string, JsonValue>)
    : undefined;

  const destinationSettings = resolveProviderSettings(
    providerFrontmatter,
    destinationId
  );
  const destinationConfig = destinationSettings?.config ?? {};

  return {
    destinationId,
    config: toJsonRecord({
      ...projectConfig,
      ...destinationConfig,
    }),
  };
}

/**
 * Compiles a parsed Rulesets document for a specific destination.
 * For v0.1.0, this is a pass-through implementation that doesn't process markers.
 *
 * @param parsedDoc - The parsed document to compile
 * @param destinationId - The ID of the destination to compile for
 * @param projectConfig - Optional project configuration
 * @returns A promise that resolves to a CompiledDoc
 */
export function compile(
  parsedDoc: ParsedDoc,
  destinationId: string,
  projectConfig: Record<string, unknown> = {},
  options: CompileOptions = {}
): CompiledDoc {
  const { source, ast } = parsedDoc;
  const { logger, handlebars } = options;
  const effectiveProjectConfig = options.projectConfig ?? projectConfig;

  // Handle empty files consistently
  if (!source.content.trim()) {
    return createEmptyCompiledDoc(
      source,
      destinationId,
      effectiveProjectConfig
    );
  }

  // Extract the body content (everything after frontmatter)
  const bodyContent = extractBodyFromContent(source.content, {
    hasFrontmatter: Boolean(source.frontmatter),
    trim: true,
  });

  // Build the compiled document
  const shouldUseHandlebars =
    prefersHandlebars(source.frontmatter, effectiveProjectConfig) ||
    Boolean(handlebars?.force);

  if (shouldUseHandlebars) {
    const compiled = handlebarsCompiler.compile(parsedDoc, destinationId, {
      logger,
      projectConfig: effectiveProjectConfig,
      helpers: handlebars?.helpers,
      partials: handlebars?.partials,
      strict: handlebars?.strict,
      noEscape: handlebars?.noEscape,
      providerInfo: options.providerInfo,
      registryInfo: options.registryInfo,
    });
    return compiled;
  }

  const compiledDoc: CompiledDoc = {
    source: {
      path: source.path,
      content: source.content,
      frontmatter: source.frontmatter,
    },
    ast: {
      sections: ast.sections, // Pass through from parser (empty for v0)
      imports: ast.imports, // Pass through from parser (empty for v0)
      variables: ast.variables, // Pass through from parser (empty for v0)
      markers: ast.markers, // Pass through from parser (empty for v0)
    },
    output: {
      content: bodyContent, // Raw body content for v0
      metadata: createOutputMetadata(source.frontmatter, destinationId),
    },
    context: createCompilationContext(
      destinationId,
      effectiveProjectConfig,
      source.frontmatter
    ),
  };

  logger?.debug?.(
    `Compiled ${source.path ?? "inline document"} for ${destinationId}`,
    { destination: destinationId, file: source.path }
  );
  return compiledDoc;
}
