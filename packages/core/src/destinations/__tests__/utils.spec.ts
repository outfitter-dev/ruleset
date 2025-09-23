import { describe, expect, it, vi } from 'bun:test';
import type { Logger, ParsedDoc } from '../../interfaces';
import {
  buildHandlebarsOptions,
  readDestinationConfig,
  type UnknownRecord,
} from '../utils';

describe('destination utils', () => {
  const makeLogger = (): Logger => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });

  it('reads destination configuration from frontmatter when present', () => {
    const parsed: ParsedDoc = {
      source: {
        content: '',
        frontmatter: {
          destinations: {
            cursor: { enabled: true },
          },
        },
      },
      ast: { sections: [], imports: [], variables: [], markers: [] },
    };

    const config = readDestinationConfig(parsed, 'cursor');

    expect(config).toEqual({ enabled: true });
  });

  it('returns undefined when destination configuration is missing', () => {
    const parsed: ParsedDoc = {
      source: {
        content: '',
        frontmatter: { destinations: {} },
      },
      ast: { sections: [], imports: [], variables: [], markers: [] },
    };

    const config = readDestinationConfig(parsed, 'cursor');

    expect(config).toBeUndefined();
  });

  it('builds Handlebars options from boolean config', () => {
    const logger = makeLogger();
    const options = buildHandlebarsOptions({
      destinationId: 'cursor',
      destinationConfig: { handlebars: true } as UnknownRecord,
      logger,
    });

    expect(options).toEqual({
      handlebars: {
        force: true,
        helpers: undefined,
        partials: undefined,
      },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('validates partial names and types', () => {
    const logger = makeLogger();
    const options = buildHandlebarsOptions({
      destinationId: 'cursor',
      destinationConfig: {
        handlebars: {
          partials: {
            header: 'Header content',
            'invalid name': 'bad',
            invalidType: 42,
          },
        },
      },
      logger,
    });

    expect(options).toEqual({
      handlebars: {
        force: undefined,
        helpers: undefined,
        partials: { header: 'Header content' },
      },
    });
    expect(logger.warn).toHaveBeenCalled();
  });
});
