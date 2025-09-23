import type { HelperDelegate } from 'handlebars';
import type { JSONSchema7 } from 'json-schema';
import type { CompiledDoc, ParsedDoc } from './compiled-doc';
import type { Logger } from './logger';

export type DestinationHandlebarsOptions = {
  /** Force Handlebars compilation even if the project/frontmatter does not opt in. */
  force?: boolean;
  /** Helper map to register before rendering. */
  helpers?: Record<string, HelperDelegate>;
  /** Partials to register before rendering. */
  partials?: Record<string, string>;
  /** Toggle Handlebars strict mode (defaults to true). */
  strict?: boolean;
  /** Toggle escaping (defaults to true). */
  noEscape?: boolean;
};

export type DestinationCompilationOptions = {
  /** Destination-specific Handlebars configuration overrides. */
  handlebars?: DestinationHandlebarsOptions;
  /** Optional project-level configuration overrides to merge for this compilation. */
  projectConfigOverrides?: Record<string, unknown>;
};

export type { JSONSchema7 } from 'json-schema';

export type DestinationProvider = {
  /**
   * Canonical ID for the destination provider.
   * Should be unique, kebab-case. e.g., "cursor", "windsurf".
   */
  get name(): string;

  /**
   * Returns a JSON schema describing the configuration options specific to this provider.
   * This schema is used for validating provider configuration.
   */
  configSchema(): JSONSchema7;

  /**
   * Gives the provider a chance to customize compilation before any destination-specific
   * transforms run. Useful for registering Handlebars helpers/partials or tweaking
   * project-level configuration.
   */
  prepareCompilation?(ctx: {
    parsed: ParsedDoc;
    projectConfig: Record<string, unknown>;
    logger: Logger;
  }): Promise<DestinationCompilationOptions | undefined> |
    DestinationCompilationOptions |
    undefined;

  /**
   * Writes the compiled document to the destination.
   * Providers own any final transformations needed before writing.
   *
   * @param ctx - The context object for the write operation.
   * @param ctx.compiled - The compiled document to write.
   * @param ctx.destPath - The target file path or directory for the output.
   * @param ctx.config - The validated provider-specific configuration.
   * @param ctx.logger - A logger instance for outputting messages.
   * @returns A promise that resolves when the write operation is complete.
  */
  write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>; // Validated via schema from configSchema()
    logger: Logger;
  }): Promise<void>;
};
