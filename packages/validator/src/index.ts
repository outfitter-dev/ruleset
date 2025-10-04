import type {
  JsonValue,
  RulesetDiagnostic,
  RulesetDiagnostics,
  RulesetDocument,
  RulesetFrontmatter,
  RulesetRuleFrontmatter,
} from "@ruleset/types";
import { rulesetFrontmatterSchema } from "@ruleset/types";

export type ValidationOptions = {
  readonly strict?: boolean;
};

export type ValidationResult = {
  readonly document: RulesetDocument;
  readonly diagnostics: RulesetDiagnostics;
};

export type RulesetValidator = (
  document: RulesetDocument,
  options?: ValidationOptions
) => ValidationResult;

const CLOSING_SECTION_REGEX = /\{\{\s*\/\s*([a-zA-Z0-9_-]+)\b/g;
const HANDLEBARS_TAG_REGEX = /\{\{\s*([a-zA-Z0-9_-]+)/;

type DiagnosticInput = {
  message: string;
  level: RulesetDiagnostic["level"];
  line?: number;
  column?: number;
  tags?: readonly string[];
};

const createDiagnostic = ({
  message,
  level,
  line = 1,
  column = 1,
  tags,
}: DiagnosticInput): RulesetDiagnostic => ({
  level,
  message,
  location: { line, column },
  ...(tags && tags.length > 0 ? { tags } : {}),
});

const toWarning = (
  message: string,
  line?: number,
  column?: number
): RulesetDiagnostic =>
  createDiagnostic({ message, level: "warning", line, column });

const toError = (
  message: string,
  line?: number,
  column?: number
): RulesetDiagnostic =>
  createDiagnostic({ message, level: "error", line, column });

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.hasOwn(value, key);

const extractBodyLinesAndOffset = (
  content: string
): { lines: string[]; offset: number } => {
  const lines = content.split("\n");

  if (lines.length === 0) {
    return { lines: [], offset: 1 };
  }

  if (lines[0].trim() !== "---") {
    return { lines, offset: 1 };
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return { lines: lines.slice(index + 1), offset: index + 2 };
    }
  }

  return { lines: [], offset: lines.length + 1 };
};

const findFirstHandlebarsExpression = (
  lines: string[],
  offset: number
): { line: number; column: number } | null => {
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trimStart();

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    let search = line.indexOf("{{");
    while (search !== -1) {
      const prefix = line.slice(Math.max(0, search - 1), search);
      if (prefix.endsWith("\\")) {
        search = line.indexOf("{{", search + 2);
        continue;
      }
      return { line: offset + index, column: search + 1 };
    }
  }

  return null;
};

const detectLegacySectionMarkers = (
  lines: string[],
  offset: number
): RulesetDiagnostics => {
  const diagnostics: RulesetDiagnostic[] = [];
  const closingRegex = new RegExp(CLOSING_SECTION_REGEX);
  const closings = new Set<string>();

  for (const line of lines) {
    closingRegex.lastIndex = 0;
    let match: RegExpExecArray | null = closingRegex.exec(line);
    while (match !== null) {
      closings.add(match[1]);
      match = closingRegex.exec(line);
    }
  }

  if (closings.size === 0) {
    return diagnostics;
  }

  lines.forEach((line, index) => {
    let searchIndex = 0;
    while (searchIndex < line.length) {
      const openIndex = line.indexOf("{{", searchIndex);
      if (openIndex === -1) {
        break;
      }
      const tagMatch = HANDLEBARS_TAG_REGEX.exec(line.slice(openIndex));
      if (tagMatch && closings.has(tagMatch[1])) {
        diagnostics.push(
          toError(
            `Legacy section markers ({{${tagMatch[1]}}}) are no longer supported. Replace with Markdown headings or partials.`,
            offset + index,
            openIndex + 1
          )
        );
      }
      searchIndex = openIndex + 2;
    }
  });

  return diagnostics;
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

const schemaIssuesToDiagnostics = (
  issues: readonly { path: (string | number)[]; message: string }[]
): RulesetDiagnostics =>
  issues.map((issue) =>
    toError(
      `Frontmatter schema violation at ${formatIssuePath(issue.path)}: ${issue.message}`
    )
  );

const validateFrontmatterPresence = (
  frontmatter: Record<string, JsonValue>,
  options: ValidationOptions
): RulesetDiagnostics => {
  if (Object.keys(frontmatter).length > 0) {
    return [];
  }

  return [
    options.strict
      ? toError(
          "Missing YAML frontmatter. Add a `rule` block with at least a semver `version`."
        )
      : toWarning(
          "Missing YAML frontmatter. Add a `rule` block with at least a semver `version`."
        ),
  ];
};

const validateRuleMetadata = (
  rule: RulesetRuleFrontmatter | undefined,
  options: ValidationOptions
): RulesetDiagnostics => {
  const diagnostics: RulesetDiagnostic[] = [];
  const severity = options.strict ? toError : toWarning;

  if (!rule) {
    diagnostics.push(
      severity(
        'Missing required rule metadata block. Add `rule: { version: "0.4.0" }`.'
      )
    );
    return diagnostics;
  }

  if (!rule.version) {
    diagnostics.push(
      severity(
        "Missing required `rule.version`. Provide a semver-compatible version string."
      )
    );
  } else {
    // Require strict X.Y.Z format (matching old semver.valid() behavior)
    const isValidFormat = /^\d+\.\d+\.\d+/.test(rule.version);
    if (!isValidFormat) {
      diagnostics.push(
        toError(
          `Invalid semantic version in rule.version: "${rule.version}". Use a valid semver identifier (e.g., 0.4.0).`
        )
      );
    } else {
      try {
        // Additional validation via Bun.semver
        Bun.semver.order(rule.version, "0.0.0");
      } catch {
        diagnostics.push(
          toError(
            `Invalid semantic version in rule.version: "${rule.version}". Use a valid semver identifier (e.g., 0.4.0).`
          )
        );
      }
    }
  }

  return diagnostics;
};

const validateRecommendedFields = (
  frontmatter: RulesetFrontmatter
): RulesetDiagnostics => {
  const diagnostics: RulesetDiagnostic[] = [];

  if (!hasOwn(frontmatter, "description")) {
    diagnostics.push(
      toWarning(
        "Consider adding a `description` field for downstream tooling readability."
      )
    );
  }

  return diagnostics;
};

const validateHandlebarsUsage = (
  frontmatter: RulesetFrontmatter,
  content: string
): RulesetDiagnostics => {
  const diagnostics: RulesetDiagnostic[] = [];
  const templateEnabled = frontmatter.rule?.template === true;

  if (templateEnabled) {
    return diagnostics;
  }

  const { lines, offset } = extractBodyLinesAndOffset(content);
  const location = findFirstHandlebarsExpression(lines, offset);
  if (!location) {
    return diagnostics;
  }

  diagnostics.push(
    toWarning(
      "Handlebars-style braces detected but `rule.template` is not enabled. Set `rule.template: true` or escape the braces (e.g., `\\{{`).",
      location.line,
      location.column
    )
  );
  return diagnostics;
};

const validateBodyStructure = (content: string): RulesetDiagnostics => {
  const diagnostics: RulesetDiagnostic[] = [];
  const { lines, offset } = extractBodyLinesAndOffset(content);

  let firstContent = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.length === 0) {
      continue;
    }

    firstContent = index;
    if (!trimmed.startsWith("# ")) {
      diagnostics.push(
        toError(
          "The first content line should be an H1 heading (e.g., `# Project Rules`).",
          offset + index,
          1
        )
      );
    }
    break;
  }

  if (firstContent === -1) {
    diagnostics.push(
      toError(
        "No Markdown content found after frontmatter. Add an H1 heading and body content.",
        offset,
        1
      )
    );
    return diagnostics;
  }

  diagnostics.push(...detectLegacySectionMarkers(lines, offset));
  return diagnostics;
};

export const validateDocument: RulesetValidator = (document, options = {}) => {
  const diagnostics: RulesetDiagnostic[] = [];
  const frontmatter = document.metadata.frontMatter ?? {};
  const content = document.source.contents;

  diagnostics.push(...validateFrontmatterPresence(frontmatter, options));

  const schemaResult = rulesetFrontmatterSchema.safeParse(frontmatter);
  if (!schemaResult.success) {
    diagnostics.push(...schemaIssuesToDiagnostics(schemaResult.error.issues));
  }

  const typedFrontmatter: RulesetFrontmatter = schemaResult.success
    ? schemaResult.data
    : (frontmatter as RulesetFrontmatter);

  if (Object.keys(frontmatter).length === 0) {
    diagnostics.push(...validateBodyStructure(content));
    diagnostics.push(...validateHandlebarsUsage(typedFrontmatter, content));

    return {
      document,
      diagnostics,
    };
  }

  diagnostics.push(...validateRuleMetadata(typedFrontmatter.rule, options));
  diagnostics.push(...validateRecommendedFields(typedFrontmatter));
  diagnostics.push(...validateBodyStructure(content));
  diagnostics.push(...validateHandlebarsUsage(typedFrontmatter, content));

  return {
    document,
    diagnostics,
  };
};

export const createNoopValidator = (): RulesetValidator => (document) => ({
  document,
  diagnostics: [],
});

export const runValidators = (
  document: RulesetDocument,
  validators: readonly RulesetValidator[],
  options: ValidationOptions = {}
): ValidationResult => {
  const diagnostics: RulesetDiagnostic[] = [];
  let currentDocument = document;

  for (const validator of validators) {
    const result = validator(currentDocument, options);
    currentDocument = result.document;
    diagnostics.push(...result.diagnostics);
  }

  return {
    document: currentDocument,
    diagnostics,
  };
};
