import { describe, expect, it } from 'vitest';
import type { ParsedDoc } from '../../interfaces';
import { lint } from '../index';

const DEFAULT_FRONTMATTER: Record<string, unknown> = {
  rule: {
    version: '0.2.0',
    template: false,
  },
  description: 'Test description',
};

const DEFAULT_CONTENT = '# Title\n\nBody content.';

const mkDoc = (
  frontmatter?: Record<string, unknown>,
  options: { content?: string; errors?: ParsedDoc['errors'] } = {}
): ParsedDoc => {
  const { content = DEFAULT_CONTENT, errors } = options;
  const doc: ParsedDoc = {
    source: frontmatter ? { content, frontmatter } : { content },
    ast: { sections: [], imports: [], variables: [], markers: [] },
  };
  if (errors) {
    doc.errors = errors;
  }
  return doc;
};

describe('linter', () => {
  describe('lint', () => {
    it('passes a valid document', () => {
      const parsedDoc = mkDoc({ ...DEFAULT_FRONTMATTER });
      const results = lint(parsedDoc);
      expect(results).toHaveLength(0);
    });

    it('reports an error when no frontmatter is present', () => {
      const parsedDoc = mkDoc();
      const results = lint(parsedDoc);
      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
      expect(results[0].message).toContain('No frontmatter found');
    });

    it('downgrades missing frontmatter to warning when disabled', () => {
      const parsedDoc = mkDoc();
      const results = lint(parsedDoc, { requireRulesetsVersion: false });
      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
    });

    it('errors when the rule block is missing', () => {
      const parsedDoc = mkDoc({}, { content: DEFAULT_CONTENT });
      const results = lint(parsedDoc);
      const message = results.find((r) =>
        r.message.includes('Missing required rule metadata block')
      );
      expect(message).toBeDefined();
      expect(message?.severity).toBe('error');
    });

    it('errors when the rule block is not an object', () => {
      const parsedDoc = mkDoc({ rule: 'invalid' });
      const results = lint(parsedDoc);
      const message = results.find((r) =>
        r.message.includes('Invalid rule metadata block')
      );
      expect(message).toBeDefined();
      expect(message?.severity).toBe('error');
    });

    it('errors when rule.version is missing', () => {
      const parsedDoc = mkDoc({ rule: {} });
      const results = lint(parsedDoc);
      const message = results.find((r) =>
        r.message.includes('Missing required rule version')
      );
      expect(message).toBeDefined();
      expect(message?.severity).toBe('error');
    });

    it('errors when rule.version is not semantic', () => {
      const parsedDoc = mkDoc({ rule: { version: '1.0' } });
      const results = lint(parsedDoc);
      const message = results.find((r) =>
        r.message.includes('Expected a semantic version')
      );
      expect(message).toBeDefined();
      expect(message?.severity).toBe('error');
    });

    it('errors when rule.template is not boolean', () => {
      const parsedDoc = mkDoc({
        rule: { version: '0.2.0', template: 'yes' as unknown as boolean },
      });
      const results = lint(parsedDoc);
      const message = results.find((r) =>
        r.message.includes('rule.template flag')
      );
      expect(message).toBeDefined();
      expect(message?.severity).toBe('error');
    });

    it('errors when rule.globs contains invalid entries', () => {
      const parsedDoc = mkDoc({
        rule: { version: '0.2.0', globs: ['**/*.md', 42 as unknown as string] },
      });
      const results = lint(parsedDoc);
      const message = results.find((r) =>
        r.message.includes('Invalid entries in rule.globs list')
      );
      expect(message).toBeDefined();
      expect(message?.severity).toBe('error');
    });


    it('provides an info hint when description is missing', () => {
      const parsedDoc = mkDoc({ rule: { version: '0.2.0' } });
      const results = lint(parsedDoc);
      const info = results.find((r) =>
        r.message.includes('Consider adding a description')
      );
      expect(info).toBeDefined();
      expect(info?.severity).toBe('info');
    });

    it('errors when the first content line is not an H1', () => {
      const parsedDoc = mkDoc({ ...DEFAULT_FRONTMATTER }, {
        content: 'Intro paragraph before heading',
      });
      const results = lint(parsedDoc);
      const error = results.find((r) =>
        r.message.includes('The first content line should be a level-1 Markdown heading')
      );
      expect(error).toBeDefined();
      expect(error?.severity).toBe('error');
    });

    it('errors when no body content exists', () => {
      const parsedDoc = mkDoc({ ...DEFAULT_FRONTMATTER }, { content: '   \n\n ' });
      const results = lint(parsedDoc);
      const error = results.find((r) =>
        r.message.includes('No Markdown content found')
      );
      expect(error).toBeDefined();
      expect(error?.severity).toBe('error');
    });

    it('flags legacy section markers', () => {
      const content = '# Title\n\n{{instructions}}\nDo something\n{{/instructions}}';
      const parsedDoc = mkDoc({ ...DEFAULT_FRONTMATTER }, { content });
      const results = lint(parsedDoc);
      const error = results.find((r) =>
        r.message.includes('Legacy section marker "{{instructions}}" detected')
      );
      expect(error).toBeDefined();
      expect(error?.severity).toBe('error');
    });

    it('warns when Handlebars expressions are present but templating is disabled', () => {
      const content = '# Title\n\nValue: {{value}}';
      const parsedDoc = mkDoc({ ...DEFAULT_FRONTMATTER }, { content });
      const results = lint(parsedDoc);
      const warning = results.find((r) =>
        r.message.includes('Handlebars-like braces detected')
      );
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('warning');
    });

    it('does not warn when templating is enabled', () => {
      const content = '# Title\n\nValue: {{value}}';
      const parsedDoc = mkDoc({
        rule: { version: '0.2.0', template: true },
        description: 'Test description',
      }, { content });
      const results = lint(parsedDoc);
      const warning = results.find((r) =>
        r.message.includes('Handlebars-like braces detected')
      );
      expect(warning).toBeUndefined();
    });

    it('ignores Handlebars-like braces inside code fences', () => {
      const content = '# Title\n\n```text\n{{value}}\n```';
      const parsedDoc = mkDoc({ ...DEFAULT_FRONTMATTER }, { content });
      const results = lint(parsedDoc);
      const warning = results.find((r) =>
        r.message.includes('Handlebars-like braces detected')
      );
      expect(warning).toBeUndefined();
    });

    it('ignores escaped Handlebars braces', () => {
      const content = '# Title\n\nEscaped \\\{{value}} token';
      const parsedDoc = mkDoc({ ...DEFAULT_FRONTMATTER }, { content });
      const results = lint(parsedDoc);
      const warning = results.find((r) =>
        r.message.includes('Handlebars-like braces detected')
      );
      expect(warning).toBeUndefined();
    });

    it('does not warn for Handlebars block helpers when templating is enabled', () => {
      const content = '# Title\n\n{{#if enabled}}Active{{/if}}';
      const parsedDoc = mkDoc({
        rule: { version: '0.2.0', template: true },
        description: 'Test description',
      }, { content });
      const results = lint(parsedDoc);
      const warning = results.find((r) =>
        r.message.includes('Handlebars-like braces detected')
      );
      expect(warning).toBeUndefined();
    });

    it('includes parser errors in lint output', () => {
      const parsedDoc = mkDoc(undefined, {
        errors: [
          {
            message: 'Failed to parse frontmatter YAML',
            line: 2,
            column: 1,
          },
        ],
      });
      const results = lint(parsedDoc, { requireRulesetsVersion: false });
      const parseError = results.find((r) =>
        r.message.includes('Failed to parse frontmatter YAML')
      );
      expect(parseError).toBeDefined();
      expect(parseError?.severity).toBe('error');
    });
  });
});
