import { describe, expect, it } from 'vitest';
import type { ParsedDoc } from '../../interfaces';
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
});
