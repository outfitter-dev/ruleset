import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CompiledDoc,
  DestinationPlugin,
  JSONSchema7,
  Logger,
} from '../interfaces';

type CopilotConfig = {
  outputPath?: string;
};

export class CopilotPlugin implements DestinationPlugin {
  get name(): string {
    return 'copilot';
  }

  configSchema(): JSONSchema7 {
    return {
      type: 'object',
      properties: {
        outputPath: {
          type: 'string',
          description: 'Path where the copilot rules should be written',
        },
      },
      additionalProperties: false,
    };
  }

  private async pathLooksLikeDirectory(candidate: string): Promise<boolean> {
    if (candidate.endsWith(path.sep)) {
      return true;
    }
    try {
      const stats = await fs.stat(candidate);
      return stats.isDirectory();
    } catch {
      return path.extname(candidate) === '';
    }
  }

  private async resolveOutputPath(opts: {
    baseDir: string;
    rawOutput: string;
    destHasExt: boolean;
    resolvedDest: string;
    fallbackName: string;
  }): Promise<string> {
    const { baseDir, rawOutput, destHasExt, resolvedDest, fallbackName } = opts;
    if (rawOutput.length === 0) {
      return destHasExt
        ? resolvedDest
        : path.resolve(resolvedDest, fallbackName);
    }

    const resolvedRaw = path.isAbsolute(rawOutput)
      ? rawOutput
      : path.resolve(baseDir, rawOutput);

    if (await this.pathLooksLikeDirectory(resolvedRaw)) {
      return path.resolve(resolvedRaw, fallbackName);
    }

    return resolvedRaw;
  }

  async write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void> {
    const { compiled, destPath, config, logger } = ctx;
    const cfg = config as CopilotConfig;

    const resolvedDest = path.isAbsolute(destPath)
      ? destPath
      : path.resolve(destPath);
    const destHasExt = path.extname(resolvedDest).length > 0;
    const baseDir = destHasExt ? path.dirname(resolvedDest) : resolvedDest;

    const rawOutput =
      typeof cfg.outputPath === 'string' ? cfg.outputPath.trim() : '';
    const rawName = compiled.source.path
      ? path.basename(compiled.source.path)
      : 'instructions';
    const fallbackName = path.extname(rawName) ? rawName : `${rawName}.md`;

    const outputPath = await this.resolveOutputPath({
      baseDir,
      rawOutput,
      destHasExt,
      resolvedDest,
      fallbackName,
    });

    const dir = path.dirname(outputPath);

    logger.info('Writing copilot rules', {
      outputPath,
      destinationId: compiled.context.destinationId,
    });

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(outputPath, compiled.output.content, 'utf-8');
      logger.debug('Copilot write complete', {
        destinationId: compiled.context.destinationId,
        outputPath,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(err, { plugin: 'copilot', op: 'write', path: outputPath });
      throw err;
    }
  }
}
