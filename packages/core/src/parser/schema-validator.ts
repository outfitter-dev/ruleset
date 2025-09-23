/**
 * Schema validation for Rulesets frontmatter metadata
 */

export type ValidationError = {
  path: string;
  message: string;
  value?: unknown;
};

/**
 * Expected schema for rule metadata
 */
export type RuleMetadata = {
  version?: string;
  template?: boolean;
  globs?: string[];
  name?: string;
  description?: string;
  // Allow additional properties for extensibility
  [key: string]: unknown;
};


/**
 * Validates that a value is a string
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Validates that a value is a boolean
 */
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Validates that a value is an array of strings
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Validates rule metadata according to the expected schema
 */
function validateRuleMetadata(rule: unknown, basePath = 'rule'): ValidationError[] {
  const errors: ValidationError[] = [];

  if (rule === null || rule === undefined) {
    return errors; // rule is optional
  }

  if (typeof rule !== 'object') {
    errors.push({
      path: basePath,
      message: 'must be an object',
      value: rule,
    });
    return errors;
  }

  const ruleObj = rule as Record<string, unknown>;

  // Validate version if present
  if ('version' in ruleObj) {
    if (!isString(ruleObj.version)) {
      errors.push({
        path: `${basePath}.version`,
        message: 'must be a string',
        value: ruleObj.version,
      });
    }
  }

  // Validate template if present
  if ('template' in ruleObj) {
    if (!isBoolean(ruleObj.template)) {
      errors.push({
        path: `${basePath}.template`,
        message: 'must be a boolean',
        value: ruleObj.template,
      });
    }
  }

  // Validate globs if present
  if ('globs' in ruleObj) {
    if (!isStringArray(ruleObj.globs)) {
      errors.push({
        path: `${basePath}.globs`,
        message: 'must be an array of strings',
        value: ruleObj.globs,
      });
    }
  }

  // Validate name if present
  if ('name' in ruleObj) {
    if (!isString(ruleObj.name)) {
      errors.push({
        path: `${basePath}.name`,
        message: 'must be a string',
        value: ruleObj.name,
      });
    }
  }

  // Validate description if present
  if ('description' in ruleObj) {
    if (!isString(ruleObj.description)) {
      errors.push({
        path: `${basePath}.description`,
        message: 'must be a string',
        value: ruleObj.description,
      });
    }
  }

  return errors;
}


/**
 * Validates frontmatter schema for Rulesets documents
 */
export function validateFrontmatterSchema(
  frontmatter: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate rule metadata if present
  if ('rule' in frontmatter) {
    const ruleErrors = validateRuleMetadata(frontmatter.rule);
    errors.push(...ruleErrors);
  }

  return errors;
}

/**
 * Formats validation errors into user-friendly messages
 */
export function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.map(error => {
    const valueInfo = error.value !== undefined ? ` (got: ${typeof error.value})` : '';
    return `${error.path} ${error.message}${valueInfo}`;
  });
}