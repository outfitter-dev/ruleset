import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildHandlebarsOptions,
  resolveProviderSettings,
} from "@rulesets/providers";
import type { JsonValue } from "@rulesets/types";
import { AgentsComposer } from "../compiler/agents-composer";
import type {
  CompiledDoc,
  DestinationProvider,
  JSONSchema7,
  Logger,
  ParsedDoc,
} from "../interfaces";
import { RulesetParser } from "../parser";
import { extractFrontmatter } from "./frontmatter";

type AgentsMdConfig = {
  outputPath?: string;
  useComposer?: boolean;
  includeGlobs?: string[];
  deduplicateHeadings?: boolean;
  resolveFileReferences?: boolean;
  detectSymlinks?: boolean;
};

export class AgentsMdProvider implements DestinationProvider {
  get name(): string {
    return "agents-md";
  }

  configSchema(): JSONSchema7 {
    return {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          description: "Path where the AGENTS.md file should be written",
        },
        useComposer: {
          type: "boolean",
          description:
            "Whether to use the AGENTS composer to aggregate multiple rules",
          default: false,
        },
        includeGlobs: {
          type: "array",
          items: { type: "string" },
          description: "Glob patterns to include when using composer",
        },
        deduplicateHeadings: {
          type: "boolean",
          description: "Whether to deduplicate sections with same headings",
          default: true,
        },
        resolveFileReferences: {
          type: "boolean",
          description: "Whether to resolve @filename mentions",
          default: true,
        },
        detectSymlinks: {
          type: "boolean",
          description: "Whether to detect and replace symlinked files",
          default: true,
        },
      },
      additionalProperties: true,
    };
  }

  prepareCompilation({
    parsed,
    projectConfig: _projectConfig,
    logger,
  }: {
    parsed: ParsedDoc;
    projectConfig: Record<string, unknown>;
    logger: Logger;
  }) {
    const frontmatter = extractFrontmatter(parsed);
    const settings = frontmatter
      ? resolveProviderSettings(frontmatter, "agents-md")
      : undefined;
    return buildHandlebarsOptions({
      providerId: "agents-md",
      config: settings?.config,
      logger,
    });
  }

  async write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void> {
    const { compiled, destPath, config, logger } = ctx;
    const cfg = config as AgentsMdConfig;

    const basePath =
      path.extname(destPath).length > 0 ? path.dirname(destPath) : destPath;
    const resolvedBase = path.isAbsolute(basePath)
      ? basePath
      : path.resolve(basePath);

    const rawOutput =
      typeof cfg.outputPath === "string" ? cfg.outputPath.trim() : "";
    const outputSpecifier = rawOutput.length > 0 ? rawOutput : "AGENTS.md";
    const outputPath = path.isAbsolute(outputSpecifier)
      ? outputSpecifier
      : path.resolve(resolvedBase, outputSpecifier);
    const _dir = path.dirname(outputPath);

    // Handle symlink detection if enabled
    let finalOutputPath = outputPath;
    if (cfg.detectSymlinks !== false) {
      finalOutputPath = await this.resolveSymlinks(outputPath, logger);
    }

    // Determine content to write
    let contentToWrite = compiled.output.content;
    let metadata =
      compiled.output.metadata ?? ({} as Record<string, JsonValue>);

    // Use composer if enabled
    if (cfg.useComposer) {
      logger.info("Using AGENTS composer to aggregate rules");

      const composer = new AgentsComposer(new RulesetParser());
      const composedOutput = await composer.compose({
        includeGlobs: cfg.includeGlobs,
        baseDir: resolvedBase,
        projectConfig: compiled.context.config,
        logger,
        deduplicateHeadings: cfg.deduplicateHeadings,
        resolveFileReferences: cfg.resolveFileReferences,
      });

      contentToWrite = composedOutput.content;
      metadata = {
        ...metadata,
        ...composedOutput.metadata,
      };

      logger.info(
        `Composed content from ${composedOutput.sources.length} source files`,
        {
          sources: composedOutput.sources,
        }
      );
    }

    logger.info("Writing agents-md rules", { outputPath: finalOutputPath });

    try {
      await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });
      await fs.writeFile(finalOutputPath, contentToWrite, "utf-8");
      logger.debug("Agents-md write complete", {
        destinationId: compiled.context.destinationId,
        outputPath: finalOutputPath,
        metadata,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(err, {
        provider: "agents-md",
        op: "write",
        path: finalOutputPath,
      });
      throw err;
    }
  }

  /**
   * Resolve symlinks and return the actual path to write to
   */
  private async resolveSymlinks(
    outputPath: string,
    logger: Logger
  ): Promise<string> {
    try {
      const stats = await fs.lstat(outputPath);
      if (stats.isSymbolicLink()) {
        const realPath = await fs.realpath(outputPath);
        logger.info("Detected symlink, writing to real path", {
          symlink: outputPath,
          realPath,
        });
        return realPath;
      }
    } catch (_error) {
      // File doesn't exist yet, or other error - use original path
      logger.debug(`No existing symlink at ${outputPath}`);
    }

    return outputPath;
  }
}
