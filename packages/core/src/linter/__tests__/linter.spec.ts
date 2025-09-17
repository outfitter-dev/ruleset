import { describe, expect, it } from 'vitest';
import type { ParsedDoc } from '../../interfaces';
import { lint } from '../index';

describe('linter', () => {
  describe('lint', () => {
    it('should pass a valid document with complete frontmatter', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content:
            '---\nrulesets:\n  version: "0.1.0"\ntitle: Test\ndescription: Test description\n---\n\n# Content',
          frontmatter: {
            rulesets: { version: '0.1.0' },
            title: 'Test',
            description: 'Test description',
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc);
      expect(results).toHaveLength(0);
    });

    it('should warn when no frontmatter is present', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '# Content without frontmatter',
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc, { requireRulesetsVersion: false });
      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
      expect(results[0].message).toContain('No frontmatter found');
    });

    it('should error when rulesets version is missing', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '---\ntitle: Test\n---\n\n# Content',
          frontmatter: {
            title: 'Test',
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc);
      const rulesetsError = results.find((r) =>
        r.message.includes('Missing required Rulesets version declaration')
      );
      expect(rulesetsError).toBeDefined();
      expect(rulesetsError?.severity).toBe('error');
    });

    it('should error when rulesets field is not properly structured', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '---\nrulesets: 123\n---\n\n# Content',
          frontmatter: {
            rulesets: 123,
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc);
      const typeError = results.find((r) =>
        r.message.includes('Invalid Rulesets version declaration')
      );
      expect(typeError).toBeDefined();
      expect(typeError?.severity).toBe('error');
    });

    it('should error when rulesets field is an array', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '---\nrulesets: []\n---\n\n# Content',
          frontmatter: {
            rulesets: [],
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc);
      const structureError = results.find((r) =>
        r.message.includes('Invalid Rulesets version declaration')
      );
      expect(structureError).toBeDefined();
      expect(structureError?.severity).toBe('error');
    });

    it('should error when version property is missing', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '---\nrulesets: {}\n---\n\n# Content',
          frontmatter: {
            rulesets: {},
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc);
      const missingVersion = results.find((r) =>
        r.message.includes('Missing required Rulesets version number')
      );
      expect(missingVersion).toBeDefined();
      expect(missingVersion?.severity).toBe('error');
    });

    it('should error when rulesets version is not semantic', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '---\nrulesets:\n  version: "01.0.0"\n---\n\n# Content',
          frontmatter: {
            rulesets: { version: '01.0.0' },
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc);
      const semverError = results.find((r) =>
        r.message.includes('Expected a semantic version')
      );
      expect(semverError).toBeDefined();
      expect(semverError?.severity).toBe('error');
    });

    it('should validate destinations structure', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content:
            '---\nrulesets:\n  version: "0.1.0"\ndestinations: ["cursor", "windsurf"]\n---\n\n# Content',
          frontmatter: {
            rulesets: { version: '0.1.0' },
            destinations: ['cursor', 'windsurf'],
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc);
      const destError = results.find((r) =>
        r.message.includes('Invalid Destination configurations')
      );
      expect(destError).toBeDefined();
      expect(destError?.severity).toBe('error');
    });

    it('should warn about duplicate include destinations', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content:
            '---\nrulesets:\n  version: "0.1.0"\ndestinations:\n  include: ["cursor", "cursor", " windsor f "]\n---\n\n# Content',
          frontmatter: {
            rulesets: { version: '0.1.0' },
            destinations: {
              include: ['cursor', 'cursor', ' windsor f '],
            },
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc, {
        allowedDestinations: ['cursor', 'windsor f'],
      });

      const duplicateWarning = results.find((r) =>
        r.message.includes('Duplicate destination IDs')
      );
      expect(duplicateWarning).toBeDefined();
      expect(duplicateWarning?.severity).toBe('warning');

      const emptyWarning = results.find((r) =>
        r.message.includes('Empty Destination configurations')
      );
      expect(emptyWarning).toBeUndefined();
    });

    it('should warn about unknown destinations when configured', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content:
            '---\nrulesets:\n  version: "0.1.0"\ndestinations:\n  unknown-dest:\n    path: "/test"\n---\n\n# Content',
          frontmatter: {
            rulesets: { version: '0.1.0' },
            destinations: {
              'unknown-dest': { path: '/test' },
            },
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc, {
        allowedDestinations: ['cursor', 'windsurf'],
      });

      const destWarning = results.find((r) =>
        r.message.includes('Unknown destination')
      );
      expect(destWarning).toBeDefined();
      expect(destWarning?.severity).toBe('warning');
    });

    it('should provide info suggestions for missing title and description', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '---\nrulesets:\n  version: "0.1.0"\n---\n\n# Content',
          frontmatter: {
            rulesets: { version: '0.1.0' },
          },
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
      };

      const results = await lint(parsedDoc);
      const titleInfo = results.find((r) =>
        r.message.includes('Consider adding a Document title')
      );
      const descInfo = results.find((r) =>
        r.message.includes('Consider adding a Document description')
      );

      expect(titleInfo).toBeDefined();
      expect(titleInfo?.severity).toBe('info');
      expect(descInfo).toBeDefined();
      expect(descInfo?.severity).toBe('info');
    });

    it('should include parsing errors in lint results', async () => {
      const parsedDoc: ParsedDoc = {
        source: {
          content: '---\ninvalid yaml\n---\n\n# Content',
          frontmatter: {},
        },
        ast: {
          stems: [],
          imports: [],
          variables: [],
          markers: [],
        },
        errors: [
          {
            message: 'Failed to parse frontmatter YAML',
            line: 2,
            column: 1,
          },
        ],
      };

      const results = await lint(parsedDoc);
      const parseError = results.find((r) =>
        r.message.includes('Failed to parse frontmatter YAML')
      );
      expect(parseError).toBeDefined();
      expect(parseError?.severity).toBe('error');
      expect(parseError?.line).toBe(2);
    });
  });
});
