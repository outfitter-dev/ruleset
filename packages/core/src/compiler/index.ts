import type { HelperDelegate } from 'handlebars';
import { HandlebarsRulesetCompiler } from './handlebars-compiler';
import type { CompiledDoc, ParsedDoc } from '../interfaces';
import type { Logger } from '../interfaces/logger';
import { extractBodyFromContent } from '../utils/frontmatter';

export { HandlebarsRulesetCompiler } from './handlebars-compiler';

export { HandlebarsRulesetCompiler } from './handlebars-compiler';

const handlebarsCompiler = new HandlebarsRulesetCompiler();

function prefersHandlebars(
  frontmatter: Record<string, unknown> | undefined,
  projectConfig: Record<string, unknown>
): boolean {
  const rulesets = frontmatter?.rulesets as Record<string, unknown> | undefined;
  const frontmatterPref = typeof rulesets?.compiler === 'string' ? rulesets.compiler : undefined;
  const projectPref = typeof projectConfig?.compiler === 'string' ? projectConfig.compiler : undefined;
  return frontmatterPref === 'handlebars' || projectPref === 'handlebars';
}

export interface CompileOptions {
  projectConfig?: Record<string, unknown>;
  logger?: Logger;
  handlebars?: {
    force?: boolean;
    helpers?: Record<string, HelperDelegate>;
    partials?: Record<string, string>;
    strict?: boolean;
    noEscape?: boolean;
  };
}

/**
 * Creates a minimal compiled document for empty files.
 *
 * @param source - Source document information
 * @param destinationId - Target destination ID
 * @param projectConfig - Project configuration
 * @returns Minimal CompiledDoc structure for empty content
 */
function createEmptyCompiledDoc(
  source: ParsedDoc['source'],
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
      content: '',
      metadata: {},
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
 * @returns Compiled metadata object
 */
function createOutputMetadata(
  frontmatter: Record<string, unknown> | undefined,
  destinationId: string
): Record<string, unknown> {
  const baseMetadata = {
    title: frontmatter?.title,
    description: frontmatter?.description,
    version: frontmatter?.version,
  };

  // Include destination-specific metadata if available
  const destinations = frontmatter?.destinations as
    | Record<string, unknown>
    | undefined;
  const destinationMetadata =
    (destinations?.[destinationId] as Record<string, unknown> | undefined) ||
    {};

  return {
    ...baseMetadata,
    ...destinationMetadata,
  };
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
): CompiledDoc['context'] {
  const destinations = frontmatter?.destinations as
    | Record<string, unknown>
    | undefined;
  const destinationConfig =
    (destinations?.[destinationId] as Record<string, unknown> | undefined) ||
    {};

  return {
    destinationId,
    config: {
      ...projectConfig,
      ...destinationConfig,
    },
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
    return createEmptyCompiledDoc(source, destinationId, effectiveProjectConfig);
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
    `Compiled ${source.path ?? 'inline document'} for ${destinationId}`,
    { destination: destinationId, file: source.path }
  );
  return compiledDoc;
}
