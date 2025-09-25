import {
  type JsonValue,
  type ParsedDoc,
  RULESETS_VERSION_TAG,
  type RulesetDiagnostic,
  type RulesetDiagnostics,
  type RulesetDocument,
  type RulesetDocumentMetadata,
  type RulesetSource,
  type RulesetVersionTag,
} from "@rulesets/types";
import { load as yamlLoad } from "js-yaml";
import { validateObjectDepth } from "./object-depth";
import { validateFrontmatterSchema } from "./schema-validator";

const DEFAULT_FRONTMATTER_MAX_DEPTH = 10;

const toJsonFrontmatter = (
  frontmatter: Record<string, unknown>
): Record<string, JsonValue> => frontmatter as Record<string, JsonValue>;

type FrontmatterBounds = {
  start: number;
  end: number;
};

type ParseError = {
  message: string;
  line?: number;
  column?: number;
};

export type ParserOptions = {
  readonly version?: RulesetVersionTag;
  readonly frontMatter?: boolean;
  readonly maxFrontmatterDepth?: number;
};

export type ParserOutput = {
  readonly document: RulesetDocument;
  readonly parsed: ParsedDoc;
  readonly diagnostics: RulesetDiagnostics;
};

export type RulesetParserFn = (
  source: RulesetSource,
  options?: ParserOptions
) => ParserOutput;

function findFrontmatterBounds(lines: string[]): FrontmatterBounds | null {
  if (lines.length === 0) {
    return null;
  }

  if (lines[0].trim() !== "---") {
    return null;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return { start: 0, end: index };
    }
  }

  return { start: 0, end: -1 };
}

function createFriendlyYamlError(error: unknown): string {
  let friendly = "Invalid YAML syntax in frontmatter. ";

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("unexpected end")) {
      friendly += "Make sure all strings are properly quoted and closed.";
    } else if (message.includes("bad indentation")) {
      friendly += "Check that your indentation is consistent (use spaces).";
    } else if (message.includes("duplicate key")) {
      friendly += "You have duplicate keys in your frontmatter.";
    } else if (
      message.includes("unexpected token") ||
      message.includes("unexpected character")
    ) {
      friendly += "Check for special characters that need escaping or quotes.";
    } else {
      friendly += `Details: ${error.message}`;
    }
  } else {
    friendly += "Please check your frontmatter formatting.";
  }

  return friendly;
}

function parseFrontmatterContent(
  lines: string[],
  bounds: FrontmatterBounds,
  maxDepth: number
): { frontmatter: Record<string, unknown>; errors: ParseError[] } {
  const errors: ParseError[] = [];
  let frontmatter: Record<string, unknown> = {};

  const content = lines.slice(bounds.start + 1, bounds.end).join("\n");

  try {
    frontmatter = (yamlLoad(content) as Record<string, unknown>) ?? {};

    if (!validateObjectDepth(frontmatter, maxDepth)) {
      errors.push({
        message: `Frontmatter nesting depth exceeds maximum of ${maxDepth} levels`,
        line: bounds.start + 1,
        column: 1,
      });
      return { frontmatter: {}, errors };
    }
  } catch (error) {
    errors.push({
      message: createFriendlyYamlError(error),
      line: bounds.start + 1,
      column: 1,
    });
  }

  return { frontmatter, errors };
}

function processFrontmatter(
  lines: string[],
  options: ParserOptions
): { frontmatter: Record<string, unknown>; errors: ParseError[] } {
  if (options.frontMatter === false) {
    return { frontmatter: {}, errors: [] };
  }

  const bounds = findFrontmatterBounds(lines);
  if (!bounds) {
    return { frontmatter: {}, errors: [] };
  }

  if (bounds.end === -1) {
    return {
      frontmatter: {},
      errors: [
        {
          message: "Unclosed frontmatter block - missing closing ---",
          line: bounds.start + 1,
          column: 1,
        },
      ],
    };
  }

  const depth = options.maxFrontmatterDepth ?? DEFAULT_FRONTMATTER_MAX_DEPTH;
  return parseFrontmatterContent(lines, bounds, depth);
}

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.hasOwn(value, key);

function hasRuleMetadata(frontmatter: Record<string, unknown>): boolean {
  if (!frontmatter || typeof frontmatter !== "object") {
    return false;
  }

  if (hasOwn(frontmatter, "rule")) {
    return true;
  }

  if (hasOwn(frontmatter, "rulesets")) {
    return true;
  }

  return false;
}

function createParsedDoc(
  content: string,
  frontmatter: Record<string, unknown>,
  errors: ParseError[],
  filePath?: string
): ParsedDoc {
  const hasFrontmatter = Object.keys(frontmatter).length > 0;

  const parsedDoc: ParsedDoc = {
    source: {
      path: filePath,
      content,
      frontmatter: hasFrontmatter ? toJsonFrontmatter(frontmatter) : undefined,
      isRule: hasFrontmatter ? hasRuleMetadata(frontmatter) : false,
    },
    ast: {
      sections: [],
      imports: [],
      variables: [],
      markers: [],
    },
  };

  if (errors.length > 0) {
    parsedDoc.errors = errors;
  }

  return parsedDoc;
}

function toDiagnostics(errors: ParseError[]): RulesetDiagnostics {
  return errors.map<RulesetDiagnostic>((error) => ({
    level: "error",
    message: error.message,
    location:
      error.line !== undefined
        ? {
            line: error.line,
            column: error.column ?? 1,
          }
        : undefined,
  }));
}

function toMetadata(
  parsed: ParsedDoc,
  version: RulesetVersionTag
): RulesetDocumentMetadata {
  const frontmatter = parsed.source.frontmatter
    ? (parsed.source.frontmatter as Record<string, JsonValue>)
    : {};

  return {
    frontMatter: frontmatter,
    version,
  };
}

export function parse(
  content: string,
  filePath?: string,
  options: ParserOptions = {}
): ParsedDoc {
  const lines = content.split("\n");
  const { frontmatter, errors: frontmatterErrors } = processFrontmatter(
    lines,
    options
  );

  const { parsed: parsedFrontmatter, errors: schemaValidationErrors } =
    validateFrontmatterSchema(frontmatter);

  const schemaParseErrors: ParseError[] = schemaValidationErrors.map(
    (error) => ({
      message: `Schema validation error: ${error.path} ${error.message}`,
      line: 1,
      column: 1,
    })
  );

  const parsed = createParsedDoc(
    content,
    parsedFrontmatter ?? frontmatter,
    [...frontmatterErrors, ...schemaParseErrors],
    filePath
  );

  return parsed;
}

export const parseRuleset: RulesetParserFn = (source, options = {}) => {
  const parsed = parse(source.contents, source.path ?? source.id, options);
  const version = options.version ?? RULESETS_VERSION_TAG;
  const metadata = toMetadata(parsed, version);

  const document: RulesetDocument = {
    source,
    metadata,
    ast: parsed.ast,
    diagnostics: toDiagnostics(Array.from(parsed.errors ?? [])),
  };

  return {
    document,
    parsed,
    diagnostics: document.diagnostics ?? [],
  };
};

export const createNoopParser = (): RulesetParserFn => (source, options) => {
  const version = options?.version ?? RULESETS_VERSION_TAG;
  const metadata: RulesetDocumentMetadata = {
    frontMatter: {},
    version,
  };

  const parsed: ParsedDoc = {
    source: {
      path: source.path,
      content: source.contents,
      frontmatter: undefined,
      isRule: false,
    },
    ast: {
      sections: [],
      imports: [],
      variables: [],
      markers: [],
    },
  };

  const document: RulesetDocument = {
    source,
    metadata,
    ast: parsed.ast,
    diagnostics: [],
  };

  return {
    document,
    parsed,
    diagnostics: [],
  };
};

export class RulesetParser {
  private readonly options: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.options = options;
  }

  parse(content: string, filePath?: string): ParsedDoc {
    return parse(content, filePath, this.options);
  }

  parseSource(source: RulesetSource): ParserOutput {
    return parseRuleset(source, this.options);
  }
}

// biome-ignore lint/performance/noBarrelFile: maintain re-export for public API
export {
  formatValidationErrors,
  validateFrontmatterSchema,
} from "./schema-validator";
