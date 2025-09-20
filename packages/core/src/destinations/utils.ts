import type { HelperDelegate } from 'handlebars';
import type {
  DestinationCompilationOptions,
  Logger,
  ParsedDoc,
} from '../interfaces';

export type UnknownRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const HANDLEBARS_PARTIAL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function isValidPartialName(name: string): boolean {
  return HANDLEBARS_PARTIAL_NAME_PATTERN.test(name);
}

function addAdditionalPartials(
  target: Map<string, string>,
  additional: Record<string, string> | undefined
): void {
  if (!additional) {
    return;
  }

  for (const [name, template] of Object.entries(additional)) {
    if (typeof template === 'string' && template.trim().length > 0) {
      target.set(name, template);
    }
  }
}

function addConfiguredPartials(
  target: Map<string, string>,
  partialsConfig: unknown,
  destinationId: string,
  logger: Logger
): void {
  if (partialsConfig === undefined) {
    return;
  }

  if (!isPlainObject(partialsConfig)) {
    logger.warn('Ignoring non-object Handlebars partials configuration', {
      destination: destinationId,
    });
    return;
  }

  for (const [name, template] of Object.entries(
    partialsConfig as UnknownRecord
  )) {
    if (!isValidPartialName(name)) {
      logger.warn('Invalid Handlebars partial name, skipping entry', {
        destination: destinationId,
        partial: name,
      });
      continue;
    }

    if (typeof template === 'string' && template.trim().length > 0) {
      target.set(name, template);
    } else if (template !== undefined) {
      logger.warn('Ignoring non-string Handlebars partial', {
        destination: destinationId,
        partial: name,
      });
    }
  }
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

  const destinationConfig = destinations[destinationId];
  return isPlainObject(destinationConfig) ? destinationConfig : undefined;
}

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
    logger,
    helpers,
    additionalPartials,
  } = opts;

  if (!isPlainObject(destinationConfig)) {
    return;
  }

  const config = destinationConfig.handlebars;
  if (config === undefined) {
    return;
  }

  if (config === true) {
    const fromAdditional =
      additionalPartials && Object.keys(additionalPartials).length > 0
        ? additionalPartials
        : undefined;
    return {
      handlebars: {
        force: true,
        helpers,
        partials: fromAdditional,
      },
    };
  }

  if (!isPlainObject(config)) {
    logger.warn('Ignoring invalid Handlebars configuration', {
      destination: destinationId,
      value: config,
    });
    return;
  }

  const partials = new Map<string, string>();
  addAdditionalPartials(partials, additionalPartials);
  addConfiguredPartials(partials, config.partials, destinationId, logger);

  const force = config.force === true || config.enabled === true;
  const gatheredHelpers =
    helpers && Object.keys(helpers).length > 0 ? helpers : undefined;
  const gatheredPartials =
    partials.size > 0 ? Object.fromEntries(partials.entries()) : undefined;

  if (!(force || gatheredHelpers || gatheredPartials)) {
    return;
  }

  return {
    handlebars: {
      force: force || undefined,
      helpers: gatheredHelpers,
      partials: gatheredPartials,
    },
  };
}
