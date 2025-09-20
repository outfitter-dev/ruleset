import type { ParsedDoc } from '../interfaces';

/**
 * Read destination-specific configuration from parsed document frontmatter
 */
export function readDestinationConfig(
  parsed: ParsedDoc,
  destinationId: string
): Record<string, unknown> {
  const frontmatter = parsed.source.frontmatter;
  if (!frontmatter) {
    return {};
  }

  // Check for destination-specific config
  const destinationConfig = frontmatter[destinationId];
  if (destinationConfig && typeof destinationConfig === 'object' && !Array.isArray(destinationConfig)) {
    return destinationConfig as Record<string, unknown>;
  }

  return {};
}

/**
 * Build Handlebars compilation options from destination config
 */
export function buildHandlebarsOptions({
  destinationId,
  destinationConfig,
  logger: _logger,
}: {
  destinationId: string;
  destinationConfig: Record<string, unknown>;
  logger: unknown;
}): Record<string, unknown> | undefined {
  // Check if Handlebars is enabled for this destination
  const handlebarsConfig = destinationConfig.handlebars;
  if (!handlebarsConfig) {
    return undefined;
  }

  if (typeof handlebarsConfig === 'boolean' && handlebarsConfig) {
    // Simple boolean flag - enable Handlebars with defaults
    return {
      forceHandlebars: true,
    };
  }

  if (typeof handlebarsConfig === 'object' && !Array.isArray(handlebarsConfig)) {
    // Detailed configuration
    const config = handlebarsConfig as Record<string, unknown>;
    return {
      forceHandlebars: config.enabled !== false,
      helpers: config.helpers,
      partials: config.partials,
    };
  }

  return undefined;
}