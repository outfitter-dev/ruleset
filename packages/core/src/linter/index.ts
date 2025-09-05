import type { ParsedDoc } from '../interfaces';

export type LinterConfig = {
  requireRulesetsVersion?: boolean;
  allowedDestinations?: string[];
};

export type LintResult = {
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
};

// Human-readable field names for error messages
const FIELD_NAMES: Record<string, string> = {
  '/rulesets': 'Rulesets version declaration',
  '/rulesets/version': 'Rulesets version number',
  '/destinations': 'Destination configurations',
  '/title': 'Document title',
  '/description': 'Document description',
  '/version': 'Document version',
};

/**
 * Gets a human-readable field name for error messages.
 *
 * @param path - The field path
 * @returns Human-readable field name
 */
function getFieldName(path: string): string {
  return FIELD_NAMES[path] || path;
}

/**
 * Converts parsing errors to lint results.
 *
 * @param parsedDoc - The parsed document containing errors
 * @returns Array of lint results for parsing errors
 */
function collectParsingErrors(parsedDoc: ParsedDoc): LintResult[] {
  const results: LintResult[] = [];

  if (parsedDoc.errors) {
    for (const error of parsedDoc.errors) {
      results.push({
        message: error.message,
        line: error.line,
        column: error.column,
        severity: 'error',
      });
    }
  }

  return results;
}

/**
 * Validates that frontmatter exists and returns early warning if not.
 *
 * @param frontmatter - The frontmatter to check
 * @param config - Linter configuration
 * @returns Lint result if no frontmatter found, null otherwise
 */
function validateFrontmatterPresence(
  frontmatter: Record<string, unknown> | undefined,
  config: LinterConfig
): LintResult | null {
  if (!frontmatter) {
    return {
      message:
        'No frontmatter found. Consider adding frontmatter with rulesets version and metadata.',
      line: 1,
      column: 1,
      severity: config.requireRulesetsVersion === false ? 'warning' : 'error',
    };
  }
  return null;
}

/**
 * Validates the rulesets version declaration in frontmatter.
 *
 * @param frontmatter - The frontmatter to validate
 * @param config - Linter configuration
 * @returns Array of lint results for rulesets version issues
 */
function validateRulesetsVersion(
  frontmatter: Record<string, unknown>,
  config: LinterConfig
): LintResult[] {
  const results: LintResult[] = [];

  if (config.requireRulesetsVersion === false) {
    return results;
  }

  if (!frontmatter.rulesets) {
    results.push({
      message: `Missing required ${getFieldName('/rulesets')}. Specify the Rulesets version (e.g., rulesets: { version: "0.1.0" }).`,
      line: 1,
      column: 1,
      severity: 'error',
    });
  } else if (
    typeof frontmatter.rulesets !== 'object' ||
    !frontmatter.rulesets ||
    !(frontmatter.rulesets as Record<string, unknown>).version
  ) {
    results.push({
      message: `Invalid ${getFieldName('/rulesets')}. Expected object with version property, got ${typeof frontmatter.rulesets}.`,
      line: 1,
      column: 1,
      severity: 'error',
    });
  }

  return results;
}

/**
 * Validates destination configurations in frontmatter.
 *
 * @param frontmatter - The frontmatter to validate
 * @param config - Linter configuration
 * @returns Array of lint results for destination issues
 */
function validateIncludeList(ids: string[], allowed?: string[]): LintResult[] {
  const out: LintResult[] = [];
  if (!allowed || allowed.length === 0) {
    return out;
  }
  for (const destId of ids) {
    if (!allowed.includes(destId)) {
      out.push({
        message: `Unknown destination "${destId}". Allowed destinations: ${allowed.join(', ')}.`,
        line: 1,
        column: 1,
        severity: 'warning',
      });
    }
  }
  return out;
}

function validateDestinations(
  frontmatter: Record<string, unknown>,
  config: LinterConfig
): LintResult[] {
  const results: LintResult[] = [];

  const value = (frontmatter as Record<string, unknown>).destinations;
  if (!value) {
    return results;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    results.push({
      message: `Invalid ${getFieldName('/destinations')}. Expected an object mapping destination IDs to configuration, or { include: string[] }.`,
      line: 1,
      column: 1,
      severity: 'error',
    });
    return results;
  }

  const obj = value as Record<string, unknown> & { include?: unknown };
  if (Array.isArray(obj.include)) {
    const ids = (obj.include as unknown[]).filter(
      (v): v is string => typeof v === 'string'
    );
    results.push(
      ...validateIncludeList(ids, config.allowedDestinations ?? undefined)
    );
    return results;
  }

  if (config.allowedDestinations && config.allowedDestinations.length > 0) {
    for (const destId of Object.keys(obj)) {
      if (!config.allowedDestinations.includes(destId)) {
        results.push({
          message: `Unknown destination "${destId}". Allowed destinations: ${config.allowedDestinations.join(', ')}.`,
          line: 1,
          column: 1,
          severity: 'warning',
        });
      }
    }
  }

  return results;
}

/**
 * Validates recommended documentation fields in frontmatter.
 *
 * @param frontmatter - The frontmatter to validate
 * @returns Array of lint results for missing recommended fields
 */
function validateRecommendedFields(
  frontmatter: Record<string, unknown>
): LintResult[] {
  const results: LintResult[] = [];

  if (!frontmatter.title) {
    results.push({
      message: `Consider adding a ${getFieldName('/title')} to the frontmatter for better documentation.`,
      line: 1,
      column: 1,
      severity: 'info',
    });
  }

  if (!frontmatter.description) {
    results.push({
      message: `Consider adding a ${getFieldName('/description')} to the frontmatter for better documentation.`,
      line: 1,
      column: 1,
      severity: 'info',
    });
  }

  return results;
}

/**
 * Lints a parsed Rulesets document by validating its frontmatter.
 * For v0.1.0, this performs basic schema validation on the frontmatter.
 *
 * @param parsedDoc - The parsed document to lint
 * @param config - Optional linter configuration
 * @returns A promise that resolves to an array of lint results
 */
// TODO: Add validation for stem properties
// TODO: Add validation for variables and imports
export function lint(
  parsedDoc: ParsedDoc,
  config: LinterConfig = {}
): LintResult[] {
  const results: LintResult[] = [];
  const { frontmatter } = parsedDoc.source;

  // Add any parsing errors as lint errors
  results.push(...collectParsingErrors(parsedDoc));

  // Check if frontmatter exists
  const frontmatterCheck = validateFrontmatterPresence(frontmatter, config);
  if (frontmatterCheck) {
    results.push(frontmatterCheck);
    if (
      frontmatterCheck.severity === 'error' &&
      config.requireRulesetsVersion !== false
    ) {
      results.push({
        message: `Missing required ${getFieldName('/rulesets')}. Specify the Rulesets version (e.g., rulesets: { version: "0.1.0" }).`,
        line: 1,
        column: 1,
        severity: 'error',
      });
    }
    return results; // Early return if no frontmatter
  }

  // At this point we know frontmatter exists
  const validFrontmatter = frontmatter as Record<string, unknown>;

  // Validate rulesets version
  results.push(...validateRulesetsVersion(validFrontmatter, config));

  // Validate destinations
  results.push(...validateDestinations(validFrontmatter, config));

  // Validate recommended fields
  results.push(...validateRecommendedFields(validFrontmatter));

  return results;
}
