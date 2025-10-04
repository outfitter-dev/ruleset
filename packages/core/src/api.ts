import { promises as fs } from "node:fs";
import path from "node:path";
import { compile } from "./compiler";
import { loadProjectConfig } from "./config/project-config";
import { destinations } from "./destinations";
import { createDefaultLogger, type Logger } from "./interfaces/logger";
import { type LinterConfig, lint } from "./linter";
import { parse } from "./parser";
import {
  isPathWithinBoundary,
  isPathWithinBoundaryReal,
  sanitizePath,
} from "./utils/security";

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.hasOwn(value, key);

/**
 * High-level options for compilation operations.
 */
export type CompilationOptions = {
  /** Source directory or file to compile */
  source?: string;
  /** Output directory for compiled files */
  output?: string;
  /** Specific destination to compile for (omit for all destinations) */
  destination?: string;
  /** Project config file path (optional) */
  configPath?: string;
  /** Logger instance (defaults to StructuredLogger) */
  logger?: Logger;
  /** Whether to validate files before compilation */
  lint?: boolean;
  /** Linter configuration */
  linterConfig?: Partial<LinterConfig>;
};

/**
 * Result of a compilation operation.
 */
export type CompilationResult = {
  /** Number of files successfully compiled */
  compiledCount: number;
  /** Total number of files processed */
  totalFiles: number;
  /** Compilation errors encountered */
  errors: Array<{
    file: string;
    message: string;
    error: Error;
  }>;
  /** Project configuration used */
  projectConfig: Record<string, unknown>;
  /** Output directory used */
  outputPath: string;
};

/**
 * Options for discovering rules files.
 */
export type FileDiscoveryOptions = {
  /** Base directory to search from */
  basePath: string;
  /** Glob patterns to filter files */
  globs?: string[];
  /** Logger instance */
  logger?: Logger;
};

/**
 * Supported file extensions for rules files.
 */
const SUPPORTED_EXTENSIONS = [".md"] as const;

/**
 * Check if a file has a supported extension.
 */
function hasSupportedExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Create glob matchers from patterns.
 */
function createGlobMatchers(patterns: string[]): Bun.Glob[] {
  return patterns.map((pattern) => new Bun.Glob(pattern.trim()));
}

/**
 * Discover rules files in a directory or validate a single file.
 */
export async function discoverRulesFiles(
  options: FileDiscoveryOptions
): Promise<string[]> {
  const { basePath, globs, logger } = options;
  const resolvedPath = path.resolve(basePath);

  if (
    !(await fs
      .stat(resolvedPath)
      .then((s) => s.isDirectory())
      .catch(() => false))
  ) {
    // Single file
    if (!hasSupportedExtension(resolvedPath)) {
      return [];
    }

    const fileName = path.basename(resolvedPath);
    if (fileName.startsWith("@")) {
      return []; // Skip partial files
    }

    // Apply glob filtering if provided
    if (globs && globs.length > 0) {
      const matchers = createGlobMatchers(globs);
      const relativePath = path.basename(resolvedPath);
      const matches = matchers.some((glob) => glob.match(relativePath));
      if (!matches) {
        return [];
      }
    }

    return [resolvedPath];
  }

  // Directory traversal
  const files: string[] = [];
  const matchers =
    globs && globs.length > 0 ? createGlobMatchers(globs) : undefined;

  async function walkDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walkDirectory(fullPath);
      } else if (entry.isFile() && hasSupportedExtension(fullPath)) {
        if (entry.name.startsWith("@")) {
          continue; // Skip partial files
        }

        // Apply glob filtering if provided
        if (matchers) {
          const relativePath = path
            .relative(resolvedPath, fullPath)
            .split(path.sep)
            .join("/");
          const matches = matchers.some((glob) => glob.match(relativePath));
          if (!matches) {
            continue;
          }
        }

        files.push(fullPath);
      }
    }
  }

  await walkDirectory(resolvedPath);
  logger?.debug(`Discovered ${files.length} rules files in ${resolvedPath}`);
  return files;
}

/**
 * Compile rules files from source to destination outputs.
 *
 * This is the high-level API that CLI commands should use instead of
 * directly importing internal functions.
 */
export async function compileRules(
  options: CompilationOptions = {}
): Promise<CompilationResult> {
  const {
    source = "./.ruleset/rules",
    output = "./.ruleset/dist",
    destination,
    configPath,
    logger = createDefaultLogger(),
    lint: shouldLint = false,
    linterConfig = {},
  } = options;

  const cwd = process.cwd();

  // Sanitize and resolve paths
  const sourcePath = path.resolve(cwd, sanitizePath(source));
  const outputPath = path.resolve(cwd, sanitizePath(output));

  // Validate paths are within project boundaries
  if (!isPathWithinBoundary(sourcePath, cwd)) {
    throw new Error(`Source path '${source}' is outside project directory`);
  }
  if (!isPathWithinBoundary(outputPath, cwd)) {
    throw new Error(`Output path '${output}' is outside project directory`);
  }

  const [sourceWithinReal, outputWithinReal] = await Promise.all([
    isPathWithinBoundaryReal(sourcePath, cwd),
    isPathWithinBoundaryReal(outputPath, cwd),
  ]);

  if (!sourceWithinReal) {
    throw new Error(
      `Source path '${source}' resolves outside project directory`
    );
  }
  if (!outputWithinReal) {
    throw new Error(
      `Output path '${output}' resolves outside project directory`
    );
  }

  // Load project configuration
  const projectConfigResult = await loadProjectConfig({
    startPath: sourcePath,
    configPath,
  });

  const projectConfig = projectConfigResult.config;

  // Determine source directories to process
  const configSources = Array.isArray(projectConfig.sources)
    ? projectConfig.sources
        .map((s) => (typeof s === "string" ? s.trim() : null))
        .filter((s): s is string => Boolean(s && s.length > 0))
    : undefined;

  // Use config sources if using default source and config has sources
  const sourcesToProcess =
    source === "./.ruleset/rules" && configSources && configSources.length > 0
      ? configSources
      : [source];

  // Extract rule-level globs from project config
  const ruleSection = projectConfig.rule;
  const ruleGlobs =
    ruleSection &&
    typeof ruleSection === "object" &&
    !Array.isArray(ruleSection) &&
    Array.isArray((ruleSection as Record<string, unknown>).globs)
      ? ((ruleSection as Record<string, unknown>).globs as unknown[]).filter(
          (g): g is string => typeof g === "string" && g.trim().length > 0
        )
      : undefined;

  // Discover files from all sources
  const allFiles: string[] = [];
  for (const sourceDir of sourcesToProcess) {
    const resolvedSourceDir = path.resolve(cwd, sanitizePath(sourceDir));
    const files = await discoverRulesFiles({
      basePath: resolvedSourceDir,
      globs: ruleGlobs,
      logger,
    });
    allFiles.push(...files);
  }

  // Remove duplicates
  const uniqueFiles = Array.from(new Set(allFiles));

  if (uniqueFiles.length === 0) {
    logger.info("No rules files found to compile");
    return {
      compiledCount: 0,
      totalFiles: 0,
      errors: [],
      projectConfig,
      outputPath,
    };
  }

  // Determine destinations
  const targetDestinations = destination
    ? [destination]
    : Array.from(destinations.keys());

  const errors: CompilationResult["errors"] = [];
  let compiledCount = 0;

  for (const filePath of uniqueFiles) {
    try {
      // Read and parse file
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = parse(content);

      // Check if file has required frontmatter
      const frontmatter = parsed.source.frontmatter;
      const hasRuleFrontmatter =
        frontmatter &&
        typeof frontmatter === "object" &&
        !Array.isArray(frontmatter) &&
        hasOwn(frontmatter, "rule");

      if (!hasRuleFrontmatter) {
        logger.debug(
          `Skipping ${path.basename(filePath)} (missing rule frontmatter)`
        );
        continue;
      }

      // Lint if requested
      if (shouldLint) {
        const lintResults = lint(parsed, {
          requireRulesetsVersion: true,
          allowedDestinations: Array.from(destinations.keys()),
          ...linterConfig,
        });

        for (const result of lintResults) {
          if (result.severity === "error") {
            logger.error(`${filePath}: ${result.message}`);
          } else if (result.severity === "warning") {
            logger.warn(`${filePath}: ${result.message}`);
          }
        }
      }

      // Compile for each destination
      for (const destId of targetDestinations) {
        if (!destinations.has(destId)) {
          logger.warn(`No provider registered for destination: ${destId}`);
          continue;
        }

        const compiled = compile(parsed, destId, projectConfig);

        // Determine output file path
        const relativePath = path.relative(cwd, filePath);
        const outputName = `${path.basename(relativePath, path.extname(relativePath))}.md`;
        const destOutputPath = path.join(outputPath, destId, outputName);

        // Ensure output directory exists
        await fs.mkdir(path.dirname(destOutputPath), { recursive: true });

        // Write compiled content
        await fs.writeFile(destOutputPath, compiled.output.content, "utf8");

        compiledCount++;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({
        file: filePath,
        message: err.message,
        error: err,
      });
      logger.error(`Failed to compile ${filePath}: ${err.message}`);
    }
  }

  logger.info(
    `Compiled ${compiledCount} file(s) from ${uniqueFiles.length} source file(s)`
  );

  return {
    compiledCount,
    totalFiles: uniqueFiles.length,
    errors,
    projectConfig,
    outputPath,
  };
}

/**
 * Initialize a new rulesets project structure.
 */
export type InitializationOptions = {
  /** Base directory to initialize in */
  baseDir?: string;
  /** Whether to create example files */
  createExamples?: boolean;
  /** Logger instance */
  logger?: Logger;
};

export async function initializeProject(
  options: InitializationOptions = {}
): Promise<void> {
  const {
    baseDir = process.cwd(),
    createExamples = true,
    logger = createDefaultLogger(),
  } = options;

  const rulesetDir = path.join(baseDir, ".ruleset");
  const rulesDir = path.join(rulesetDir, "rules");
  const distDir = path.join(rulesetDir, "dist");
  const partialsDir = path.join(rulesetDir, "partials");

  // Create directory structure
  await fs.mkdir(rulesDir, { recursive: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.mkdir(partialsDir, { recursive: true });

  // Create default config
  const configPath = path.join(rulesetDir, "config.yaml");
  const defaultConfig = `# Rulesets configuration (YAML)
sources:
  - .ruleset/rules
  - .agents/rules

rule:
  version: "0.2.0"
  template: false

cursor:
  enabled: true

windsurf:
  enabled: true

claude-code:
  enabled: true
`;

  await fs.writeFile(configPath, defaultConfig, "utf8");
  logger.info(
    `Created configuration file: ${path.relative(baseDir, configPath)}`
  );

  if (createExamples) {
    // Create example rule file
    const exampleRulePath = path.join(rulesDir, "example.rule.md");
    const exampleContent = `---
rule:
  version: "0.2.0"
description: Example rule file for your project
created: "${new Date().toISOString()}"
labels:
  - example
  - getting-started
---

# Example Rules

This is an example rules file. You can write your project-specific rules here using standard Markdown.

## Instructions

- Follow the project coding standards
- Write comprehensive tests
- Document your changes

## Code Style

- Use meaningful variable names
- Keep functions small and focused
- Add comments for complex logic
`;

    await fs.writeFile(exampleRulePath, exampleContent, "utf8");
    logger.info(
      `Created example rule: ${path.relative(baseDir, exampleRulePath)}`
    );

    // Create example partial
    const examplePartialPath = path.join(partialsDir, "legal.md");
    const partialContent = `## Legal Notice

This project is for demonstration purposes. Please review and update legal requirements for your specific use case.
`;

    await fs.writeFile(examplePartialPath, partialContent, "utf8");
    logger.info(
      `Created example partial: ${path.relative(baseDir, examplePartialPath)}`
    );
  }

  logger.info("Project initialization complete!");
}
