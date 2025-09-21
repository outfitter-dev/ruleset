import { describe, expect, it, vi } from 'vitest';
import type { ParsedDoc } from '../../interfaces';
import type { Logger, LogMetadata } from '../../interfaces';
import { HandlebarsRulesetCompiler } from '../handlebars-compiler';

const baseDoc = (content: string, frontmatter: Record<string, unknown> = {}): ParsedDoc => ({
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
      `---\nname: onboarding\n---\n\n## Welcome\n\nHi {{uppercase file.frontmatter.name}}!`,
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
    const parsed = baseDoc('Output: {{userInput}}', {
      destinations: {
        cursor: { handlebars: { force: true } },
      },
    });

    const result = compiler.compile(parsed, 'cursor', {
      projectConfig: {},
      helpers: {
        userInput: () => '<script>alert(1)</script>',
      },
    });

    expect(result.output.content).toContain(
      'Output: &lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('allows disabling escaping via options', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const parsed = baseDoc('Output: {{value}}');

    const result = compiler.compile(parsed, 'cursor', {
      noEscape: true,
      partials: {},
      helpers: {
        value: () => '<strong>bold</strong>',
      },
    });

    expect(result.output.content).toContain('Output: <strong>bold</strong>');
  });

  it('enforces strict mode by default and logs contextual errors', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const errorMock = vi.fn<void, [string | Error, LogMetadata?]>();
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: errorMock,
    };
    const parsed = baseDoc('Missing value: {{unknownProperty}}');

    expect(() => compiler.compile(parsed, 'cursor', { logger })).toThrow(
      /Handlebars compilation failed/
    );
    expect(errorMock).toHaveBeenCalledTimes(1);
    const [errorArg, metadata] = errorMock.mock.calls[0] ?? [];
    expect(errorArg).toBeInstanceOf(Error);
    expect(metadata).toMatchObject({ destination: 'cursor', sourcePath: '<inline>' });
  });

  it('can relax strict mode when explicitly disabled', () => {
    const compiler = new HandlebarsRulesetCompiler();
    const parsed = baseDoc('Optional: {{undefinedValue}}');

    const result = compiler.compile(parsed, 'cursor', { strict: false });

    expect(result.output.content).toBe('Optional: ');
  });
});
