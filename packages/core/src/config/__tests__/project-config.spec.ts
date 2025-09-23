import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadProjectConfig,
  type ProjectConfigResult,
} from '../project-config';

const createdDirs: string[] = [];

async function createTempProject(setup?: (dir: string) => Promise<void>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'rulesets-config-'));
  createdDirs.push(root);
  if (setup) {
    await setup(root);
  }
  return root;
}

afterEach(async () => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (!dir) {
      continue;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

describe('loadProjectConfig', () => {
  it('returns empty configuration when no config file is present', async () => {
    const projectDir = await createTempProject(async (dir) => {
      await mkdir(path.join(dir, '.ruleset'), { recursive: true });
    });

    const result = await loadProjectConfig({ startPath: projectDir });

    expect(result.config).toEqual({
      sources: ['.ruleset/rules', '.agents/rules']
    });
    expect(result.path).toBeUndefined();
    expect(result.format).toBeUndefined();
  });

  it('loads YAML configuration with provider sections', async () => {
    const projectDir = await createTempProject(async (dir) => {
      const configDir = path.join(dir, '.ruleset');
      await mkdir(configDir, { recursive: true });
      const yaml = `version: "0.2.0"\nrule:\n  template: true\ncursor:\n  enabled: true\n  priority: "high"\n`;
      await writeFile(path.join(configDir, 'config.yaml'), yaml, 'utf8');
    });

    const result = await loadProjectConfig({ startPath: projectDir });

    expect(result.path).toBeDefined();
    expect(result?.path?.endsWith('config.yaml')).toBe(true);
    expect(result.format).toBe('yaml');
    expect(result.config.rule).toEqual({ template: true });
    expect(result.config.cursor).toEqual({ enabled: true, priority: 'high' });
  });

  it('supports JSONC configuration with comments', async () => {
    const projectDir = await createTempProject(async (dir) => {
      const configDir = path.join(dir, '.ruleset');
      await mkdir(configDir, { recursive: true });
      const jsonc = `// Rulesets project config\n{\n  "version": "0.2.0",\n  /* provider overrides */\n  "windsurf": {\n    "format": "xml"\n  }\n}\n`;
      await writeFile(path.join(configDir, 'config.jsonc'), jsonc, 'utf8');
    });

    const result = await loadProjectConfig({ startPath: projectDir });

    expect(result.format).toBe('jsonc');
    expect(result.config.version).toBe('0.2.0');
    expect(result.config.windsurf).toEqual({ format: 'xml' });
  });

  it('resolves configuration when invoked from a nested directory', async () => {
    const projectDir = await createTempProject(async (dir) => {
      const configDir = path.join(dir, '.ruleset');
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, 'config.toml'), 'version = "0.2.0"\n', 'utf8');
      const nested = path.join(dir, 'apps', 'web');
      await mkdir(nested, { recursive: true });
    });

    const nestedPath = path.join(projectDir, 'apps', 'web');
    const result = await loadProjectConfig({ startPath: nestedPath });

    expect(result.path).toBeDefined();
    expect(result.format).toBe('toml');
    expect(result.config.version).toBe('0.2.0');
  });

  it('uses explicit config path when provided', async () => {
    const projectDir = await createTempProject(async (dir) => {
      const configDir = path.join(dir, '.ruleset');
      await mkdir(configDir, { recursive: true });
      const explicit = path.join(configDir, 'custom.json');
      await writeFile(explicit, '{"cursor": {"enabled": false}}', 'utf8');
    });

    const configPath = path.join(projectDir, '.ruleset', 'custom.json');
    const result: ProjectConfigResult = await loadProjectConfig({
      configPath,
    });

    expect(result.path).toBe(configPath);
    expect(result.format).toBe('json');
    expect(result.config.cursor).toEqual({ enabled: false });
  });
});
