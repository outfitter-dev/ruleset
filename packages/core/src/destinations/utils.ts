import type { HelperDelegate } from 'handlebars';
import type {
  DestinationCompilationOptions,
  Logger,
  ParsedDoc,
} from '../interfaces';

export type UnknownRecord = Record<string, unknown>;

export function isPlainObject(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readDestinationConfig(
  parsed: ParsedDoc,
  destinationId: string
): UnknownRecord | undefined {
  const frontmatter = parsed.source.frontmatter;
  if (!isPlainObject(frontmatter)) {
    return undefined;
  }

  const destinations = frontmatter.destinations;
  if (!isPlainObject(destinations)) {
    return undefined;
  }

  const config = destinations[destinationId];
  if (!isPlainObject(config)) {
    return undefined;
  }

  return config;
}

export function buildHandlebarsOptions(opts: {
  destinationId: string;
  destinationConfig?: UnknownRecord;
  logger: Logger;
  helpers?: Record<string, HelperDelegate>;
  additionalPartials?: Record<string, string>;
}): DestinationCompilationOptions | undefined {
  const { destinationId, destinationConfig, helpers, additionalPartials, logger } = opts;

  const handlebarsConfig = isPlainObject(destinationConfig?.handlebars)
    ? (destinationConfig?.handlebars as UnknownRecord)
    : undefined;

  const partials = new Map<string, string>();
  if (additionalPartials) {
    for (const [name, template] of Object.entries(additionalPartials)) {
      if (typeof template === 'string' && template.trim().length > 0) {
        partials.set(name, template);
      }
    }
  }

  if (isPlainObject(handlebarsConfig?.partials)) {
    for (const [name, template] of Object.entries(
      handlebarsConfig.partials as UnknownRecord
    )) {
      if (typeof template === 'string' && template.trim().length > 0) {
        partials.set(name, template);
      } else if (template !== undefined) {
        logger.warn('Ignoring non-string Handlebars partial', {
          destination: destinationId,
          partial: name,
        });
      }
    }
  }

  const force = handlebarsConfig?.force === true;
  const projectConfigOverrides = isPlainObject(
    handlebarsConfig?.projectConfigOverrides
  )
    ? (handlebarsConfig?.projectConfigOverrides as UnknownRecord)
    : undefined;

  const helperEntries = helpers && Object.keys(helpers).length > 0 ? helpers : undefined;
  const partialsObject = partials.size > 0 ? Object.fromEntries(partials) : undefined;

  const hasHandlebarsOptions = force || helperEntries || partialsObject;
  const hasOverrides = Boolean(projectConfigOverrides);

  if (!hasHandlebarsOptions && !hasOverrides) {
    return undefined;
  }

  return {
    handlebars: hasHandlebarsOptions
      ? {
          force: force || undefined,
          helpers: helperEntries,
          partials: partialsObject,
        }
      : undefined,
    projectConfigOverrides,
  };
}
