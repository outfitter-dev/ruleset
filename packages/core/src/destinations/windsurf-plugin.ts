import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CompiledDoc,
  DestinationPlugin,
  JSONSchema7,
  Logger,
} from '../interfaces';

export class WindsurfPlugin implements DestinationPlugin {
  get name(): string {
    return 'windsurf';
  }

  configSchema(): JSONSchema7 {
    return {
      type: 'object',
      properties: {
        outputPath: {
          type: 'string',
          description: 'Path where the compiled rules file should be written',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'xml'],
          default: 'markdown',
          description: 'Output format for Windsurf rules',
        },
      },
      additionalProperties: true,
    };
  }

  // TODO: Add Windsurf-specific formatting and transformations
  async write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void> {
    const { compiled, destPath, config, logger } = ctx;

    // Determine the output path with local type-narrowing
    type WindsurfConfig = {
      outputPath?: string;
      format?: 'markdown' | 'xml' | string;
    };
    const cfg = config as WindsurfConfig;
    const outputPath =
      typeof cfg.outputPath === 'string' && cfg.outputPath.trim() !== ''
        ? cfg.outputPath
        : destPath;
    let resolvedPath = path.resolve(outputPath);

    // Check if destPath is a directory and append default filename
    try {
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        resolvedPath = path.join(resolvedPath, 'rules.md');
        logger.debug(`Directory detected, using filename: ${resolvedPath}`);
      }
    } catch {
      // File/directory doesn't exist yet - check if path looks like a directory
      if (outputPath.endsWith('/') || outputPath.endsWith(path.sep)) {
        resolvedPath = path.join(resolvedPath, 'rules.md');
        logger.debug(
          `Directory path detected, using filename: ${resolvedPath}`
        );
      }
    }

    logger.info(`Writing Windsurf rules to: ${resolvedPath}`);

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory: ${dir}`);
      throw error;
    }

    // For v0, write the raw content
    try {
      await fs.writeFile(resolvedPath, compiled.output.content, {
        encoding: 'utf8',
      });
      logger.info(`Successfully wrote Windsurf rules to: ${resolvedPath}`);

      // Log additional context for debugging
      logger.debug(`Destination: ${compiled.context.destinationId}`);
      logger.debug(`Config: ${JSON.stringify(config)}`);
      logger.debug(
        `Format: ${typeof cfg.format === 'string' ? cfg.format : 'markdown'}`
      );
    } catch (error) {
      logger.error(`Failed to write file: ${resolvedPath}`);
      throw error;
    }
  }
}
