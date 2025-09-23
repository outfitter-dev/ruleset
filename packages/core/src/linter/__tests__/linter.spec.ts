import { describe, expect, it } from 'vitest';
import type { ParsedDoc } from '../../interfaces';
import { lint } from '../index';

const NON_STRING_DESTINATION = 123 as const;

const mkDoc = (
  frontmatter?: Record<string, unknown>,
  options: { content?: string; errors?: ParsedDoc['errors'] } = {}
): ParsedDoc => {
  const { content = '# Content', errors } = options;
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
    it('should pass a valid document with complete frontmatter', () => {
      const parsedDoc = mkDoc({
        rulesets: { version: '0.1.0' },
        title: 'Test',
        description: 'Test description',
      });

      const results = lint(parsedDoc);
      expect(results).toHaveLength(0);
    });

    it('should warn when no frontmatter is present', () => {
      const parsedDoc = mkDoc();

      const results = lint(parsedDoc, { requireRulesetsVersion: false });
      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
      expect(results[0].message).toContain('No frontmatter found');
    });

    it('should error when rulesets version is missing', () => {
      const parsedDoc = mkDoc({ title: 'Test' });

      const results = lint(parsedDoc);
      const rulesetsError = results.find((r) =>
        r.message.includes('Missing required Rulesets version declaration')
      );
      expect(rulesetsError).toBeDefined();
      expect(rulesetsError?.severity).toBe('error');
    });

    it('should error when rulesets field is not properly structured', () => {
      const parsedDoc = mkDoc({
        rulesets: 123 as unknown as Record<string, unknown>,
      });

      const results = lint(parsedDoc);
      const typeError = results.find((r) =>
        r.message.includes('Invalid Rulesets version declaration')
      );
      expect(typeError).toBeDefined();
      expect(typeError?.severity).toBe('error');
    });

    it('should error when rulesets field is an array', () => {
      const parsedDoc = mkDoc({
        rulesets: [] as unknown as Record<string, unknown>,
      });

      const results = lint(parsedDoc);
      const structureError = results.find((r) =>
        r.message.includes('Invalid Rulesets version declaration')
      );
      expect(structureError).toBeDefined();
      expect(structureError?.severity).toBe('error');
    });

    it('should error when version property is missing', () => {
      const parsedDoc = mkDoc({ rulesets: {} });

      const results = lint(parsedDoc);
      const missingVersion = results.find((r) =>
        r.message.includes('Missing required Rulesets version number')
      );
      expect(missingVersion).toBeDefined();
      expect(missingVersion?.severity).toBe('error');
    });

    it('should error when rulesets version is not semantic', () => {
      const parsedDoc = mkDoc({ rulesets: { version: '01.0.0' } });

      const results = lint(parsedDoc);
      const semverError = results.find((r) =>
        r.message.includes('Expected a semantic version')
      );
      expect(semverError).toBeDefined();
      expect(semverError?.severity).toBe('error');
    });

    it('trims whitespace around rulesets version before validation', () => {
      const parsedDoc = mkDoc({ rulesets: { version: ' 0.1.0 ' } });

      const results = lint(parsedDoc);
      const semverError = results.find((r) =>
        r.message.includes('Expected a semantic version')
      );
      expect(semverError).toBeUndefined();
    });

    it('should validate destinations structure', () => {
      const parsedDoc = mkDoc({
        rulesets: { version: '0.1.0' },
        destinations: ['cursor', 'windsurf'] as unknown as Record<
          string,
          unknown
        >,
      });

      const results = lint(parsedDoc);
      const destError = results.find((r) =>
        r.message.includes('Invalid Destination configurations')
      );
      expect(destError).toBeDefined();
      expect(destError?.severity).toBe('error');
    });

    it('should warn about duplicate include destinations', () => {
      const parsedDoc = mkDoc({
        rulesets: { version: '0.1.0' },
        destinations: {
          include: ['cursor', 'cursor', ' windsor f '],
        },
      });

      const results = lint(parsedDoc, {
        allowedDestinations: ['cursor', 'windsor f'],
      });

      const duplicateWarning = results.find((r) =>
        r.message.includes('Duplicate destination IDs')
      );
      expect(duplicateWarning).toBeDefined();
      expect(duplicateWarning?.severity).toBe('warning');

      const emptyWarning = results.find((r) =>
        r.message.includes('"include" is empty')
      );
      expect(emptyWarning).toBeUndefined();
    });

    it('should error when include array is mixed with destination mappings', () => {
      const parsedDoc = mkDoc({
        rulesets: { version: '0.1.0' },
        destinations: {
          include: ['cursor'],
          cursor: { path: './.ruleset/rules' },
        },
      });

      const results = lint(parsedDoc);
      const error = results.find((r) =>
        r.message.includes('Do not mix { include')
      );
      expect(error).toBeDefined();
      expect(error?.severity).toBe('error');
    });

    it('should error when include contains non-string entries', () => {
      const parsedDoc = mkDoc({
        rulesets: { version: '0.1.0' },
        destinations: {
          include: ['cursor', NON_STRING_DESTINATION, null],
        },
      });

      const results = lint(parsedDoc);
      const error = results.find((r) =>
        r.message.includes('non-string entries at indices')
      );
      expect(error).toBeDefined();
      expect(error?.severity).toBe('error');
    });

    it('should warn when trimmed include array is empty', () => {
      const parsedDoc = mkDoc({
        rulesets: { version: '0.1.0' },
        destinations: { include: ['   '] },
      });

      const results = lint(parsedDoc);
      const warning = results.find((r) =>
        r.message.includes('"include" is empty')
      );
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('warning');
    });

    it('should warn about unknown destinations when configured', () => {
      const parsedDoc = mkDoc({
        rulesets: { version: '0.1.0' },
        destinations: {
          'unknown-dest': { path: '/test' },
        },
      });

      const results = lint(parsedDoc, {
        allowedDestinations: ['cursor', 'windsurf'],
      });

      const destWarning = results.find((r) =>
        r.message.includes('Unknown destination "unknown-dest"')
      );
      expect(destWarning).toBeDefined();
      expect(destWarning?.severity).toBe('warning');
    });

    it('should warn about unknown destinations in include form when configured', () => {
      const parsedDoc = mkDoc({
        rulesets: { version: '0.1.0' },
        destinations: {
          include: ['unknown', 'cursor'],
        },
      });

      const results = lint(parsedDoc, {
        allowedDestinations: ['cursor', 'windsurf'],
      });

      const destWarning = results.find((r) =>
        r.message.includes('Unknown destination "unknown"')
      );
      expect(destWarning).toBeDefined();
      expect(destWarning?.severity).toBe('warning');
    });

    it('should provide info suggestions for missing title and description', () => {
      const parsedDoc = mkDoc({ rulesets: { version: '0.1.0' } });

      const results = lint(parsedDoc);
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

    it('should include parsing errors in lint results', () => {
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
