import { describe, expect, it } from 'bun:test';
import { compile } from '../../compiler';
import type { ParsedDoc } from '../../interfaces';
import { CursorProvider } from '../cursor-provider';

describe('CursorProvider prepareCompilation', () => {
  const provider = new CursorProvider();
  const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

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

  it('applies destination-defined partials during compilation', async () => {
    const preparation = await provider.prepareCompilation({
      parsed: baseDoc,
      projectConfig: {},
      logger,
    });

    expect(preparation?.handlebars).toBeDefined();

    const compiled = compile(baseDoc, 'cursor', {}, {
      handlebars: {
        force: preparation?.handlebars?.force,
        helpers: preparation?.handlebars?.helpers,
        partials: preparation?.handlebars?.partials,
      },
    });

    expect(compiled.output.content).toBe('Hello high ::foot::');
  });

  it('forces Handlebars when configured in destination frontmatter', async () => {
    const parsed: ParsedDoc = {
      ...baseDoc,
      source: {
        content: 'Priority: {{file.frontmatter.destinations.cursor.priority}}',
        frontmatter: {
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

    const preparation = await provider.prepareCompilation({
      parsed,
      projectConfig: {},
      logger,
    });

    const compiled = compile(parsed, 'cursor', {}, {
      handlebars: {
        force: preparation?.handlebars?.force,
        helpers: preparation?.handlebars?.helpers,
        partials: preparation?.handlebars?.partials,
      },
    });

    expect(compiled.output.content).toBe('Priority: high');
  });
});
