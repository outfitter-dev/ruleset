import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CompiledDoc,
  DestinationPlugin,
  JSONSchema7,
  Logger,
} from '../interfaces';

export class AgentsMdPlugin implements DestinationPlugin {
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

  async write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void> {
    const { compiled, destPath, logger } = ctx;

    // Agents.md uses standard markdown format at project root
    const outputPath = path.join(destPath, 'AGENTS.md');
    const dir = path.dirname(outputPath);

    logger.info(`Writing agents-md rules to ${outputPath}`);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, compiled.output.content, 'utf-8');
  }
}
