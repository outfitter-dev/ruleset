import { describe, expect, it, vi } from 'bun:test';
import type { Logger, ParsedDoc } from '../../interfaces';
import { CursorProvider } from '../cursor-provider';

const createLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe('CursorProvider.prepareCompilation', () => {
  const provider = new CursorProvider();

  it('returns undefined when no Handlebars overrides are declared', async () => {
    const parsed: ParsedDoc = {
      source: {
        content: '',
        frontmatter: {
          destinations: {},
        },
      },
      ast: { sections: [], imports: [], variables: [], markers: [] },
    };

    const result = await provider.prepareCompilation({
      parsed,
      projectConfig: {},
      logger: createLogger(),
    });

    expect(result).toBeUndefined();
  });

  it('returns destination Handlebars options when configured', async () => {
    const parsed: ParsedDoc = {
      source: {
        content: '',
        frontmatter: {
          destinations: {
            cursor: {
              handlebars: {
                force: true,
                partials: {
                  footer: 'Footer content',
                },
              },
            },
          },
        },
      },
      ast: { sections: [], imports: [], variables: [], markers: [] },
    };

    const result = await provider.prepareCompilation({
      parsed,
      projectConfig: {},
      logger: createLogger(),
    });

    expect(result).toEqual({
      handlebars: {
        force: true,
        helpers: undefined,
        partials: { footer: 'Footer content' },
      },
    });
  });
});
