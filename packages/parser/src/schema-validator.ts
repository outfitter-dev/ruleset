import {
  type RulesetFrontmatter,
  rulesetFrontmatterSchema,
} from "@rulesets/types";

export type ValidationError = {
  path: string;
  message: string;
  value?: unknown;
};

const formatIssuePath = (path: readonly (string | number)[]): string => {
  if (path.length === 0) {
    return "frontmatter";
  }

  return path
    .map((segment, index) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }
      return index === 0 ? segment : `.${segment}`;
    })
    .join("");
};

export const validateFrontmatterSchema = (
  frontmatter: Record<string, unknown>
): {
  parsed?: RulesetFrontmatter;
  errors: ValidationError[];
} => {
  const result = rulesetFrontmatterSchema.safeParse(frontmatter);

  if (result.success) {
    return {
      parsed: result.data,
      errors: [],
    };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message,
    value: (issue as { received?: unknown }).received,
  }));

  return {
    errors,
  };
};

export const formatValidationErrors = (errors: ValidationError[]): string[] =>
  errors.map((error) => {
    const valueInfo =
      error.value !== undefined ? ` (got: ${typeof error.value})` : "";
    return `${error.path} ${error.message}${valueInfo}`;
  });
