import { describe, expect, it, vi } from 'vitest';
import type { Logger, LogMetadata, ParsedDoc } from '../../interfaces';
import { HandlebarsRulesetCompiler } from '../handlebars-compiler';

const HANDLEBARS_FAILURE_RE = /Handlebars compilation failed/;

const baseDoc = (
  content: string,
  frontmatter: Record<string, unknown> = {}
): ParsedDoc => ({
  source: {
    content,
    frontmatter,
  },
  ast: {
    sections: [],
    imports: [],
    variables: [],
    markers: [],
  },
});

describe('HandlebarsRulesetCompiler', () => {
  it('renders simple replacements with default helpers', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const parsed = baseDoc(
      '---\nname: onboarding\n---\n\n## Welcome\n\nHi {{uppercase file.frontmatter.name}}!',
      { name: 'onboarding' }
    );

    const compiled = compiler.compile(parsed, 'cursor');

    expect(compiled.output.content).toContain('Hi ONBOARDING!');
  });

  it('passes destination id into context', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const parsed = baseDoc('Hello {{provider.id}}');

    const compiled = compiler.compile(parsed, 'windsurf');

    expect(compiled.output.content).toBe('Hello windsurf');
  });

  it('escapes HTML output by default', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const parsed = baseDoc('Payload: {{payload}}');

    const result = compiler.compile(parsed, 'cursor', {
      helpers: {
        payload: () => '<script>alert(1)</script>',
      },
    });

    expect(result.output.content).toContain(
      'Payload: &lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('respects noEscape override when explicitly disabled', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const parsed = baseDoc('Payload: {{payload}}');

    const result = compiler.compile(parsed, 'cursor', {
      noEscape: true,
      helpers: {
        payload: () => '<strong>bold</strong>',
      },
    });

    expect(result.output.content).toContain('Payload: <strong>bold</strong>');
  });

  it('enforces strict mode by default and logs contextual error', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const errorMock = vi.fn<void, [string | Error, LogMetadata?]>();
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: errorMock,
    };
    const parsed = baseDoc('Missing: {{unknownValue}}');

    expect(() => compiler.compile(parsed, 'cursor', { logger })).toThrow(
      HANDLEBARS_FAILURE_RE
    );
    expect(errorMock).toHaveBeenCalledTimes(1);
    const [errorArg, metadata] = errorMock.mock.calls[0] ?? [];
    expect(errorArg).toBeInstanceOf(Error);
    expect(metadata).toMatchObject({ destination: 'cursor' });
  });

  it('allows opting out of strict mode when requested', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const parsed = baseDoc('Optional: {{unknownValue}}');

    const result = compiler.compile(parsed, 'cursor', { strict: false });

    expect(result.output.content).toBe('Optional: ');
  });
});
