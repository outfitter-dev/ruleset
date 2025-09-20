import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'bun:test';
import { runRulesetsV0 } from '../index';
import type { Logger } from '../interfaces';
import { GlobalConfig } from '../config/global-config';

const createLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe('Handlebars partial discovery', () => {
  it('loads project and global partials with correct precedence', async () => {
    const tmpRoot = await mkdtemp(path.join(tmpdir(), 'rulesets-partials-'));
    const originalHome = process.env.RULESETS_HOME;
    const globalHome = path.join(tmpRoot, 'global-home');
    process.env.RULESETS_HOME = globalHome;
    GlobalConfig.resetForTest();

    const globalPartialsDir = path.join(globalHome, 'partials');
    await mkdir(globalPartialsDir, { recursive: true });
    await writeFile(path.join(globalPartialsDir, 'header.md'), 'Global Header');

    const projectRulesetDir = path.join(tmpRoot, '.ruleset');
    const projectRulesDir = path.join(projectRulesetDir, 'rules');
    const projectPartialsDir = path.join(projectRulesetDir, 'partials');
    const projectConfigPartialsDir = path.join(
      tmpRoot,
      '.config',
      'ruleset',
      'partials'
    );

    await mkdir(projectRulesDir, { recursive: true });
    await mkdir(projectPartialsDir, { recursive: true });
    await mkdir(projectConfigPartialsDir, { recursive: true });

    await writeFile(
      path.join(projectPartialsDir, 'header.md'),
      'Project Header'
    );
    await writeFile(
      path.join(projectConfigPartialsDir, 'body.md'),
      'Config Body'
    );
    await writeFile(
      path.join(projectRulesDir, '@footer.rule.md'),
      'Inline Footer'
    );

    const outputPath = path.join(
      projectRulesetDir,
      'dist',
      'cursor',
      'compiled.mdc'
    );
    const sourcePath = path.join(projectRulesDir, 'my.rule.md');
    const outputSpecifier = outputPath.replace(/\\/g, '/');
    const sourceContent = `---\nrulesets:\n  version: '0.1.0'\n  compiler: handlebars\ndestinations:\n  cursor:\n    outputPath: "${outputSpecifier}"\n---\n{{> header }}\n{{> body }}\n{{> footer }}\n`;
    await writeFile(sourcePath, sourceContent);

    const logger = createLogger();
    await runRulesetsV0(sourcePath, logger, {});

    const compiled = await readFile(outputPath, 'utf8');
    expect(compiled).toContain('Project Header');
    expect(compiled).toContain('Config Body');
    expect(compiled).toContain('Inline Footer');
    expect(compiled).not.toContain('Global Header');

    await rm(tmpRoot, { recursive: true, force: true });
    if (originalHome === undefined) {
      delete process.env.RULESETS_HOME;
    } else {
      process.env.RULESETS_HOME = originalHome;
    }
    GlobalConfig.resetForTest();
  });
});
