import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CompiledDoc,
  DestinationProvider,
  JSONSchema7,
  Logger,
  ParsedDoc,
} from '../interfaces';
import { buildHandlebarsOptions, readDestinationConfig } from './utils';

type AgentsMdConfig = {
  outputPath?: string;
};

export class AgentsMdProvider implements DestinationProvider {
  get name(): string {
    return 'agents-md';
  }

  configSchema(): JSONSchema7 {
    return {
      type: 'object',
      properties: {
        outputPath: {
          type: 'string',
          description: 'Path where the AGENTS.md file should be written',
        },
      },
      additionalProperties: true,
    };
  }

  async prepareCompilation({
    parsed,
    projectConfig: _projectConfig,
    logger,
  }: {
    parsed: ParsedDoc;
    projectConfig: Record<string, unknown>;
    logger: Logger;
  }) {
    const destinationConfig = readDestinationConfig(parsed, 'agents-md');
    return buildHandlebarsOptions({
      destinationId: 'agents-md',
      destinationConfig,
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
      typeof cfg.outputPath === 'string' ? cfg.outputPath.trim() : '';
    const outputSpecifier = rawOutput.length > 0 ? rawOutput : 'AGENTS.md';
    const outputPath = path.isAbsolute(outputSpecifier)
      ? outputSpecifier
      : path.resolve(resolvedBase, outputSpecifier);
    const dir = path.dirname(outputPath);

    logger.info('Writing agents-md rules', { outputPath });

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(outputPath, compiled.output.content, 'utf-8');
      logger.debug('Agents-md write complete', {
        destinationId: compiled.context.destinationId,
        outputPath,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(err, { provider: 'agents-md', op: 'write', path: outputPath });
      throw err;
    }
  }
}
