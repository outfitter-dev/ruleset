import type { HelperDelegate } from 'handlebars';
import type {
  DestinationCompilationOptions,
  Logger,
  ParsedDoc,
} from '../interfaces';

export type UnknownRecord = Record<string, unknown>;

type HandlebarsConfigShape = {
  force?: unknown;
  enabled?: unknown;
  partials?: unknown;
  projectConfigOverrides?: unknown;
};

const HANDLEBARS_PARTIAL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function isValidHandlebarsPartialName(name: string): boolean {
  return HANDLEBARS_PARTIAL_NAME_PATTERN.test(name);
}

export function isPlainObject(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readDestinationConfig(
  parsed: ParsedDoc,
  destinationId: string
): UnknownRecord | undefined {
  const frontmatter = parsed.source.frontmatter;
  if (!isPlainObject(frontmatter)) {
    return;
  }

  const destinations = frontmatter.destinations;
  if (!isPlainObject(destinations)) {
    return;
  }

  const config = destinations[destinationId];
  if (!isPlainObject(config)) {
    return;
  }

  return config;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handlebars option parsing requires multiple validation branches.
export function buildHandlebarsOptions(opts: {
  destinationId: string;
  destinationConfig?: UnknownRecord;
  logger: Logger;
  helpers?: Record<string, HelperDelegate>;
  additionalPartials?: Record<string, string>;
}): DestinationCompilationOptions | undefined {
  const {
    destinationId,
    destinationConfig,
    helpers,
    additionalPartials,
    logger,
  } = opts;

  const rawHandlebarsConfig = destinationConfig?.handlebars;

  if (rawHandlebarsConfig === true) {
    const partialsFromAdditional =
      additionalPartials && Object.keys(additionalPartials).length > 0
        ? additionalPartials
        : undefined;

    return {
      handlebars: {
        force: true,
        helpers,
        partials: partialsFromAdditional,
      },
    };
  }

  if (
    rawHandlebarsConfig !== undefined &&
    !isPlainObject(rawHandlebarsConfig)
  ) {
    logger.warn('Ignoring invalid Handlebars configuration', {
      destination: destinationId,
      value: rawHandlebarsConfig,
    });
    return;
  }

  const handlebarsConfig = rawHandlebarsConfig as
    | HandlebarsConfigShape
    | undefined;

  const partials = new Map<string, string>();
  if (additionalPartials) {
    for (const [name, template] of Object.entries(additionalPartials)) {
      if (typeof template === 'string' && template.trim().length > 0) {
        partials.set(name, template);
      }
    }
  }

  if (isPlainObject(handlebarsConfig?.partials)) {
    const partialRecords = handlebarsConfig.partials as UnknownRecord;
    for (const [name, template] of Object.entries(partialRecords)) {
      if (!isValidHandlebarsPartialName(name)) {
        logger.warn('Invalid Handlebars partial name, skipping entry', {
          destination: destinationId,
          partial: name,
        });
        continue;
      }
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

  const force =
    handlebarsConfig?.force === true || handlebarsConfig?.enabled === true;
  const projectConfigOverrides = isPlainObject(
    handlebarsConfig?.projectConfigOverrides
  )
    ? (handlebarsConfig.projectConfigOverrides as UnknownRecord)
    : undefined;

  const helperEntries =
    helpers && Object.keys(helpers).length > 0 ? helpers : undefined;
  const partialsObject =
    partials.size > 0 ? Object.fromEntries(partials) : undefined;

  const hasHandlebarsOptions = force || helperEntries || partialsObject;
  const hasOverrides = Boolean(projectConfigOverrides);

  if (!(hasHandlebarsOptions || hasOverrides)) {
    return;
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
