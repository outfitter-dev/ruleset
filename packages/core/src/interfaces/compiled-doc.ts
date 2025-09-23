/**
 * Represents the structure of a parsed Rulesets section.
 * For v0.1.0, this will be minimal as sections are not processed from the body.
 */
export type Section = {
  name: string;
  properties?: Record<string, unknown>;
  content?: string;
  rawMarker?: string;
};

/**
 * Represents the structure of a parsed Rulesets import.
 * For v0.1.0, this will be minimal.
 */
export type Import = {
  path: string;
  // properties: Record<string, any>; // To be detailed in v0.1+
  // rawMarker: string; // To be detailed in v0.1+
};

/**
 * Represents the structure of a parsed Rulesets variable.
 * For v0.1.0, this will be minimal.
 */
export type Variable = {
  name: string;
  // rawMarker: string; // To be detailed in v0.1+
};

/**
 * Represents the structure of a generic Rulesets marker.
 * For v0.1.0, this will be minimal.
 */
export type Marker = {
  type: 'section' | 'import' | 'variable' | 'unknown';
  // rawMarker: string; // To be detailed in v0.1+
  // position: { line: number, column: number }; // To be detailed in v0.1+
};

/**
 * Represents a document that has been parsed by the Rulesets parser.
 * This is an intermediate representation before full compilation.
 */
export type ParsedDoc = {
  source: {
    path?: string; // Original source file path, if applicable
    content: string; // Raw source content
    frontmatter?: Record<string, unknown>; // Parsed frontmatter data
  };
  ast: {
    // Abstract Syntax Tree - minimal for v0
    sections: Section[];
    imports: Import[];
    variables: Variable[];
    markers: Marker[]; // All markers found - empty for v0 body processing
  };
  errors?: Array<{ message: string; line?: number; column?: number }>; // Parsing errors
};

/**
 * Represents a document that has been compiled for a specific destination.
 * This is the primary data structure passed to destination providers.
 */
export type CompiledDoc = {
  /** Original source content and metadata */
  source: {
    path?: string; // Original source file path, if applicable
    content: string; // Raw source content
    frontmatter?: Record<string, unknown>; // Parsed frontmatter data
  };

  /**
   * Parsed representation of the source document.
   * For v0.1.0, `sections`, `imports`, `variables`, and `markers` will be empty
   * or reflect only what might be in frontmatter if we decide to parse that deep.
   * The primary focus for v0.1.0 body content is that it's not processed for markers.
   */
  ast: {
    sections: Section[]; // Array of parsed sections (empty for v0 body)
    imports: Import[]; // Array of parsed imports (empty for v0 body)
    variables: Variable[]; // Array of parsed variables (empty for v0 body)
    markers: Marker[]; // All markers found in the document (empty for v0 body)
  };

  /** Destination-specific output */
  output: {
    content: string; // Transformed content for the destination (raw body for v0)
    metadata?: Record<string, unknown>; // Any metadata needed by the destination (e.g., derived from frontmatter)
  };

  /** Additional context for the compilation */
  context: {
    destinationId: string; // Current destination being compiled for
    config: Record<string, unknown>; // Resolved configuration for this compilation (e.g., project config, destination-specific config)
  };
};
