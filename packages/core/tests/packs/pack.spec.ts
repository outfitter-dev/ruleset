import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalConfig } from '../../src/config/global-config';
import { Pack } from '../../src/packs/pack';
import { PackManager } from '../../src/packs/pack-manager';

const RE_SETS = /sets = \[.*"typescript".*"react".*\]/s;
const RE_COMMANDS = /commands = \[.*"lint".*"test".*\]/s;
const RE_TS_STRICT = /["']?typescript\.strict["']?\s*=\s*true/;
const EXPECTED_RESOLVED_COUNT = 3;

describe('Pack System', () => {
  let testDir: string;
  let globalDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pack-test-'));
    globalDir = await mkdtemp(join(tmpdir(), 'pack-global-'));

    // Mock global directory
    vi.spyOn(GlobalConfig.prototype, 'getGlobalDirectory').mockReturnValue(
      globalDir
    );

    // Create test rulesets that packs will include
    await createTestRuleset(
      globalDir,
      'typescript',
      '2.0.0',
      '# TypeScript Rules'
    );
    await createTestRuleset(globalDir, 'react', '3.0.0', '# React Rules');
    await createTestRuleset(globalDir, 'node', '1.5.0', '# Node.js Rules');
    await createTestRuleset(
      globalDir,
      'tailwind',
      '1.0.0',
      '# Tailwind CSS Rules'
    );

    // Use explicit projectDir in PackManager to avoid chdir in workers
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(testDir, { recursive: true, force: true });
    await rm(globalDir, { recursive: true, force: true });
  });

  describe('Pack', () => {
    it('should load pack definition from TOML', async () => {
      const packPath = await createTestPack(globalDir, 'fullstack-ts', {
        name: 'Full-Stack TypeScript',
        version: '1.0.0',
        description: 'Complete TypeScript development stack',
        sets: ['typescript', 'react', 'node'],
        commands: ['commit', 'review'],
        configuration: {
          'typescript.strict': true,
          'react.version': '18',
        },
      });

      const pack = new Pack(packPath);
      await pack.load();

      expect(pack.name).toBe('fullstack-ts');
      expect(pack.metadata.name).toBe('Full-Stack TypeScript');
      expect(pack.metadata.version).toBe('1.0.0');
      expect(pack.includes.sets).toEqual(['typescript', 'react', 'node']);
      expect(pack.includes.commands).toEqual(['commit', 'review']);
      expect(pack.configuration['typescript.strict']).toBe(true);
    });

    it('should validate pack definition', async () => {
      const packPath = await createTestPack(globalDir, 'invalid', {
        name: '', // Invalid: empty name
        version: 'invalid', // Invalid: bad version format
        sets: [], // Invalid: empty sets
      });

      const pack = new Pack(packPath);
      const errors = await pack.validate();

      // Debug output to see what's happening
      if (!errors.includes('Pack name is required')) {
        // This block is intentionally empty - validation check only
      }

      expect(errors).toContain('Pack name is required');
      expect(errors).toContain('Invalid version format');
      expect(errors).toContain('Pack must include at least one ruleset');
    });

    it('should resolve included rulesets', async () => {
      const packPath = await createTestPack(globalDir, 'frontend', {
        name: 'Frontend Stack',
        version: '1.0.0',
        description: 'Frontend development tools',
        sets: ['react', 'typescript', 'tailwind'],
      });

      const pack = new Pack(packPath);
      await pack.load();

      const resolved = await pack.resolveRulesets();
      expect(resolved).toHaveLength(EXPECTED_RESOLVED_COUNT);
      expect(resolved[0].name).toBe('react');
      expect(resolved[1].name).toBe('typescript');
      expect(resolved[2].name).toBe('tailwind');
    });

    it('should merge configuration with ruleset defaults', () => {
      const pack = new Pack('');
      pack.configuration = {
        'typescript.strict': true,
        'typescript.target': 'ES2022',
        'react.version': '18',
      };

      const merged = pack.mergeConfiguration({
        'typescript.target': 'ES2020', // Should be overridden
        'typescript.module': 'commonjs', // Should be preserved
        'node.version': '20', // Should be preserved
      });

      expect(merged['typescript.strict']).toBe(true);
      expect(merged['typescript.target']).toBe('ES2022'); // Pack override
      expect(merged['typescript.module']).toBe('commonjs'); // Preserved
      expect(merged['react.version']).toBe('18');
      expect(merged['node.version']).toBe('20');
    });
  });

  describe('PackManager', () => {
    let manager: PackManager;

    beforeEach(() => {
      manager = new PackManager({ globalDir, projectDir: testDir });
    });

    it('should list available packs', async () => {
      await createTestPack(globalDir, 'fullstack', {
        name: 'Full-Stack',
        version: '1.0.0',
        description: 'Full-stack development',
        sets: ['typescript', 'react', 'node'],
      });

      await createTestPack(globalDir, 'backend', {
        name: 'Backend',
        version: '1.0.0',
        description: 'Backend development',
        sets: ['node', 'typescript'],
      });

      const packs = await manager.listPacks();

      expect(packs).toHaveLength(2);
      expect(packs.map((p) => p.name).sort()).toEqual(['backend', 'fullstack']);
    });

    it('should get a specific pack', async () => {
      await createTestPack(globalDir, 'ml-python', {
        name: 'Machine Learning Python',
        version: '2.0.0',
        description: 'Python ML stack',
        sets: ['python', 'jupyter', 'tensorflow'],
      });

      const pack = await manager.getPack('ml-python');

      expect(pack).toBeDefined();
      expect(pack?.metadata.name).toBe('Machine Learning Python');
      expect(pack?.metadata.version).toBe('2.0.0');
    });

    it('should install a pack with all its rulesets', async () => {
      await createTestPack(globalDir, 'fullstack-ts', {
        name: 'Full-Stack TypeScript',
        version: '1.0.0',
        description: 'Complete TypeScript stack',
        sets: ['typescript', 'react', 'node'],
        configuration: {
          'typescript.strict': true,
        },
      });

      const result = await manager.installPack('fullstack-ts', ['claude-code']);

      expect(result.success).toBe(true);
      expect(result.installedSets).toEqual(['typescript', 'react', 'node']);
      expect(result.destinations).toEqual(['claude-code']);

      // Check that files were created
      const claudeContent = await readFile(
        join(testDir, '.claude', 'CLAUDE.md'),
        'utf-8'
      );
      expect(claudeContent).toContain('TypeScript Rules');
      expect(claudeContent).toContain('React Rules');
      expect(claudeContent).toContain('Node.js Rules');
    });

    it('should handle pack conflicts', async () => {
      // Create two packs with conflicting configurations
      await createTestPack(globalDir, 'strict-ts', {
        name: 'Strict TypeScript',
        version: '1.0.0',
        sets: ['typescript'],
        configuration: {
          'typescript.strict': true,
          'typescript.noImplicitAny': true,
        },
      });

      await createTestPack(globalDir, 'loose-ts', {
        name: 'Loose TypeScript',
        version: '1.0.0',
        sets: ['typescript'],
        configuration: {
          'typescript.strict': false,
          'typescript.noImplicitAny': false,
        },
      });

      // Install first pack
      await manager.installPack('strict-ts', ['claude-code']);

      // Try to install conflicting pack
      const result = await manager.installPack('loose-ts', ['claude-code'], {
        resolveConflicts: 'skip',
      });

      expect(result.success).toBe(false);
      expect(result.conflicts).toContain('typescript');
    });

    it('should create a new pack', async () => {
      const packDef = {
        name: 'Custom Stack',
        version: '1.0.0',
        description: 'My custom development stack',
        sets: ['typescript', 'react'],
        commands: ['test', 'build'],
        configuration: {
          'typescript.target': 'ES2022',
        },
      };

      const created = await manager.createPack('custom', packDef);

      expect(created).toBe(true);

      // Verify pack was created
      const pack = await manager.getPack('custom');
      expect(pack).toBeDefined();
      expect(pack?.metadata.name).toBe('Custom Stack');
      expect(pack?.includes.sets).toEqual(['typescript', 'react']);
    });

    it('should update an existing pack', async () => {
      await createTestPack(globalDir, 'frontend', {
        name: 'Frontend',
        version: '1.0.0',
        description: 'Frontend stack',
        sets: ['react', 'typescript'],
      });

      const updated = await manager.updatePack('frontend', {
        version: '2.0.0',
        sets: ['react', 'typescript', 'tailwind'], // Add tailwind
        description: 'Enhanced frontend stack',
      });

      expect(updated).toBe(true);

      const pack = await manager.getPack('frontend');
      expect(pack?.metadata.version).toBe('2.0.0');
      expect(pack?.includes.sets).toContain('tailwind');
    });

    it('should remove a pack', async () => {
      await createTestPack(globalDir, 'temp-pack', {
        name: 'Temporary',
        version: '1.0.0',
        description: 'Temporary pack',
        sets: ['typescript'],
      });

      const removed = await manager.removePack('temp-pack');
      expect(removed).toBe(true);

      const pack = await manager.getPack('temp-pack');
      expect(pack).toBeUndefined();
    });

    it('should export pack definition', async () => {
      await createTestPack(globalDir, 'exportable', {
        name: 'Exportable Pack',
        version: '1.0.0',
        description: 'Pack for export',
        sets: ['typescript', 'react'],
        commands: ['lint', 'test'],
        configuration: {
          'typescript.strict': true,
        },
      });

      const pack = await manager.getPack('exportable');
      const exported = pack?.export();

      expect(exported).toContain('[pack]');
      expect(exported).toContain('name = "Exportable Pack"');
      expect(exported).toMatch(RE_SETS);
      expect(exported).toMatch(RE_COMMANDS);
      // TOML may quote keys with dots
      expect(exported).toMatch(RE_TS_STRICT);
    });
  });
});

async function createTestRuleset(
  globalDir: string,
  name: string,
  version: string,
  content: string
) {
  const rulesetDir = join(globalDir, 'sets', name);
  await mkdir(rulesetDir, { recursive: true });

  await writeFile(join(rulesetDir, 'rules.md'), content, 'utf-8');

  const meta = `[set]
name = "${name}"
version = "${version}"
description = "Test ${name} ruleset"
author = "Test"
tags = ["test"]
`;

  await writeFile(join(rulesetDir, 'meta.toml'), meta, 'utf-8');
}

async function createTestPack(
  globalDir: string,
  name: string,
  definition: any
) {
  const packsDir = join(globalDir, 'packs');
  await mkdir(packsDir, { recursive: true });

  const packFile = join(packsDir, `${name}.toml`);

  const resolvedName = Object.hasOwn(definition, 'name')
    ? definition.name
    : name;
  const resolvedVersion = Object.hasOwn(definition, 'version')
    ? definition.version
    : '1.0.0';
  const resolvedDescription = Object.hasOwn(definition, 'description')
    ? definition.description
    : '';

  let content = `[pack]
name = "${resolvedName}"
version = "${resolvedVersion}"
description = "${resolvedDescription}"
`;

  if (!definition.skipIncludes && (definition.sets || definition.commands)) {
    content += '\n[includes]\n';
    if (definition.sets) {
      content += `sets = [${definition.sets.map((s: string) => `"${s}"`).join(', ')}]\n`;
    }
  } else if (definition.sets && definition.sets.length === 0) {
    // Explicitly set empty sets for validation test
    content += '\n[includes]\nsets = []\n';
  }

  if (definition.commands) {
    content += `commands = [${definition.commands.map((c: string) => `"${c}"`).join(', ')}]\n`;
  }

  if (definition.configuration) {
    content += '\n[configuration]\n';
    for (const [key, value] of Object.entries(definition.configuration)) {
      if (typeof value === 'boolean') {
        content += `${key} = ${value}\n`;
      } else if (typeof value === 'string') {
        content += `${key} = "${value}"\n`;
      } else {
        content += `${key} = ${value}\n`;
      }
    }
  }

  await writeFile(packFile, content, 'utf-8');
  return packFile;
}
