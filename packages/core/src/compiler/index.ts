import type { CompiledDoc, ParsedDoc } from '../interfaces';

/**
 * Creates a minimal compiled document for empty files.
 *
 * @param source - Source document information
 * @param destinationId - Target destination ID
 * @param projectConfig - Project configuration
 * @returns Minimal CompiledDoc structure for empty content
 */
function createEmptyCompiledDoc(
  source: ParsedDoc['source'],
  destinationId: string,
  projectConfig: Record<string, unknown>
): CompiledDoc {
  return {
    source: {
      path: source.path,
      content: source.content,
      frontmatter: source.frontmatter,
    },
    ast: {
      sections: [],
      imports: [],
      variables: [],
      markers: [],
    },
    output: {
      content: '',
      metadata: {},
    },
    context: createCompilationContext(
      destinationId,
      projectConfig,
      source.frontmatter
    ),
  };
}

/**
 * Extracts body content by removing frontmatter from the source.
 *
 * @param sourceContent - Raw source content
 * @param hasFrontmatter - Whether frontmatter is present
 * @returns Body content with frontmatter removed
 */
function extractBodyContent(
  sourceContent: string,
  hasFrontmatter: boolean
): string {
  if (!hasFrontmatter) {
    return sourceContent;
  }

  const lines = sourceContent.split('\n');
  let frontmatterEnd = -1;

  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd > 0) {
      return lines
        .slice(frontmatterEnd + 1)
        .join('\n')
        .trim();
    }
  }

  return sourceContent;
}

/**
 * Creates metadata object from frontmatter and destination-specific config.
 *
 * @param frontmatter - Parsed frontmatter
 * @param destinationId - Target destination ID
 * @returns Compiled metadata object
 */
function createOutputMetadata(
  frontmatter: Record<string, unknown> | undefined,
  destinationId: string
): Record<string, unknown> {
  const baseMetadata = {
    title: frontmatter?.title,
    description: frontmatter?.description,
    version: frontmatter?.version,
  };

  // Include destination-specific metadata if available
  const destinations = frontmatter?.destinations as
    | Record<string, unknown>
    | undefined;
  const destinationMetadata =
    (destinations?.[destinationId] as Record<string, unknown> | undefined) ||
    {};

  return {
    ...baseMetadata,
    ...destinationMetadata,
  };
}

/**
 * Creates compilation context with merged configuration.
 *
 * @param destinationId - Target destination ID
 * @param projectConfig - Project-level configuration
 * @param frontmatter - Parsed frontmatter
 * @returns Compilation context object
 */
function createCompilationContext(
  destinationId: string,
  projectConfig: Record<string, unknown>,
  frontmatter: Record<string, unknown> | undefined
): CompiledDoc['context'] {
  const destinations = frontmatter?.destinations as
    | Record<string, unknown>
    | undefined;
  const destinationConfig =
    (destinations?.[destinationId] as Record<string, unknown> | undefined) ||
    {};

  return {
    destinationId,
    config: {
      ...projectConfig,
      ...destinationConfig,
    },
  };
}

/**
 * Compiles a parsed Rulesets document for a specific destination.
 * For v0.1.0, this is a pass-through implementation that doesn't process markers.
 *
 * @param parsedDoc - The parsed document to compile
 * @param destinationId - The ID of the destination to compile for
 * @param projectConfig - Optional project configuration
 * @returns A promise that resolves to a CompiledDoc
 */
export function compile(
  parsedDoc: ParsedDoc,
  destinationId: string,
  projectConfig: Record<string, unknown> = {}
): CompiledDoc {
  const { source, ast } = parsedDoc;

  // Handle empty files consistently
  if (!source.content.trim()) {
    return createEmptyCompiledDoc(source, destinationId, projectConfig);
  }

  // Extract the body content (everything after frontmatter)
  const bodyContent = extractBodyContent(source.content, !!source.frontmatter);

  // Build the compiled document
  const compiledDoc: CompiledDoc = {
    source: {
      path: source.path,
      content: source.content,
      frontmatter: source.frontmatter,
    },
    ast: {
      sections: ast.sections, // Pass through from parser (empty for v0)
      imports: ast.imports, // Pass through from parser (empty for v0)
      variables: ast.variables, // Pass through from parser (empty for v0)
      markers: ast.markers, // Pass through from parser (empty for v0)
    },
    output: {
      content: bodyContent, // Raw body content for v0
      metadata: createOutputMetadata(source.frontmatter, destinationId),
    },
    context: createCompilationContext(
      destinationId,
      projectConfig,
      source.frontmatter
    ),
  };

  return compiledDoc;
}
