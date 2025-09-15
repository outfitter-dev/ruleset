import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CompiledDoc,
  DestinationPlugin,
  JSONSchema7,
  Logger,
} from '../interfaces';

type WindsurfConfig = {
  outputPath?: string;
  format?: 'markdown' | 'xml' | string;
};

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

  private getDefaultFilename(format: string | undefined): string {
    return format?.toLowerCase() === 'xml' ? 'rules.xml' : 'rules.md';
  }

  private async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private looksLikeDirectory(pathStr: string): boolean {
    return pathStr.endsWith('/') || pathStr.endsWith(path.sep);
  }

  private async resolveOutputPath(
    outputPath: string,
    config: WindsurfConfig,
    logger: Logger
  ): Promise<string> {
    const resolvedPath = path.resolve(outputPath);

    const isDir = await this.isDirectory(resolvedPath);
    const looksLikeDir = this.looksLikeDirectory(outputPath);

    if (isDir || looksLikeDir) {
      const filename = this.getDefaultFilename(config.format);
      const finalPath = path.join(resolvedPath, filename);
      const message = isDir
        ? `Directory detected, using filename: ${finalPath}`
        : `Directory path detected, using filename: ${finalPath}`;
      logger.debug(message);
      return finalPath;
    }

    return resolvedPath;
  }

  private async ensureDirectory(
    dirPath: string,
    logger: Logger
  ): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(
        `Failed to create directory: ${dirPath}. ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async writeFile(
    filePath: string,
    content: string,
    logger: Logger
  ): Promise<void> {
    try {
      await fs.writeFile(filePath, content, { encoding: 'utf8' });
      logger.info(`Successfully wrote Windsurf rules to: ${filePath}`);
    } catch (error) {
      logger.error(
        `Failed to write file: ${filePath}. ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  // TODO: Add Windsurf-specific formatting and transformations
  async write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void> {
    const { compiled, destPath, config, logger } = ctx;
    const cfg = config as WindsurfConfig;

    // Determine the output path
    const outputPath =
      typeof cfg.outputPath === 'string' && cfg.outputPath.trim() !== ''
        ? cfg.outputPath
        : destPath;

    const resolvedPath = await this.resolveOutputPath(outputPath, cfg, logger);
    logger.info(`Writing Windsurf rules to: ${resolvedPath}`);

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    await this.ensureDirectory(dir, logger);

    // Write the content
    await this.writeFile(resolvedPath, compiled.output.content, logger);

    // Log additional context for debugging
    logger.debug(`Destination: ${compiled.context.destinationId}`);
    logger.debug(`Config: ${JSON.stringify(config)}`);
    logger.debug(
      `Format: ${typeof cfg.format === 'string' ? cfg.format : 'markdown'}`
    );
  }
}
