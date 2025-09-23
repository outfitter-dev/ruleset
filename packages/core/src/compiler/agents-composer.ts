import { promises as fs } from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { Logger, ParsedDoc, CompiledDoc } from '../interfaces';
import type { RulesetParser } from '../parser';
import { compile } from './index';

export interface AgentsComposerOptions {
  /**
   * Glob patterns to include source rules from
   */
  includeGlobs?: string[];

  /**
   * Base directory for glob resolution
   */
  baseDir?: string;

  /**
   * Project configuration to pass through
   */
  projectConfig?: Record<string, unknown>;

  /**
   * Logger instance
   */
  logger?: Logger;

  /**
   * Whether to deduplicate sections with the same heading
   */
  deduplicateHeadings?: boolean;

  /**
   * Handle @filename mentions
   */
  resolveFileReferences?: boolean;
}

export interface ComposedOutput {
  content: string;
  metadata: Record<string, unknown>;
  sources: string[];
}

export class AgentsComposer {
  private parser: RulesetParser;

  constructor(parser: RulesetParser) {
    this.parser = parser;
  }

  /**
   * Compose multiple rule files into a unified AGENTS.md output
   */
  async compose(options: AgentsComposerOptions = {}): Promise<ComposedOutput> {
    const {
      includeGlobs = ['.ruleset/rules/**/*.md', '.agents/rules/**/*.md'],
      baseDir = process.cwd(),
      projectConfig = {},
      logger,
      deduplicateHeadings = true,
      resolveFileReferences = true,
    } = options;

    logger?.info('Starting AGENTS composition', { includeGlobs, baseDir });

    // Find all matching files
    const files = await this.findSourceFiles(includeGlobs, baseDir, logger);
    if (files.length === 0) {
      logger?.warn('No source files found for AGENTS composition');
      return {
        content: '# AGENTS\n\nNo rule files found for composition.',
        metadata: {},
        sources: [],
      };
    }

    logger?.info(`Found ${files.length} source files`, { files: files.join(', ') });

    // Parse and compile all files
    const compiledDocs: Array<{ doc: CompiledDoc; filePath: string }> = [];
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = this.parser.parse(content, filePath);

        // Skip files that don't have rule metadata
        if (!this.hasRuleMetadata(parsed)) {
          logger?.debug(`Skipping ${filePath}: no rule metadata found`);
          continue;
        }

        // Compile for agents-md destination
        const compiled = compile(parsed, 'agents-md', projectConfig, { logger });
        compiledDocs.push({ doc: compiled, filePath });
      } catch (error) {
        logger?.error(`Failed to process ${filePath}: ${error}`);
        continue;
      }
    }

    if (compiledDocs.length === 0) {
      logger?.warn('No valid rule files found after parsing');
      return {
        content: '# AGENTS\n\nNo valid rule files found for composition.',
        metadata: {},
        sources: [],
      };
    }

    // Merge front matter
    const mergedMetadata = this.mergeFrontMatter(
      compiledDocs.map(({ doc }) => doc.source.frontmatter || {}),
      logger
    );

    // Compose content
    let composedContent = await this.composeContent(
      compiledDocs.map(({ doc, filePath }) => ({
        content: doc.output.content,
        metadata: doc.output.metadata || {},
        filePath,
      })),
      {
        deduplicateHeadings,
        resolveFileReferences,
        baseDir,
        logger,
      }
    );

    return {
      content: composedContent,
      metadata: mergedMetadata,
      sources: compiledDocs.map(({ filePath }) => filePath),
    };
  }

  /**
   * Find source files matching the given glob patterns
   */
  private async findSourceFiles(
    patterns: string[],
    baseDir: string,
    logger?: Logger
  ): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: baseDir,
          absolute: true,
          ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        });
        allFiles.push(...matches);
      } catch (error) {
        logger?.error(`Failed to glob pattern ${pattern}: ${error}`);
      }
    }

    // Deduplicate and sort
    return [...new Set(allFiles)].sort();
  }

  /**
   * Check if a parsed document has rule metadata indicating it's a source rule
   */
  private hasRuleMetadata(parsed: ParsedDoc): boolean {
    const frontmatter = parsed.source.frontmatter;
    if (!frontmatter || typeof frontmatter !== 'object') {
      return false;
    }

    // Check for rule.* metadata
    const rule = (frontmatter as Record<string, unknown>).rule;
    if (rule && typeof rule === 'object') {
      return true;
    }

    return false;
  }

  /**
   * Merge front matter from multiple documents
   */
  private mergeFrontMatter(
    frontmatters: Array<Record<string, unknown>>,
    logger?: Logger
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const frontmatter of frontmatters) {
      for (const [key, value] of Object.entries(frontmatter)) {
        if (merged[key] === undefined) {
          merged[key] = value;
        } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
          // Merge arrays
          const existingArray = merged[key] as unknown[];
          const newArray = value as unknown[];
          merged[key] = [...existingArray, ...newArray];
        } else if (
          typeof merged[key] === 'object' &&
          merged[key] !== null &&
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(merged[key]) &&
          !Array.isArray(value)
        ) {
          // Merge objects recursively, keeping first values on conflicts
          merged[key] = this.mergeObjectsRecursively(
            merged[key] as Record<string, unknown>,
            value as Record<string, unknown>,
            logger
          );
        } else if (merged[key] !== value) {
          // Conflict - keep first value but warn
          logger?.warn(`Front matter conflict for key "${key}", keeping first value`, {
            existing: merged[key],
            new: value,
          });
        }
      }
    }

    return merged;
  }

  /**
   * Recursively merge objects, keeping first values on conflicts
   */
  private mergeObjectsRecursively(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
    logger?: Logger
  ): Record<string, unknown> {
    const result = { ...existing };

    for (const [key, value] of Object.entries(incoming)) {
      if (result[key] === undefined) {
        result[key] = value;
      } else if (Array.isArray(result[key]) && Array.isArray(value)) {
        // Merge arrays
        const existingArray = result[key] as unknown[];
        const newArray = value as unknown[];
        result[key] = [...existingArray, ...newArray];
      } else if (
        typeof result[key] === 'object' &&
        result[key] !== null &&
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(result[key]) &&
        !Array.isArray(value)
      ) {
        // Recursively merge nested objects
        result[key] = this.mergeObjectsRecursively(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
          logger
        );
      } else if (result[key] !== value) {
        // Conflict - keep first value but warn
        logger?.warn(`Front matter conflict for nested key "${key}", keeping first value`, {
          existing: result[key],
          new: value,
        });
      }
    }

    return result;
  }

  /**
   * Compose content from multiple compiled documents
   */
  private async composeContent(
    docs: Array<{
      content: string;
      metadata: Record<string, unknown>;
      filePath: string;
    }>,
    options: {
      deduplicateHeadings?: boolean;
      resolveFileReferences?: boolean;
      baseDir?: string;
      logger?: Logger;
    }
  ): Promise<string> {
    const { deduplicateHeadings = true, resolveFileReferences = true, baseDir = process.cwd(), logger } = options;

    // Start with a main heading
    let composed = '# AGENTS\n\n';
    composed += `> This file is composed from ${docs.length} rule files.\n\n`;

    const seenHeadings = new Set<string>();

    for (const { content, filePath } of docs) {
      if (!content.trim()) {
        continue;
      }

      // Extract the relative path for source attribution
      const relativePath = path.relative(baseDir, filePath);

      // Add source attribution
      composed += `<!-- Source: ${relativePath} -->\n\n`;

      let processedContent = content;

      // Handle @filename references if enabled
      if (resolveFileReferences) {
        processedContent = await this.resolveFileReferences(processedContent, filePath, baseDir, logger);
      }

      // Handle heading deduplication if enabled
      if (deduplicateHeadings) {
        processedContent = this.deduplicateHeadings(processedContent, seenHeadings, logger);
      }

      composed += processedContent;

      // Ensure proper spacing between sections
      if (!processedContent.endsWith('\n\n')) {
        composed += '\n\n';
      }
    }

    return composed;
  }

  /**
   * Resolve @filename mentions in content
   */
  private async resolveFileReferences(
    content: string,
    sourceFilePath: string,
    baseDir: string,
    logger?: Logger
  ): Promise<string> {
    // Match @filename patterns
    const fileRefPattern = /@([a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9]+)?)/g;
    const matches = Array.from(content.matchAll(fileRefPattern));

    if (matches.length === 0) {
      return content;
    }

    let processedContent = content;

    // Process matches in reverse order to preserve string indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const fullMatch = match[0];
      const filename = match[1];
      const startIndex = match.index!;

      try {
        // Try to resolve the file relative to the source file
        const sourceDir = path.dirname(sourceFilePath);
        let resolvedPath: string;
        let found = false;

        // Check if it's already a path with extension
        if (path.extname(filename)) {
          const testPath = path.resolve(sourceDir, filename);
          try {
            await fs.access(testPath);
            resolvedPath = testPath;
            found = true;
          } catch {
            // Try relative to baseDir
            const basePath = path.resolve(baseDir, filename);
            try {
              await fs.access(basePath);
              resolvedPath = basePath;
              found = true;
            } catch {
              // File doesn't exist
            }
          }
        } else {
          // Try common extensions
          const extensions = ['.md', '.txt'];

          for (const ext of extensions) {
            const testPath = path.resolve(sourceDir, filename + ext);
            try {
              await fs.access(testPath);
              resolvedPath = testPath;
              found = true;
              break;
            } catch {
              // File doesn't exist, continue
            }
          }

          if (!found) {
            // Try relative to baseDir
            for (const ext of extensions) {
              const testPath = path.resolve(baseDir, filename + ext);
              try {
                await fs.access(testPath);
                resolvedPath = testPath;
                found = true;
                break;
              } catch {
                // File doesn't exist, continue
              }
            }
          }
        }

        if (found) {
          // For providers without native support, inline the content
          // For now, we'll convert to a relative link
          const relativePath = path.relative(baseDir, resolvedPath!);
          const replacement = `[${filename}](./${relativePath})`;

          processedContent = processedContent.slice(0, startIndex) +
                            replacement +
                            processedContent.slice(startIndex + fullMatch.length);
        } else {
          logger?.warn(`Could not resolve file reference: ${filename}`);
        }

      } catch (error) {
        logger?.error(`Failed to resolve file reference: ${filename}: ${error}`);
      }
    }

    return processedContent;
  }

  /**
   * Deduplicate headings in content
   */
  private deduplicateHeadings(
    content: string,
    seenHeadings: Set<string>,
    logger?: Logger
  ): string {
    const lines = content.split('\n');
    const processedLines: string[] = [];
    let inCodeBlock = false;
    let skipSection = false;
    let currentSectionHeading = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track code blocks to avoid processing headings inside them
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        processedLines.push(line);
        continue;
      }

      if (inCodeBlock) {
        processedLines.push(line);
        continue;
      }

      // Check if this is a heading
      const headingMatch = line.match(/^(#+)\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        const normalizedHeading = headingText.toLowerCase();

        if (seenHeadings.has(normalizedHeading)) {
          logger?.debug(`Skipping duplicate heading: ${headingText}`);
          skipSection = true;
          currentSectionHeading = headingText;

          // Skip until we find a heading of the same or higher level
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j];
            const nextHeadingMatch = nextLine.match(/^(#+)\s+(.+)$/);
            if (nextHeadingMatch && nextHeadingMatch[1].length <= level) {
              break;
            }
            j++;
          }
          i = j - 1; // Will be incremented by for loop
          continue;
        } else {
          seenHeadings.add(normalizedHeading);
          skipSection = false;
        }
      }

      if (!skipSection) {
        processedLines.push(line);
      }
    }

    return processedLines.join('\n');
  }
}