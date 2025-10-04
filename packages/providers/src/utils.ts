import type { JsonValue, RulesetDocument } from "@ruleset/types";
import type { HelperDelegate } from "handlebars";
import type { DestinationCompilationOptions, ProviderLogger } from "./index";

export type UnknownRecord = Record<string, JsonValue | unknown>;

const HANDLEBARS_PARTIAL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export const isPlainObject = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isValidHandlebarsPartialName = (name: string): boolean =>
  HANDLEBARS_PARTIAL_NAME_PATTERN.test(name);

type HandlebarsConfigShape = {
  force?: unknown;
  enabled?: unknown;
  partials?: unknown;
  projectConfigOverrides?: unknown;
};

export type ProviderSettings = {
  readonly enabled?: boolean;
  readonly config?: Record<string, JsonValue>;
  readonly source: "provider";
};

const readSettingsFromValue = (
  value: unknown
): ProviderSettings | undefined => {
  if (typeof value === "boolean") {
    return {
      enabled: value,
      source: "provider",
    };
  }

  if (isPlainObject(value)) {
    const config = value as UnknownRecord;
    const enabledValue = config.enabled;
    const enabled =
      typeof enabledValue === "boolean" ? enabledValue : undefined;

    return {
      enabled,
      config: config as Record<string, JsonValue>,
      source: "provider",
    };
  }

  return;
};

export const resolveProviderSettings = (
  frontmatter: Record<string, JsonValue> | undefined,
  providerId: string
): ProviderSettings | undefined => {
  if (!frontmatter) {
    return;
  }

  const candidate = frontmatter[providerId];
  return readSettingsFromValue(candidate);
};

export const readProviderConfig = (
  document: RulesetDocument,
  providerId: string
): Record<string, JsonValue> | undefined => {
  const frontmatter = document.metadata.frontMatter;
  const settings = resolveProviderSettings(frontmatter, providerId);
  return settings?.config;
};

const collectAdditionalPartials = (
  additional: Record<string, string> | undefined
): Map<string, string> => {
  const partials = new Map<string, string>();
  if (!additional) {
    return partials;
  }

  for (const [name, template] of Object.entries(additional)) {
    if (typeof template === "string" && template.trim().length > 0) {
      partials.set(name, template);
    }
  }

  return partials;
};

const mergeConfiguredPartials = (
  destinationId: string,
  rawPartials: unknown,
  partials: Map<string, string>,
  logger: ProviderLogger
) => {
  if (!isPlainObject(rawPartials)) {
    return;
  }

  for (const [name, template] of Object.entries(rawPartials)) {
    if (!isValidHandlebarsPartialName(name)) {
      logger.warn("Invalid Handlebars partial name, skipping entry", {
        destination: destinationId,
        partial: name,
      });
      continue;
    }

    if (typeof template === "string" && template.trim().length > 0) {
      partials.set(name, template);
    } else if (template !== undefined) {
      logger.warn("Ignoring non-string Handlebars partial", {
        destination: destinationId,
        partial: name,
      });
    }
  }
};

const toJsonRecord = (
  value: Record<string, unknown> | undefined
): Record<string, JsonValue> | undefined =>
  value ? (value as Record<string, JsonValue>) : undefined;

export const buildHandlebarsOptions = (options: {
  providerId: string;
  config?: Record<string, JsonValue> | boolean;
  logger: ProviderLogger;
  helpers?: Record<string, HelperDelegate>;
  additionalPartials?: Record<string, string>;
}): DestinationCompilationOptions | undefined => {
  const { providerId, config, helpers, additionalPartials, logger } = options;

  if (config === true) {
    const partialsFromAdditional =
      collectAdditionalPartials(additionalPartials);
    return {
      handlebars: {
        force: true,
        helpers,
        partials:
          partialsFromAdditional.size > 0
            ? Object.fromEntries(partialsFromAdditional)
            : undefined,
      },
    };
  }

  if (config === false || config === undefined) {
    return;
  }

  if (!isPlainObject(config)) {
    logger.warn("Ignoring invalid Handlebars configuration", {
      destination: providerId,
      value: config,
    });
    return;
  }

  const providerConfig = config as UnknownRecord;
  const rawHandlebarsConfig = providerConfig.handlebars;

  if (rawHandlebarsConfig === true) {
    const partialsFromAdditional =
      collectAdditionalPartials(additionalPartials);
    return {
      handlebars: {
        force: true,
        helpers,
        partials:
          partialsFromAdditional.size > 0
            ? Object.fromEntries(partialsFromAdditional)
            : undefined,
      },
    };
  }

  if (
    rawHandlebarsConfig !== undefined &&
    !isPlainObject(rawHandlebarsConfig)
  ) {
    logger.warn("Ignoring invalid Handlebars configuration", {
      destination: providerId,
      value: rawHandlebarsConfig,
    });
    return;
  }

  const handlebarsConfig = rawHandlebarsConfig as
    | HandlebarsConfigShape
    | undefined;

  const partials = collectAdditionalPartials(additionalPartials);
  mergeConfiguredPartials(
    providerId,
    handlebarsConfig?.partials,
    partials,
    logger
  );

  const force =
    handlebarsConfig?.force === true || handlebarsConfig?.enabled === true;
  const overrides = toJsonRecord(
    isPlainObject(handlebarsConfig?.projectConfigOverrides)
      ? (handlebarsConfig?.projectConfigOverrides as Record<string, unknown>)
      : undefined
  );

  const helperEntries =
    helpers && Object.keys(helpers).length > 0 ? helpers : undefined;
  const partialsObject =
    partials.size > 0 ? Object.fromEntries(partials) : undefined;

  const hasHandlebarsOptions = force || helperEntries || partialsObject;
  const hasOverrides = Boolean(overrides);

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
    projectConfigOverrides: overrides,
  };
};
