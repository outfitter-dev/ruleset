import { promises as fs } from 'node:fs';
import { compile } from './compiler';
import { destinations } from './destinations';
import type { CompiledDoc, Logger, ParsedDoc } from './interfaces';
import { ConsoleLogger } from './interfaces';
import { type LinterConfig, type LintResult, lint } from './linter';
import { parse } from './parser';

export { compile, compile as Compiler } from './compiler';
export { GlobalConfig } from './config/global-config';
export {
  DESTINATION_IDS,
  FILE_EXTENSIONS,
  RESOURCE_LIMITS,
} from './config/limits';
export {
  destinations,
  destinations as DestinationPluginRegistry,
} from './destinations';
export { ClaudeCodePlugin } from './destinations/claude-code-plugin';
export { CursorPlugin } from './destinations/cursor-plugin';
export { WindsurfPlugin } from './destinations/windsurf-plugin';
export { InstallationManager } from './installation/installation-manager';
// Export all public APIs
export * from './interfaces';
export { type LinterConfig, type LintResult, lint } from './linter';
export { parse, parse as Parser } from './parser';
export { RulesetManager } from './rulesets/ruleset-manager';
export * from './utils/security';

/**
 * Reads a source file from disk.
 *
 * @param sourceFilePath - Path to the source file
 * @param logger - Logger instance for reporting
 * @returns Promise resolving to file content
 * @throws Error if file cannot be read
 */
async function readSourceFile(
  sourceFilePath: string,
  logger: Logger
): Promise<string> {
  try {
    const content = await fs.readFile(sourceFilePath, 'utf-8');
    logger.debug(`Read ${content.length} characters from ${sourceFilePath}`);
    return content;
  } catch (error) {
    logger.error(`Failed to read source file: ${sourceFilePath}`, error);
    throw error;
  }
}

/**
 * Parses source content into a ParsedDoc structure.
 *
 * @param content - Raw source content
 * @param sourceFilePath - Original file path for metadata
 * @param logger - Logger instance for reporting
 * @returns Promise resolving to parsed document
 * @throws Error if parsing fails
 */
function parseSourceContent(
  content: string,
  sourceFilePath: string,
  logger: Logger
): ParsedDoc {
  logger.info('Parsing source file...');

  try {
    const parsedDoc = parse(content);
    parsedDoc.source.path = sourceFilePath;

    if (parsedDoc.errors && parsedDoc.errors.length > 0) {
      logger.warn(`Parser found ${parsedDoc.errors.length} error(s)`);
    }

    return parsedDoc;
  } catch (error) {
    logger.error('Failed to parse source file', error);
    throw error;
  }
}

/**
 * Lints a parsed document and reports results.
 *
 * @param parsedDoc - The document to lint
 * @param logger - Logger instance for reporting
 * @param linterConfig - Optional linter configuration overrides
 * @param failOnError - Whether to throw error on linting failures (default: true)
 * @returns Promise resolving to lint results
 * @throws Error if linting finds errors or fails
 */
function lintParsedDocument(
  parsedDoc: ParsedDoc,
  logger: Logger,
  linterConfig: Partial<LinterConfig> = {},
  failOnError = true
): LintResult[] {
  logger.info('Linting document...');

  try {
    const baseConfig: LinterConfig = {
      requireRulesetsVersion: true,
      allowedDestinations: Array.from(destinations.keys()),
    };
    const config = { ...baseConfig, ...linterConfig };
    const lintResults = lint(parsedDoc, config);

    const hasErrors = processLintResults(lintResults, logger);

    if (hasErrors) {
      if (failOnError) {
        throw new Error(
          'Linting failed with errors. Please fix the issues and try again.'
        );
      }
      logger.warn('Linting found errors; continuing (failOnError=false).');
    }

    return lintResults;
  } catch (error) {
    logger.error('Failed during linting', error);
    throw error;
  }
}

/**
 * Processes lint results and logs them appropriately.
 *
 * @param lintResults - Array of lint results to process
 * @param logger - Logger instance for reporting
 * @returns True if any errors were found, false otherwise
 */
function processLintResults(
  lintResults: LintResult[],
  logger: Logger
): boolean {
  let hasErrors = false;

  for (const result of lintResults) {
    const location = result.line ? ` (line ${result.line})` : '';
    const message = `${result.message}${location}`;

    switch (result.severity) {
      case 'error':
        logger.error(message);
        hasErrors = true;
        break;
      case 'warning':
        logger.warn(message);
        break;
      case 'info':
        logger.info(message);
        break;
      default:
        // Unknown severity level, treat as info
        logger.info(message);
        break;
    }
  }

  return hasErrors;
}

/**
 * Determines which destinations to compile for based on frontmatter.
 *
 * @param parsedDoc - The parsed document
 * @returns Array of destination IDs to compile for
 */
function determineDestinations(parsedDoc: ParsedDoc): string[] {
  const fm = (parsedDoc.source.frontmatter ?? {}) as Record<string, unknown>;
  const value = fm.destinations as unknown;

  // Support object mapping: { cursor: {...}, windsurf: {...} }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    // Support schema: { include: ["cursor", "windsurf"], ... }
    const include = obj.include as unknown;
    if (Array.isArray(include) && include.every((v) => typeof v === 'string')) {
      return include as string[];
    }
    const keys = Object.keys(obj);
    return keys.length > 0 ? keys : Array.from(destinations.keys());
  }

  // Simple array form is not supported in v0.1.0 – default to all destinations

  return Array.from(destinations.keys());
}

/**
 * Compiles a document for a specific destination.
 *
 * @param parsedDoc - The document to compile
 * @param destinationId - Target destination ID
 * @param projectConfig - Project configuration
 * @param logger - Logger instance for reporting
 * @returns Promise resolving to compiled document
 * @throws Error if compilation fails
 */
function compileForDestination(
  parsedDoc: ParsedDoc,
  destinationId: string,
  projectConfig: Record<string, unknown>,
  logger: Logger
): CompiledDoc {
  try {
    return compile(parsedDoc, destinationId, projectConfig);
  } catch (error) {
    logger.error(`Failed to compile for destination: ${destinationId}`, error);
    throw error;
  }
}

/**
 * Writes compiled document using the appropriate destination plugin.
 *
 * @param compiledDoc - The compiled document
 * @param destinationId - Target destination ID
 * @param frontmatter - Document frontmatter for configuration
 * @param logger - Logger instance for reporting
 * @returns Promise that resolves when writing completes
 * @throws Error if writing fails
 */
async function writeToDestination(
  compiledDoc: CompiledDoc,
  destinationId: string,
  frontmatter: Record<string, unknown>,
  logger: Logger
): Promise<void> {
  const plugin = destinations.get(destinationId);
  if (!plugin) {
    logger.warn(`No plugin found for destination: ${destinationId}`);
    return;
  }

  // Determine output path
  const frontmatterDestinations = frontmatter.destinations as
    | Record<string, unknown>
    | undefined;
  const destConfig =
    (frontmatterDestinations?.[destinationId] as
      | Record<string, unknown>
      | undefined) || {};
  const defaultPath = `.rulesets/dist/${destinationId}/my-rules.md`;
  const destPath =
    (destConfig.outputPath as string) ||
    (destConfig.path as string) ||
    defaultPath;

  // Write using the plugin
  try {
    await plugin.write({
      compiled: compiledDoc,
      destPath,
      config: destConfig,
      logger,
    });
  } catch (error) {
    logger.error(`Failed to write ${destinationId} output`, error);
    throw error;
  }
}

/**
 * Processes compilation and writing for all destinations.
 *
 * @param parsedDoc - The parsed document
 * @param destinationIds - Array of destination IDs to process
 * @param projectConfig - Project configuration
 * @param logger - Logger instance for reporting
 * @returns Promise that resolves when all destinations are processed
 */
async function processDestinations(
  parsedDoc: ParsedDoc,
  destinationIds: string[],
  projectConfig: Record<string, unknown>,
  logger: Logger
): Promise<void> {
  logger.info(`Compiling for destinations: ${destinationIds.join(', ')}`);

  const frontmatter = parsedDoc.source.frontmatter || {};

  for (const destinationId of destinationIds) {
    logger.info(`Processing destination: ${destinationId}`);

    // Compile for this destination
    const compiledDoc = compileForDestination(
      parsedDoc,
      destinationId,
      projectConfig,
      logger
    );

    // Write to destination
    await writeToDestination(compiledDoc, destinationId, frontmatter, logger);
  }
}

/**
 * Orchestrates the Rulesets v0.1.0 build process for a single file.
 * Reads, parses, lints, compiles, and writes to destinations.
 *
 * @example
 * ```typescript
 * import { runRulesetsV0 } from '@rulesets/core';
 * import { ConsoleLogger } from '@rulesets/core';
 *
 * async function main() {
 *   const logger = new ConsoleLogger();
 *   try {
 *     await runRulesetsV0('./my-rules.mix.md', logger);
 *     logger.info('Rulesets v0.1.0 process completed.');
 *   } catch (error) {
 *     logger.error('Rulesets v0.1.0 process failed:', error);
 *   }
 * }
 *
 * main();
 * ```
 *
 * @param sourceFilePath - The path to the source Rulesets file (e.g., my-rules.mix.md).
 * @param logger - An instance of the Logger interface.
 * @param projectConfig - Optional: The root Rulesets project configuration.
 * @returns A promise that resolves when the process is complete, or rejects on error.
 */
export async function runRulesetsV0(
  sourceFilePath: string,
  logger: Logger = new ConsoleLogger(),
  projectConfig: Record<string, unknown> = {}
): Promise<void> {
  logger.info(`Starting Rulesets v0.1.0 processing for: ${sourceFilePath}`);

  // Step 1: Read the source file
  const content = await readSourceFile(sourceFilePath, logger);

  // Step 2: Parse the content
  const parsedDoc = parseSourceContent(content, sourceFilePath, logger);

  // Step 3: Lint the parsed document
  type RunOptions = {
    linter?: Partial<LinterConfig>;
    failOnLintError?: boolean;
  };
  const opts = projectConfig as RunOptions;
  lintParsedDocument(
    parsedDoc,
    logger,
    opts.linter ?? {},
    opts.failOnLintError ?? true
  );

  // Step 4: Determine which destinations to compile for
  const destinationIds = determineDestinations(parsedDoc);

  // Step 5: Compile and write for each destination
  await processDestinations(parsedDoc, destinationIds, projectConfig, logger);

  logger.info('Rulesets v0.1.0 processing completed successfully!');
}
