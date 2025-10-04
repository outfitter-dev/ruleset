import type { ParsedDoc } from "../interfaces";

export type LinterConfig = {
  /** When false, missing rule.version is reported as a warning instead of an error. */
  requireRulesetsVersion?: boolean;
  /**
   * Legacy option retained for compatibility. The v0.2.0 linter no longer validates
   * destination whitelists, but the field is accepted to avoid breaking callers.
   */
  allowedDestinations?: string[];
};

export type LintResult = {
  message: string;
  line?: number;
  column?: number;
  severity: "error" | "warning" | "info";
};

const FIELD_NAMES: Record<string, string> = {
  "/rule": "rule metadata block",
  "/rule/version": "rule version",
  "/rule/template": "rule.template flag",
  "/rule/globs": "rule.globs list",
  "/description": "description",
};

const objectConstructor: ObjectConstructor & {
  hasOwn?: (value: object, key: PropertyKey) => boolean;
} = Object;

const hasOwn = (value: object, key: PropertyKey): boolean =>
  typeof objectConstructor.hasOwn === "function"
    ? objectConstructor.hasOwn(value, key)
    : Object.getOwnPropertyDescriptor(value, key) !== undefined;

function getFieldName(path: string): string {
  return FIELD_NAMES[path] || path;
}

function collectParsingErrors(parsedDoc: ParsedDoc): LintResult[] {
  const results: LintResult[] = [];

  if (!parsedDoc.errors) {
    return results;
  }

  for (const error of parsedDoc.errors) {
    results.push({
      message: error.message,
      line: error.line,
      column: error.column,
      severity: "error",
    });
  }

  return results;
}

function validateFrontmatterPresence(
  frontmatter: Record<string, unknown> | undefined,
  config: LinterConfig
): LintResult | null {
  if (frontmatter) {
    return null;
  }

  const severity =
    config.requireRulesetsVersion === false ? "warning" : "error";
  return {
    message:
      'No frontmatter found. Add YAML frontmatter with a `rule` block (e.g., rule: { version: "0.2.0" }).',
    line: 1,
    column: 1,
    severity,
  };
}

function validateRuleMetadata(
  frontmatter: Record<string, unknown>,
  config: LinterConfig
): LintResult[] {
  const results: LintResult[] = [];
  const severity =
    config.requireRulesetsVersion === false ? "warning" : "error";

  if (!hasOwn(frontmatter, "rule")) {
    results.push({
      message: `Missing required ${getFieldName("/rule")}. Include a \`rule\` object with at least \`version\`.`,
      line: 1,
      column: 1,
      severity,
    });
    return results;
  }

  const rawRule = (frontmatter as Record<string, unknown>).rule;
  if (
    typeof rawRule !== "object" ||
    rawRule === null ||
    Array.isArray(rawRule)
  ) {
    results.push({
      message: `Invalid ${getFieldName("/rule")}. Expected an object (e.g., rule: { version: "0.2.0" }).`,
      line: 1,
      column: 1,
      severity: "error",
    });
    return results;
  }

  const rule = rawRule as Record<string, unknown>;

  if (hasOwn(rule, "version")) {
    const rawVersion = rule.version;
    if (typeof rawVersion !== "string") {
      results.push({
        message: `Invalid ${getFieldName("/rule/version")}. Expected a string (e.g., "0.2.0").`,
        line: 1,
        column: 1,
        severity: "error",
      });
    } else {
      const version = rawVersion.trim();
      // Require strict X.Y.Z format (matching old semver.valid() behavior)
      const isValidFormat = /^\d+\.\d+\.\d+/.test(version);
      if (!isValidFormat) {
        results.push({
          message: `Invalid ${getFieldName("/rule/version")}. Expected a semantic version (e.g., "0.2.0").`,
          line: 1,
          column: 1,
          severity,
        });
      } else {
        try {
          // Additional validation via Bun.semver
          Bun.semver.order(version, "0.0.0");
        } catch {
          results.push({
            message: `Invalid ${getFieldName("/rule/version")}. Expected a semantic version (e.g., "0.2.0").`,
            line: 1,
            column: 1,
            severity,
          });
        }
      }
    }
  } else {
    results.push({
      message: `Missing required ${getFieldName("/rule/version")}.`,
      line: 1,
      column: 1,
      severity,
    });
  }

  if (hasOwn(rule, "template") && typeof rule.template !== "boolean") {
    results.push({
      message: `Invalid ${getFieldName("/rule/template")}. Expected a boolean (true or false).`,
      line: 1,
      column: 1,
      severity: "error",
    });
  }

  if (hasOwn(rule, "globs")) {
    const globs = rule.globs;
    if (Array.isArray(globs)) {
      const invalidEntries = globs
        .map((entry, index) =>
          typeof entry === "string" && entry.trim().length > 0 ? -1 : index
        )
        .filter((index) => index !== -1);
      if (invalidEntries.length > 0) {
        results.push({
          message: `Invalid entries in ${getFieldName("/rule/globs")} at indices [${invalidEntries.join(", ")}]. Provide non-empty strings.`,
          line: 1,
          column: 1,
          severity: "error",
        });
      }
    } else {
      results.push({
        message: `Invalid ${getFieldName("/rule/globs")}. Expected an array of glob strings (e.g., ['**/*.md']).`,
        line: 1,
        column: 1,
        severity: "error",
      });
    }
  }

  return results;
}

function validateRecommendedFields(
  frontmatter: Record<string, unknown>
): LintResult[] {
  const results: LintResult[] = [];

  if (!hasOwn(frontmatter, "description")) {
    results.push({
      message: `Consider adding a ${getFieldName("/description")} to provide high-level context.`,
      line: 1,
      column: 1,
      severity: "info",
    });
  }

  return results;
}

function extractBodyLinesAndOffset(content: string): {
  lines: string[];
  offset: number;
} {
  const lines = content.split("\n");

  if (lines.length === 0) {
    return { lines: [], offset: 1 };
  }

  if (lines[0].trim() !== "---") {
    return { lines, offset: 1 };
  }

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return { lines: lines.slice(i + 1), offset: i + 2 };
    }
  }

  // Unclosed frontmatter - treat as no body content
  return { lines: [], offset: lines.length + 1 };
}

function detectLegacySectionMarkers(
  lines: string[],
  offset: number
): LintResult[] {
  const results: LintResult[] = [];
  const closings = new Set<string>();
  const closingRegex = /\{\{\s*\/\s*([a-zA-Z0-9_-]+)\b/g;

  for (const line of lines) {
    let match: RegExpExecArray | null;
    while ((match = closingRegex.exec(line)) !== null) {
      closings.add(match[1]);
    }
  }

  if (closings.size === 0) {
    return results;
  }

  const flaggedPositions = new Set<string>();

  lines.forEach((line, index) => {
    let searchIndex = 0;
    while (searchIndex < line.length) {
      const openIndex = line.indexOf("{{", searchIndex);
      if (openIndex === -1) {
        break;
      }
      searchIndex = openIndex + 2;
      const after = line.slice(openIndex + 2).trimStart();
      if (!after) {
        continue;
      }
      const leadingChar = after[0];
      if (leadingChar && "#/>!{".includes(leadingChar)) {
        continue;
      }
      const nameMatch = after.match(/^([a-zA-Z0-9_-]+)/);
      if (!nameMatch) {
        continue;
      }
      const sectionName = nameMatch[1];
      if (!closings.has(sectionName)) {
        continue;
      }
      const key = `${index}:${openIndex}`;
      if (flaggedPositions.has(key)) {
        continue;
      }
      flaggedPositions.add(key);
      results.push({
        message: `Legacy section marker "{{${sectionName}}}" detected. Replace bespoke markers with Markdown headings or partials.`,
        line: offset + index,
        column: openIndex + 1,
        severity: "error",
      });
    }
  });

  return results;
}

function findFirstHandlebarsExpression(
  lines: string[],
  offset: number
): { line: number; column: number } | null {
  let inFence = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    let searchIndex = line.indexOf("{{");
    while (searchIndex !== -1) {
      const prefix = line.slice(Math.max(0, searchIndex - 2), searchIndex);
      if (prefix.endsWith("\\")) {
        searchIndex = line.indexOf("{{", searchIndex + 2);
        continue;
      }
      return { line: offset + index, column: searchIndex + 1 };
    }
  }
  return null;
}

function validateHandlebarsUsage(
  frontmatter: Record<string, unknown> | undefined,
  parsedDoc: ParsedDoc
): LintResult[] {
  const results: LintResult[] = [];
  const rule =
    frontmatter && typeof frontmatter === "object" && frontmatter !== null
      ? (frontmatter as Record<string, unknown>).rule
      : undefined;
  const templateEnabled =
    typeof rule === "object" && rule !== null && !Array.isArray(rule)
      ? (rule as Record<string, unknown>).template === true
      : false;
  if (templateEnabled) {
    return results;
  }
  const { lines, offset } = extractBodyLinesAndOffset(
    parsedDoc.source.content ?? ""
  );
  const location = findFirstHandlebarsExpression(lines, offset);
  if (!location) {
    return results;
  }
  results.push({
    message:
      "Handlebars-like braces detected but `rule.template` is not enabled. Set `rule.template: true` or escape the braces (for example, `\\{{`).",
    line: location.line,
    column: location.column,
    severity: "warning",
  });
  return results;
}

function validateBodyStructure(parsedDoc: ParsedDoc): LintResult[] {
  const content = parsedDoc.source.content ?? "";
  const { lines, offset } = extractBodyLinesAndOffset(content);
  const results: LintResult[] = [];

  let firstContentLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) {
      continue;
    }
    firstContentLineIndex = i;
    if (!trimmed.startsWith("# ")) {
      results.push({
        message:
          'The first content line should be a level-1 Markdown heading (e.g., "# Project Rules").',
        line: offset + i,
        column: 1,
        severity: "error",
      });
    }
    break;
  }

  if (firstContentLineIndex === -1) {
    results.push({
      message:
        "No Markdown content found after frontmatter. Add an H1 heading and body content.",
      line: offset,
      column: 1,
      severity: "error",
    });
  }

  results.push(...detectLegacySectionMarkers(lines, offset));
  return results;
}

// TODO: Extend linting to cover variables/imports when the parser exposes them.
export function lint(
  parsedDoc: ParsedDoc,
  config: LinterConfig = {}
): LintResult[] {
  const results: LintResult[] = [];
  const { frontmatter } = parsedDoc.source;

  results.push(...collectParsingErrors(parsedDoc));

  const frontmatterCheck = validateFrontmatterPresence(frontmatter, config);
  if (frontmatterCheck) {
    results.push(frontmatterCheck);
    results.push(...validateBodyStructure(parsedDoc));
    results.push(...validateHandlebarsUsage(undefined, parsedDoc));
    return results;
  }

  const validFrontmatter = frontmatter as Record<string, unknown>;

  results.push(...validateRuleMetadata(validFrontmatter, config));
  results.push(...validateRecommendedFields(validFrontmatter));
  results.push(...validateBodyStructure(parsedDoc));
  results.push(...validateHandlebarsUsage(validFrontmatter, parsedDoc));

  return results;
}
