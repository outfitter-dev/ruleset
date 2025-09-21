import { describe, expect, it, vi } from 'vitest';
import { compile } from '../../compiler';
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

  const baseDoc: ParsedDoc = {
    source: {
      content:
        'Hello {{file.frontmatter.destinations.cursor.priority}} {{> footnote}}',
      frontmatter: {
        rulesets: { compiler: 'handlebars' },
        destinations: {
          cursor: {
            priority: 'high',
            handlebars: {
              partials: {
                footnote: '::foot::',
              },
            },
          },
        },
      },
    },
    ast: {
      sections: [],
      imports: [],
      variables: [],
      markers: [],
    },
  };

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
      ...baseDoc,
      source: {
        content: '',
        frontmatter: {
          rulesets: { compiler: 'handlebars' },
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

  it('applies destination-defined partials during compilation', async () => {
    const logger = createLogger();
    const preparation = await provider.prepareCompilation({
      parsed: baseDoc,
      projectConfig: {},
      logger,
    });

    expect(preparation?.handlebars).toBeDefined();

    const compiled = compile(
      baseDoc,
      'cursor',
      {},
      {
        handlebars: {
          force: preparation?.handlebars?.force,
          helpers: preparation?.handlebars?.helpers,
          partials: preparation?.handlebars?.partials,
        },
      }
    );

    expect(compiled.output.content).toBe('Hello high ::foot::');
  });

  it('forces Handlebars when configured in destination frontmatter', async () => {
    const parsed: ParsedDoc = {
      ...baseDoc,
      source: {
        content: 'Priority: {{file.frontmatter.destinations.cursor.priority}}',
        frontmatter: {
          rulesets: { compiler: 'handlebars' },
          destinations: {
            cursor: {
              priority: 'high',
              handlebars: {
                force: true,
              },
            },
          },
        },
      },
    };

    const logger = createLogger();
    const preparation = await provider.prepareCompilation({
      parsed,
      projectConfig: {},
      logger,
    });

    const compiled = compile(
      parsed,
      'cursor',
      {},
      {
        handlebars: {
          force: preparation?.handlebars?.force,
          helpers: preparation?.handlebars?.helpers,
          partials: preparation?.handlebars?.partials,
        },
      }
    );

    expect(compiled.output.content).toBe('Priority: high');
  });
});
