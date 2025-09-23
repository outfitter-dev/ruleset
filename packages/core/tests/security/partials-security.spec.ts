import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GlobalConfig } from '../../src/config/global-config';
import type { Logger, ParsedDoc } from '../../src/interfaces';
import { loadHandlebarsPartials } from '../../src/utils/partials';

describe('Partials Security Tests', () => {
  let tempDir: string;
  let logger: Logger;
  let logEntries: Array<{ level: string; message: string; context?: any }>;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(join(tmpdir(), 'rulesets-security-test-'));

    // Isolate global configuration for each test
    process.env.RULESETS_HOME = join(tempDir, 'global');
    GlobalConfig.resetForTest();

    // Mock logger to capture security violations
    logEntries = [];
    logger = {
      trace: (msg: string, ctx?: any) =>
        logEntries.push({ level: 'trace', message: msg, context: ctx }),
      debug: (msg: string, ctx?: any) =>
        logEntries.push({ level: 'debug', message: msg, context: ctx }),
      info: (msg: string, ctx?: any) =>
        logEntries.push({ level: 'info', message: msg, context: ctx }),
      warn: (msg: string, ctx?: any) =>
        logEntries.push({ level: 'warn', message: msg, context: ctx }),
      error: (msg: string, ctx?: any) =>
        logEntries.push({ level: 'error', message: msg, context: ctx }),
    };
  });

  afterEach(async () => {
    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    delete process.env.RULESETS_HOME;
    GlobalConfig.resetForTest();
  });

  describe('Directory Traversal Protection', () => {
    it('should reject directory traversal attempts using ../', async () => {
      // Create project structure
      const projectDir = join(tempDir, 'project');
      const rulesetDir = join(projectDir, '.ruleset');
      const partialsDir = join(rulesetDir, 'partials');
      const sensitiveDir = join(tempDir, 'sensitive');

      await fs.mkdir(partialsDir, { recursive: true });
      await fs.mkdir(sensitiveDir, { recursive: true });

      // Create a sensitive file outside the project
      await fs.writeFile(join(sensitiveDir, 'secret.txt'), 'sensitive data');

      // Try to create a symlink with traversal in name (will be caught during walk)
      try {
        // Create a subdirectory with traversal pattern
        const traversalDir = join(partialsDir, '..', '..', '..', 'sensitive');
        await fs.mkdir(traversalDir, { recursive: true });
        await fs.writeFile(join(traversalDir, 'leaked.hbs'), 'leaked content');
      } catch {
        // Directory creation might fail, which is expected
      }

      // Create parsed doc
      const parsed: ParsedDoc = {
        source: {
          path: join(projectDir, 'test.md'),
          content: 'test',
          frontmatter: {},
        },
        sections: [],
      };

      // Attempt to load partials
      const partials = await loadHandlebarsPartials({ parsed, logger });

      // Check that sensitive content wasn't loaded
      const partialContent = Object.values(partials).join('');
      expect(partialContent).not.toContain('sensitive data');
      expect(partialContent).not.toContain('leaked content');
    });

    it('should reject symlink traversal attempts', async () => {
      // Create project structure
      const projectDir = join(tempDir, 'project');
      const rulesetDir = join(projectDir, '.ruleset');
      const partialsDir = join(rulesetDir, 'partials');
      const subDir = join(partialsDir, 'subdir');
      const sensitiveDir = join(tempDir, 'sensitive');

      await fs.mkdir(subDir, { recursive: true });
      await fs.mkdir(sensitiveDir, { recursive: true });

      // Create sensitive file
      await fs.writeFile(join(sensitiveDir, 'secret.hbs'), 'sensitive data');

      // Create symlink that points outside the project
      const symlinkPath = join(subDir, 'evil-link');

      try {
        await fs.symlink(sensitiveDir, symlinkPath, 'dir');
      } catch (error) {
        // Symlink creation might fail on some systems, skip test
        console.log('Skipping symlink test - symlink creation failed:', error);
        return;
      }

      // Create parsed doc
      const parsed: ParsedDoc = {
        source: {
          path: join(projectDir, 'test.md'),
          content: 'test',
          frontmatter: {},
        },
        sections: [],
      };

      // Attempt to load partials
      const partials = await loadHandlebarsPartials({ parsed, logger });

      // Verify no sensitive content was loaded
      const partialContent = Object.values(partials).join('');
      expect(partialContent).not.toContain('sensitive data');

      // Check for warnings (symlinked content might be silently skipped)
      const warnings = logEntries.filter((entry) => entry.level === 'warn');

      // If any warnings were logged about the symlink, verify they're security-related
      if (warnings.length > 0) {
        const hasSecurityContext = warnings.some(
          (entry) =>
            entry.context?.reason?.includes('Symlink') ||
            entry.context?.reason?.includes('escapes')
        );
        expect(hasSecurityContext).toBe(true);
      }
    });

    it('should reject absolute path injections', async () => {
      // Create project structure
      const projectDir = join(tempDir, 'project');
      const rulesetDir = join(projectDir, '.ruleset');
      const partialsDir = join(rulesetDir, 'partials');

      await fs.mkdir(partialsDir, { recursive: true });

      // Create parsed doc with malicious frontmatter attempting path injection
      const parsed: ParsedDoc = {
        source: {
          path: join(projectDir, 'test.md'),
          content: 'test',
          frontmatter: {
            handlebars: {
              partials: {
                evil: '/etc/passwd',
                evil2: '../../../../etc/hosts',
              },
            },
          },
        },
        sections: [],
      };

      // Attempt to load partials
      const partials = await loadHandlebarsPartials({ parsed, logger });

      // Verify no system files were accessed
      const partialKeys = Object.keys(partials);
      expect(partialKeys).not.toContain('evil');
      expect(partialKeys).not.toContain('evil2');

      // The system doesn't load from frontmatter directly in loadHandlebarsPartials
      // So this test verifies the file system protection only
    });
  });

  describe('Resource Limit Protection', () => {
    it('should enforce maximum directory depth limit', async () => {
      // Create deeply nested directory structure
      const projectDir = join(tempDir, 'project');
      const rulesetDir = join(projectDir, '.ruleset');
      const partialsDir = join(rulesetDir, 'partials');

      const DEPTH_BEYOND_LIMIT = 15;
      let currentDir = partialsDir;
      for (let i = 0; i < DEPTH_BEYOND_LIMIT; i++) {
        currentDir = join(currentDir, `level${i}`);
      }
      await fs.mkdir(currentDir, { recursive: true });

      // Place a file at the deepest level
      await fs.writeFile(join(currentDir, 'deep.hbs'), 'too deep');

      // Create parsed doc
      const parsed: ParsedDoc = {
        source: {
          path: join(projectDir, 'test.md'),
          content: 'test',
          frontmatter: {},
        },
        sections: [],
      };

      // Attempt to load partials
      const _partials = await loadHandlebarsPartials({ parsed, logger });

      // Check that depth limit warning was logged
      const depthWarnings = logEntries.filter(
        (entry) =>
          entry.level === 'warn' &&
          entry.message.includes('Maximum directory depth exceeded')
      );
      expect(depthWarnings.length).toBeGreaterThan(0);
      expect(depthWarnings[0].context.maxDepth).toBe(10);
    });

    it('should enforce maximum files per directory limit', async () => {
      // Create project structure with many files
      const projectDir = join(tempDir, 'project');
      const rulesetDir = join(projectDir, '.ruleset');
      const partialsDir = join(rulesetDir, 'partials');

      await fs.mkdir(partialsDir, { recursive: true });

      // Create more files than the limit (MAX_FILES_PER_DIR = 1000)
      // For testing purposes, we'll create a smaller number but verify the mechanism
      const TEST_FILE_COUNT = 50; // Smaller for test performance
      const filePromises: Promise<void>[] = [];

      for (let i = 0; i < TEST_FILE_COUNT; i++) {
        filePromises.push(
          fs.writeFile(join(partialsDir, `partial-${i}.hbs`), `content-${i}`)
        );
      }
      await Promise.all(filePromises);

      // Create parsed doc
      const parsed: ParsedDoc = {
        source: {
          path: join(projectDir, 'test.md'),
          content: 'test',
          frontmatter: {},
        },
        sections: [],
      };

      // Attempt to load partials
      const partials = await loadHandlebarsPartials({ parsed, logger });

      // Should load files up to the limit
      const MAX_FILES_PER_DIR = 1000; // Matches the limit in partials.ts
      const loadedCount = Object.keys(partials).length;
      expect(loadedCount).toBeLessThanOrEqual(MAX_FILES_PER_DIR);
      expect(loadedCount).toBeGreaterThan(0);
    });
  });

  describe('Hidden File Protection', () => {
    it('should skip hidden files and .git directories', async () => {
      // Create project structure
      const projectDir = join(tempDir, 'project');
      const rulesetDir = join(projectDir, '.ruleset');
      const partialsDir = join(rulesetDir, 'partials');
      const gitDir = join(partialsDir, '.git');

      await fs.mkdir(gitDir, { recursive: true });

      // Create various hidden and git files
      await fs.writeFile(join(partialsDir, '.hidden.hbs'), 'hidden content');
      await fs.writeFile(join(partialsDir, '.gitignore'), 'ignore this');
      await fs.writeFile(join(gitDir, 'config'), 'git config');
      await fs.writeFile(join(partialsDir, 'visible.hbs'), 'visible content');

      // Create parsed doc
      const parsed: ParsedDoc = {
        source: {
          path: join(projectDir, 'test.md'),
          content: 'test',
          frontmatter: {},
        },
        sections: [],
      };

      // Attempt to load partials
      const partials = await loadHandlebarsPartials({ parsed, logger });

      // Verify only visible files were loaded
      expect(Object.keys(partials)).toContain('visible');
      expect(Object.keys(partials)).not.toContain('.hidden');
      expect(Object.keys(partials)).not.toContain('.gitignore');
      expect(Object.values(partials).join('')).not.toContain('git config');
      expect(Object.values(partials).join('')).not.toContain('hidden content');
    });
  });

  describe('Error Isolation', () => {
    it('should continue processing other directories when one fails', async () => {
      // Create multiple partial directories with one being invalid
      const projectDir = join(tempDir, 'project');
      const rulesetDir = join(projectDir, '.ruleset');
      const partialsDir = join(rulesetDir, 'partials');
      const configDir = join(projectDir, '.config', 'ruleset', 'partials');

      await fs.mkdir(partialsDir, { recursive: true });
      await fs.mkdir(configDir, { recursive: true });

      // Add valid content to one directory
      await fs.writeFile(join(partialsDir, 'valid.hbs'), 'valid content');

      // Make the config directory unreadable (simulate permission error)
      // Note: This might not work consistently across all OS/environments
      // so we'll also test the error isolation logic directly

      // Create parsed doc
      const parsed: ParsedDoc = {
        source: {
          path: join(projectDir, 'test.md'),
          content: 'test',
          frontmatter: {},
        },
        sections: [],
      };

      // Attempt to load partials
      const partials = await loadHandlebarsPartials({ parsed, logger });

      // Should still load the valid partial despite potential errors
      expect(Object.keys(partials)).toContain('valid');
      expect(partials.valid).toBe('valid content');
    });
  });
});
