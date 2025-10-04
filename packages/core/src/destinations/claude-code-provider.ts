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

/**
 * Destination provider that renders compiled rules for Claude Code. The
 * implementation simply writes Markdown content to the configured output path.
 */
export class ClaudeCodeProvider implements DestinationProvider {
  get name(): string {
    return "claude-code";
  }

  configSchema(): JSONSchema7 {
    return {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          description: "Path where the compiled rules file should be written",
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
      ? resolveProviderSettings(frontmatter, "claude-code")
      : undefined;
    return buildHandlebarsOptions({
      providerId: "claude-code",
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

    // Determine the output path with local type-narrowing
    type ClaudeConfig = {
      outputPath?: string;
    };
    const cfg = config as ClaudeConfig;
    const outputPath =
      typeof cfg.outputPath === "string" && cfg.outputPath.trim() !== ""
        ? cfg.outputPath
        : destPath;
    const resolvedPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(outputPath);

    logger.info(`Writing Claude Code rules to: ${resolvedPath}`);

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error(
        `Failed to create directory: ${dir}. ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }

    try {
      await fs.writeFile(resolvedPath, compiled.output.content, {
        encoding: "utf8",
      });
      logger.info(`Successfully wrote Claude Code rules to: ${resolvedPath}`);
      logger.debug(`Destination: ${compiled.context.destinationId}`);
      logger.debug(`Config: ${JSON.stringify(config)}`);
    } catch (error) {
      logger.error(
        `Failed to write file: ${resolvedPath}. ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
