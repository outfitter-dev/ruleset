import type { Stats } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CompiledDoc,
  DestinationPlugin,
  JSONSchema7,
  Logger,
} from '../interfaces';

type WindsurfFormat = 'markdown' | 'xml';

type WindsurfConfig = {
  outputPath?: string;
  format?: WindsurfFormat;
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

  private static normaliseFormat(format: unknown): WindsurfFormat {
    return typeof format === 'string' && format.toLowerCase() === 'xml'
      ? 'xml'
      : 'markdown';
  }

  private static defaultFilename(format: WindsurfFormat): string {
    return format === 'xml' ? 'rules.xml' : 'rules.md';
  }

  private looksLikeDirectory(pathStr: string): boolean {
    const p = pathStr.trim();
    return p.endsWith('/') || p.endsWith(path.sep);
  }

  private async resolveOutputPath(
    outputPath: string,
    format: WindsurfFormat,
    logger: Logger
  ): Promise<string> {
    const resolvedPath = path.resolve(outputPath);

    let stats: Stats | null = null;
    try {
      stats = await fs.stat(resolvedPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    const isDir = stats?.isDirectory() ?? false;
    const looksLikeDir = this.looksLikeDirectory(outputPath);

    if (looksLikeDir && stats && !isDir) {
      throw new Error(
        `Output path "${outputPath}" looks like a directory but points to an existing file.`
      );
    }

    if (isDir || looksLikeDir) {
      const filename = WindsurfPlugin.defaultFilename(format);
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
      const err =
        error instanceof Error
          ? error
          : new Error(
              `Failed to create directory: ${dirPath}. ${String(error)}`
            );
      logger.error(err, { op: 'mkdir', path: dirPath, plugin: 'windsurf' });
      throw err;
    }
  }

  private async writeFile(
    filePath: string,
    content: string,
    logger: Logger
  ): Promise<void> {
    let tmpPath: string | undefined;
    try {
      tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
      await fs.writeFile(tmpPath, content, { encoding: 'utf8' });
      await fs.rename(tmpPath, filePath);
      logger.info(`Successfully wrote Windsurf rules to: ${filePath}`);
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(`Failed to write file: ${filePath}. ${String(error)}`);
      logger.error(err, { op: 'write', path: filePath, plugin: 'windsurf' });
      if (tmpPath) {
        try {
          await fs.rm(tmpPath, { force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
      throw err;
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
    const format = WindsurfPlugin.normaliseFormat(cfg.format);

    // Determine the output path
    const outputPath =
      typeof cfg.outputPath === 'string' && cfg.outputPath.trim() !== ''
        ? cfg.outputPath
        : destPath;

    const resolvedPath = await this.resolveOutputPath(
      outputPath,
      format,
      logger
    );
    logger.debug(`Writing Windsurf rules to: ${resolvedPath}`);

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    await this.ensureDirectory(dir, logger);

    // Write the content
    await this.writeFile(resolvedPath, compiled.output.content, logger);

    // Log additional context for debugging
    logger.debug('Destination resolved', {
      destinationId: compiled.context.destinationId,
    });
    logger.debug('Config:', {
      outputPath: cfg.outputPath,
      format,
    });
  }
}
