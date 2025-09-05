import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CompiledDoc,
  DestinationPlugin,
  JSONSchema7,
  Logger,
} from '../interfaces';

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
      additionalProperties: true,
    };
  }

  async write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void> {
    const { compiled, destPath, logger } = ctx;

    // GitHub Copilot uses markdown files in .github/copilot directory
    const fileName =
      compiled.source.path?.split('/').pop() || 'instructions.md';
    const outputPath = path.join(destPath, '.github', 'copilot', fileName);
    const dir = path.dirname(outputPath);

    logger.info(`Writing copilot rules to ${outputPath}`);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, compiled.output.content, 'utf-8');
  }
}
