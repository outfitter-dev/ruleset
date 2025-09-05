import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CompiledDoc,
  DestinationPlugin,
  JSONSchema7,
  Logger,
} from '../interfaces';

// TLDR: Writes compiled content to a Claude Code-compatible markdown file (mixd-v0)
export class ClaudeCodePlugin implements DestinationPlugin {
  get name(): string {
    return 'claude-code';
  }

  configSchema(): JSONSchema7 {
    return {
      type: 'object',
      properties: {
        outputPath: {
          type: 'string',
          description: 'Path where the compiled rules file should be written',
        },
      },
      additionalProperties: true,
    };
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
      typeof cfg.outputPath === 'string' && cfg.outputPath.trim() !== ''
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
      logger.error(`Failed to create directory: ${dir}`, error);
      throw error;
    }

    try {
      await fs.writeFile(resolvedPath, compiled.output.content, {
        encoding: 'utf8',
      });
      logger.info(`Successfully wrote Claude Code rules to: ${resolvedPath}`);
      logger.debug(`Destination: ${compiled.context.destinationId}`);
      logger.debug(`Config: ${JSON.stringify(config)}`);
    } catch (error) {
      logger.error(`Failed to write file: ${resolvedPath}`, error);
      throw error;
    }
  }
}
