import type { Stats } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledDoc, Logger } from '../../interfaces';
import { CopilotPlugin } from '../copilot-plugin';

describe('CopilotPlugin', () => {
  const plugin = new CopilotPlugin();
  const compiled: CompiledDoc = {
    source: {
      path: path.join('rules', 'guide.md'),
      content: '# content',
      frontmatter: {},
    },
    ast: { stems: [], imports: [], variables: [], markers: [] },
    output: { content: 'compiled content' },
    context: { destinationId: 'copilot', config: {} },
  };

  let writeFileSpy: ReturnType<typeof vi.spyOn>;
  let statSpy: ReturnType<typeof vi.spyOn>;
  let logger: Logger;

  beforeEach(() => {
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    statSpy = vi.spyOn(fs, 'stat');
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes directly to destination when destPath includes filename', async () => {
    statSpy.mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    );

    const destPath = path.join('.rulesets', 'dist', 'copilot.md');
    await plugin.write({
      compiled,
      destPath,
      config: {},
      logger,
    });

    expect(writeFileSpy).toHaveBeenCalledWith(
      path.resolve(destPath),
      'compiled content',
      'utf-8'
    );
  });

  it('appends fallback filename when destPath points to a directory', async () => {
    statSpy.mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    );

    const destPath = path.join('.rulesets', 'dist', 'copilot');
    await plugin.write({
      compiled,
      destPath,
      config: {},
      logger,
    });

    expect(writeFileSpy).toHaveBeenCalledWith(
      path.resolve(destPath, 'guide.md'),
      'compiled content',
      'utf-8'
    );
  });

  it('honours directory-like outputPath overrides', async () => {
    statSpy.mockImplementation((candidate) => {
      if (typeof candidate === 'string' && candidate.includes('custom-dir')) {
        return Promise.resolve({
          isDirectory: () => true,
        } as unknown as Stats);
      }
      return Promise.reject(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
    });

    const destPath = path.join('.rulesets', 'dist', 'copilot-output');
    await plugin.write({
      compiled,
      destPath,
      config: { outputPath: path.join('custom-dir') },
      logger,
    });

    expect(writeFileSpy).toHaveBeenCalledWith(
      path.resolve(destPath, 'custom-dir', 'guide.md'),
      'compiled content',
      'utf-8'
    );
  });

  it('treats file-like outputPath overrides as files', async () => {
    statSpy.mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    );

    const destPath = path.join('.rulesets', 'dist', 'copilot-output');
    const outputPath = path.join('custom-dir', 'copilot.md');
    await plugin.write({
      compiled,
      destPath,
      config: { outputPath },
      logger,
    });

    expect(writeFileSpy).toHaveBeenCalledWith(
      path.resolve(destPath, outputPath),
      'compiled content',
      'utf-8'
    );
  });
});
