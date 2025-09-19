import { load as yamlLoad } from 'js-yaml';
import { RESOURCE_LIMITS } from '../config/limits';
import type { ParsedDoc } from '../interfaces';
import { validateObjectDepth } from '../utils/security';

/**
 * Represents the boundaries of the frontmatter section.
 */
type FrontmatterBounds = {
  start: number;
  end: number;
};

/**
 * Represents a parse error with location information.
 */
type ParseError = {
  message: string;
  line?: number;
  column?: number;
};

/**
 * Finds the start and end line indices of the frontmatter block.
 *
 * @param lines - Array of content lines
 * @returns Frontmatter bounds or null if no valid frontmatter found
 */
function findFrontmatterBounds(lines: string[]): FrontmatterBounds | null {
  // Check if first line starts frontmatter
  if (lines[0].trim() !== '---') {
    return null;
  }

  // Find the closing frontmatter delimiter
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return { start: 0, end: i };
    }
  }

  return { start: 0, end: -1 }; // Unclosed frontmatter
}

/**
 * Extracts and parses YAML frontmatter content.
 *
 * @param lines - Array of content lines
 * @param bounds - Frontmatter boundaries
 * @returns Parsed frontmatter object and any errors encountered
 */
function parseFrontmatterContent(
  lines: string[],
  bounds: FrontmatterBounds
): { frontmatter: Record<string, unknown>; errors: ParseError[] } {
  const errors: ParseError[] = [];
  let frontmatter: Record<string, unknown> = {};

  const frontmatterContent = lines
    .slice(bounds.start + 1, bounds.end)
    .join('\n');

  try {
    frontmatter =
      (yamlLoad(frontmatterContent) as Record<string, unknown>) || {};

    // Validate nesting depth
    if (
      !validateObjectDepth(
        frontmatter,
        RESOURCE_LIMITS.ruleset.maxFrontmatterDepth
      )
    ) {
      errors.push({
        message: `Frontmatter nesting depth exceeds maximum of ${RESOURCE_LIMITS.ruleset.maxFrontmatterDepth} levels`,
        line: bounds.start + 1,
        column: 1,
      });
      return { frontmatter: {}, errors };
    }
  } catch (error) {
    const friendlyMessage = createFriendlyYamlError(error);
    errors.push({
      message: friendlyMessage,
      line: bounds.start + 1,
      column: 1,
    });
  }

  return { frontmatter, errors };
}

/**
 * Creates a user-friendly error message from a YAML parsing error.
 *
 * @param error - The caught error from YAML parsing
 * @returns A user-friendly error message
 */
function createFriendlyYamlError(error: unknown): string {
  let friendlyMessage = 'Invalid YAML syntax in frontmatter. ';

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Add user-friendly context based on common YAML errors
    if (message.includes('unexpected end')) {
      friendlyMessage +=
        'Make sure all strings are properly quoted and closed.';
    } else if (message.includes('bad indentation')) {
      friendlyMessage +=
        'Check that your indentation is consistent (use spaces, not tabs).';
    } else if (message.includes('duplicate key')) {
      friendlyMessage += 'You have duplicate keys in your frontmatter.';
    } else if (
      message.includes('unexpected token') ||
      message.includes('unexpected character')
    ) {
      friendlyMessage +=
        'Check for special characters that need to be quoted or escaped.';
    } else {
      friendlyMessage += `Details: ${error.message}`;
    }
  } else {
    friendlyMessage += 'Please check your frontmatter formatting.';
  }

  return friendlyMessage;
}

/**
 * Processes frontmatter extraction from content lines.
 *
 * @param lines - Array of content lines
 * @returns Processed frontmatter and any errors encountered
 */
function processFrontmatter(lines: string[]): {
  frontmatter: Record<string, unknown>;
  errors: ParseError[];
} {
  const errors: ParseError[] = [];
  const frontmatter: Record<string, unknown> = {};

  const bounds = findFrontmatterBounds(lines);

  if (!bounds) {
    // No frontmatter found - this is valid
    return { frontmatter, errors };
  }

  if (bounds.end === -1) {
    // Unclosed frontmatter
    errors.push({
      message: 'Unclosed frontmatter block - missing closing ---',
      line: bounds.start + 1,
      column: 1,
    });
    return { frontmatter, errors };
  }

  const result = parseFrontmatterContent(lines, bounds);
  return result;
}

/**
 * Creates a ParsedDoc structure from the parsed content.
 *
 * @param content - Original content string
 * @param frontmatter - Parsed frontmatter object
 * @param errors - Any parsing errors encountered
 * @returns Complete ParsedDoc structure
 */
function createParsedDoc(
  content: string,
  frontmatter: Record<string, unknown>,
  errors: ParseError[]
): ParsedDoc {
  const parsedDoc: ParsedDoc = {
    source: {
      content,
      frontmatter:
        Object.keys(frontmatter).length > 0 ? frontmatter : undefined,
    },
    ast: {
      stems: [], // Empty for v0 - no body processing
      imports: [], // Empty for v0 - no body processing
      variables: [], // Empty for v0 - no body processing
      markers: [], // Empty for v0 - no body processing
    },
  };

  if (errors.length > 0) {
    parsedDoc.errors = errors;
  }

  return parsedDoc;
}

/**
 * Parses a Rulesets source rules file to extract frontmatter and body content.
 * For v0.1.0, this is a simple implementation that doesn't process Rulesets markers.
 *
 * @param content - The raw markdown content to parse
 * @returns ParsedDoc
 */
// TODO: Add support for stem parsing
// TODO: Add variable substitution
export function parse(content: string): ParsedDoc {
  const lines = content.split('\n');
  const { frontmatter, errors } = processFrontmatter(lines);
  return createParsedDoc(content, frontmatter, errors);
}
