import { describe, expect, it } from 'bun:test';
import type { ParsedDoc } from '../../interfaces';
import { compile } from '../index';

describe('compiler', () => {
  describe('compile', () => {
    it('should compile a document with frontmatter and body', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: `---
rulesets: v0
title: Test Rules
description: Test description
destinations:
  cursor:
    outputPath: ".cursor/rules/test.mdc"
    priority: high
---

# Test Content

This is the body with {{sections}} and {{$variables}}.`,
          frontmatter: {
            rulesets: 'v0',
            title: 'Test Rules',
            description: 'Test description',
            destinations: {
              cursor: {
                outputPath: '.cursor/rules/test.mdc',
                priority: 'high',
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

      const result = compile(parsedDoc, 'cursor');

      // Source should be preserved
      expect(result.source).toEqual(parsedDoc.source);

      // AST should pass through
      expect(result.ast).toEqual(parsedDoc.ast);

      // Output should contain only the body
      expect(result.output.content).toBe(
        '# Test Content\n\nThis is the body with {{sections}} and {{$variables}}.'
      );

      // Metadata should include relevant fields
      expect(result.output.metadata).toEqual({
        title: 'Test Rules',
        description: 'Test description',
        version: undefined,
        outputPath: '.cursor/rules/test.mdc',
        priority: 'high',
      });

      // Context should include destination and config
      expect(result.context.destinationId).toBe('cursor');
      expect(result.context.config).toEqual({
        outputPath: '.cursor/rules/test.mdc',
        priority: 'high',
      });
    });

    it('should handle document without frontmatter', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '# Just Content\n\nNo frontmatter here.',
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const result = compile(parsedDoc, 'windsurf');

      expect(result.output.content).toBe(
        '# Just Content\n\nNo frontmatter here.'
      );
      expect(result.output.metadata).toEqual({
        title: undefined,
        description: undefined,
        version: undefined,
      });
      expect(result.context.destinationId).toBe('windsurf');
    });

    it('should merge project config with destination config', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: `---
rulesets: v0
destinations:
  cursor:
    outputPath: ".cursor/rules/test.mdc"
    priority: high
---

# Content`,
          frontmatter: {
            rulesets: 'v0',
            destinations: {
              cursor: {
                outputPath: '.cursor/rules/test.mdc',
                priority: 'high',
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

      const projectConfig = {
        baseUrl: 'https://example.com',
        debug: true,
      };

      const result = compile(parsedDoc, 'cursor', projectConfig);

      expect(result.context.config).toEqual({
        baseUrl: 'https://example.com',
        debug: true,
        outputPath: '.cursor/rules/test.mdc',
        priority: 'high',
      });
    });

    it('should handle empty body after frontmatter', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: `---
rulesets: v0
---`,
          frontmatter: {
            rulesets: 'v0',
          },
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const result = compile(parsedDoc, 'cursor');

      expect(result.output.content).toBe('');
    });

    it('should preserve markers in output for v0', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: `---
rulesets: v0
---

{{instructions}}
Do not modify these markers in v0.
{{/instructions}}

{{> common-rules}}

The value is {{$myVariable}}.`,
          frontmatter: {
            rulesets: 'v0',
          },
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const result = compile(parsedDoc, 'cursor');

      expect(result.output.content).toContain('{{instructions}}');
      expect(result.output.content).toContain('{{/instructions}}');
      expect(result.output.content).toContain('{{> common-rules}}');
      expect(result.output.content).toContain('{{$myVariable}}');
    });

    it('should force Handlebars compilation when options request it', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: 'Hello {{uppercase provider.id}}!',
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const result = compile(parsedDoc, 'cursor', {}, {
        handlebars: { force: true },
      });

      expect(result.output.content).toBe('Hello CURSOR!');
    });

    it('should register helpers and partials from compile options', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '{{greet "Rulesets"}} {{> footer }}',
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const result = compile(parsedDoc, 'cursor', {}, {
        handlebars: {
          force: true,
          helpers: {
            greet: (value: unknown) =>
              typeof value === 'string' ? `Hello ${value}` : 'Hello',
          },
          partials: {
            footer: '::footer::',
          },
        },
      });

      expect(result.output.content).toBe('Hello Rulesets ::footer::');
    });


    it('respects handlebars compiler preference in frontmatter', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: `---\nrulesets:
  compiler: handlebars\n---\n
Hello {{uppercase 'world'}}`,
          frontmatter: {
            rulesets: { compiler: 'handlebars' },
          },
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const result = compile(parsedDoc, 'cursor');
      expect(result.output.content).toContain('Hello WORLD');
    });
    it('should handle destination without config', () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: `---
rulesets: v0
destinations:
  cursor:
    path: "/test"
  windsurf: {}
---

# Content`,
          frontmatter: {
            rulesets: 'v0',
            destinations: {
              cursor: { path: '/test' },
              windsurf: {},
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

      const result = compile(parsedDoc, 'windsurf');

      expect(result.context.config).toEqual({});
      expect(result.output.metadata).toEqual({
        title: undefined,
        description: undefined,
        version: undefined,
      });
    });
  });
});
