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
    const fallbackName = compiled.source.path
      ? path.basename(compiled.source.path)
      : 'instructions.md';

    let outputPath: string;
    if (rawOutput.length > 0) {
      outputPath = path.isAbsolute(rawOutput)
        ? rawOutput
        : path.resolve(baseDir, rawOutput);
    } else if (destHasExt) {
      outputPath = resolvedDest;
    } else {
      outputPath = path.resolve(resolvedDest, fallbackName);
    }

    const dir = path.dirname(outputPath);

    logger.info('Writing copilot rules', { outputPath });

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
