import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildHandlebarsOptions,
  resolveProviderSettings,
} from "@ruleset/providers";
import type {
  CompiledDoc,
  DestinationProvider,
  JSONSchema7,
  Logger,
  ParsedDoc,
} from "../interfaces";
import { extractFrontmatter } from "./frontmatter";

export class CursorProvider implements DestinationProvider {
  get name(): string {
    return "cursor";
  }

  configSchema(): JSONSchema7 {
    return {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          description: "Path where the compiled rules file should be written",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Priority level for the rules",
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
    try {
      const frontmatter = extractFrontmatter(parsed);
      const settings = frontmatter
        ? resolveProviderSettings(frontmatter, "cursor")
        : undefined;
      return buildHandlebarsOptions({
        providerId: "cursor",
        config: settings?.config,
        logger,
      });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to prepare Cursor provider compilation options", {
        destination: this.name,
        error: failure.message,
      });
      throw failure;
    }
  }

  // TODO: Add Cursor-specific formatting and transformations
  async write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void> {
    const { compiled, destPath, config, logger } = ctx;

    logger.info(`Writing Cursor rules to: ${destPath}`);

    // Determine the output path with runtime type-narrowing
    const rawOutputPath = (config as { outputPath?: unknown })?.outputPath;
    const outputPath =
      typeof rawOutputPath === "string" && rawOutputPath.trim().length > 0
        ? rawOutputPath
        : destPath;
    const resolvedPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(outputPath);

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to create directory for Cursor provider", {
        destination: this.name,
        path: dir,
        error: failure.message,
      });
      throw failure;
    }

    // For v0, write the raw content
    try {
      await fs.writeFile(resolvedPath, compiled.output.content, {
        encoding: "utf8",
      });
      logger.info(`Successfully wrote Cursor rules to: ${resolvedPath}`);

      // Log additional context for debugging
      logger.debug(`Destination: ${compiled.context.destinationId}`);
      logger.debug(`Config: ${JSON.stringify(config)}`);
      if (compiled.output.metadata?.priority) {
        logger.debug(`Priority: ${compiled.output.metadata.priority}`);
      }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to write Cursor rules", {
        destination: this.name,
        path: resolvedPath,
        error: failure.message,
      });
      throw failure;
    }
  }
}
