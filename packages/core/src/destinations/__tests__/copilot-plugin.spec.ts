import type { Stats } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledDoc, Logger } from '../../interfaces';
import { CopilotPlugin } from '../copilot-plugin';

const DESTINATION_ID = 'copilot';
const OUTPUT_CONTENT = 'compiled content';
const createEnoent = (): Error =>
  Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

const makeCompiled = (
  filePath: string | null = path.join('rules', 'guide.md')
): CompiledDoc => ({
  source: {
    ...(filePath ? { path: filePath } : {}),
    content: '# content',
    frontmatter: {},
  },
  ast: { sections: [], imports: [], variables: [], markers: [] },
  output: { content: OUTPUT_CONTENT },
  context: { destinationId: DESTINATION_ID, config: {} },
});

describe('CopilotPlugin', () => {
  const plugin = new CopilotPlugin();
  let mkdirSpy: ReturnType<typeof vi.spyOn>;
  let writeFileSpy: ReturnType<typeof vi.spyOn>;
  let statSpy: ReturnType<typeof vi.spyOn>;
  let logger: Logger;

  beforeEach(() => {
    mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    statSpy = vi.spyOn(fs, 'stat').mockRejectedValue(createEnoent());
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
    const destPath = path.join('.ruleset', 'dist', 'copilot.md');
    await plugin.write({
      compiled: makeCompiled(),
      destPath,
      config: {},
      logger,
    });

    const expectedPath = path.resolve(destPath);
    expect(statSpy).not.toHaveBeenCalled();
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
    expect(mkdirSpy).toHaveBeenCalledWith(path.dirname(expectedPath), {
      recursive: true,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Writing copilot rules',
      expect.objectContaining({
        plugin: 'copilot',
        destinationId: DESTINATION_ID,
        outputPath: expectedPath,
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Copilot write complete',
      expect.objectContaining({
        plugin: 'copilot',
        destinationId: DESTINATION_ID,
        outputPath: expectedPath,
      })
    );
  });

  it('appends fallback filename when destPath points to a directory', async () => {
    const destPath = path.join('.ruleset', 'dist', 'copilot');
    await plugin.write({
      compiled: makeCompiled(),
      destPath,
      config: {},
      logger,
    });

    const expectedPath = path.resolve(destPath, 'guide.md');
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
  });

  it('treats destPath with trailing separator as a directory', async () => {
    const destPath = path.join('.ruleset', 'dist', 'copilot') + path.sep;
    await plugin.write({
      compiled: makeCompiled(),
      destPath,
      config: {},
      logger,
    });

    const expectedPath = path.resolve(destPath, 'guide.md');
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
  });

  it('honours directory-like outputPath overrides', async () => {
    statSpy.mockImplementation((candidate: string) => {
      if (candidate.includes('custom-dir')) {
        return Promise.resolve({ isDirectory: () => true } as unknown as Stats);
      }
      return Promise.reject(createEnoent());
    });

    const destPath = path.join('.ruleset', 'dist', 'copilot-output');
    await plugin.write({
      compiled: makeCompiled(),
      destPath,
      config: { outputPath: path.join('custom-dir') },
      logger,
    });

    const expectedPath = path.resolve(destPath, 'custom-dir', 'guide.md');
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
  });

  it('honours outputPath that ends with a path separator', async () => {
    const destPath = path.join('.ruleset', 'dist', 'copilot-output');
    await plugin.write({
      compiled: makeCompiled(),
      destPath,
      config: { outputPath: 'custom-dir/' },
      logger,
    });

    const expectedPath = path.resolve(destPath, 'custom-dir', 'guide.md');
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
  });

  it('trims whitespace in outputPath before resolving', async () => {
    const destPath = path.join('.ruleset', 'dist', 'copilot-output');
    await plugin.write({
      compiled: makeCompiled(),
      destPath,
      config: { outputPath: '  custom-dir/  ' },
      logger,
    });

    const expectedPath = path.resolve(destPath, 'custom-dir', 'guide.md');
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
  });

  it('treats file-like outputPath overrides as files', async () => {
    const destPath = path.join('.ruleset', 'dist', 'copilot-output');
    const outputPath = path.join('custom-dir', 'copilot.md');
    await plugin.write({
      compiled: makeCompiled(),
      destPath,
      config: { outputPath },
      logger,
    });

    const expectedPath = path.resolve(destPath, outputPath);
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
  });

  it('uses "<basename>.md" when source has no extension', async () => {
    const destPath = path.join('.ruleset', 'dist', 'copilot');
    await plugin.write({
      compiled: makeCompiled(path.join('rules', 'instructions')),
      destPath,
      config: {},
      logger,
    });

    const expectedPath = path.resolve(destPath, 'instructions.md');
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
  });

  it('uses "instructions.md" when source path is absent', async () => {
    const destPath = path.join('.ruleset', 'dist', 'copilot');
    await plugin.write({
      compiled: makeCompiled(null),
      destPath,
      config: {},
      logger,
    });

    const expectedPath = path.resolve(destPath, 'instructions.md');
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedPath,
      OUTPUT_CONTENT,
      'utf-8'
    );
  });

  it('propagates write errors and logs structured metadata', async () => {
    const destPath = path.join('.ruleset', 'dist', 'copilot.md');
    const error = new Error('boom');
    writeFileSpy.mockRejectedValueOnce(error);

    await expect(
      plugin.write({ compiled: makeCompiled(), destPath, config: {}, logger })
    ).rejects.toThrow('boom');

    const expectedPath = path.resolve(destPath);
    expect(logger.error).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        plugin: 'copilot',
        op: 'write',
        path: expectedPath,
      })
    );
  });
});
