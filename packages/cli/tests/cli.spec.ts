import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI_CWD = join(process.cwd());
const TEMP_HOME = mkdtempSync(join(tmpdir(), 'rulesets-cli-test-'));
const VERSION_RE = /\d+\.\d+\.\d+/;
const NON_WS_RE = /\S/;

// Determine the correct CLI path based on where tests are run from
const cliPath = existsSync(join(CLI_CWD, 'src/index.ts'))
  ? join(CLI_CWD, 'src/index.ts')  // Running from packages/cli
  : join(CLI_CWD, 'packages/cli/src/index.ts');  // Running from root

function runCli(args: string[], opts: { cwd?: string } = {}) {
  const res = spawnSync('bun', [cliPath, ...args], {
    cwd: opts.cwd ?? CLI_CWD,
    env: { ...process.env, HOME: TEMP_HOME },
    encoding: 'utf-8',
  });
  return {
    code: res.status ?? 0,
    stdout: res.stdout?.toString() ?? '',
    stderr: res.stderr?.toString() ?? '',
  };
}

afterAll(() => {
  // Clean up temp HOME used by the CLI during tests
  rmSync(TEMP_HOME, { recursive: true, force: true });
});

describe('rulesets CLI smoke', () => {
  it('prints version', () => {
    const { code, stdout } = runCli(['--version']);
    expect(code).toBe(0);
    expect(stdout).toMatch(VERSION_RE);
  });

  it('prints help', () => {
    const { code, stdout } = runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('rulesets');
  });

  it('emits JSON logs in --json mode', () => {
    const { code, stdout } = runCli(['--json', 'list']);
    expect(code).toBe(0);
    const lines = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const first = JSON.parse(lines[0]);
    expect(first).toHaveProperty('level');
    // Look for a friendly message indicating empty state
    const hasEmptyMsg = lines.some((l) => {
      try {
        const obj = JSON.parse(l);
        return (
          typeof obj.message === 'string' &&
          obj.message.includes('No rulesets installed')
        );
      } catch {
        return false;
      }
    });
    expect(hasEmptyMsg).toBe(true);
  });

  it('supports --json after subcommand', () => {
    const { code, stdout } = runCli(['list', '--json']);
    expect(code).toBe(0);
    const firstLine = stdout.split('\n').find((l) => l.trim().length > 0);
    expect(firstLine).toBeTruthy();
    // Should be parseable JSON
    JSON.parse(firstLine as string);
  });

  it('honors --quiet to suppress info logs', () => {
    const { code, stdout } = runCli(['list', '--quiet']);
    expect(code).toBe(0);
    expect(stdout).not.toContain('Installed Rulesets');
    expect(stdout.trim().length === 0 || !NON_WS_RE.test(stdout)).toBeTruthy();
  });

  it('compiles a rules directory to output', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rulesets-cli-compile-'));
    const rulesDir = join(tmp, 'rules');
    mkdirSync(rulesDir);
    const srcFile = join(rulesDir, 'hello.mix.md');
    const body = '# Hello\n\nThis is the body.';
    writeFileSync(
      srcFile,
      `---\nname: test\ndescription: demo\n---\n\n${body}\n`
    );

    const outDirRel = join('.rulesets', 'dist');
    const outDirAbs = join(tmp, outDirRel);
    const { code, stderr, stdout } = runCli(
      [
        'compile',
        'rules',
        '--output',
        outDirRel,
        '--destination',
        'cursor',
        '--json',
      ],
      { cwd: tmp }
    );
    if (code !== 0) {
      console.error('compile stderr:', stderr);
      console.error('compile stdout:', stdout);
    }
    expect(code).toBe(0);
    // Should produce cursor/hello.md
    const outFile = join(outDirAbs, 'cursor', 'hello.md');
    expect(existsSync(outFile)).toBe(true);
    const content = readFileSync(outFile, 'utf-8');
    expect(content).toContain('Hello');
    expect(content).toContain('This is the body.');
    // no frontmatter in output
    expect(content).not.toContain('name: test');
    expect(stderr).toBe('');
  });
});
beforeAll(() => {
  // Ensure @rulesets/core is built so CLI can import its exports
  const coreDir = join(CLI_CWD, '..', 'core');
  const res = spawnSync('bun', ['run', 'build'], {
    cwd: coreDir,
    env: { ...process.env },
    encoding: 'utf-8',
  });
  if ((res.status ?? 0) !== 0) {
    throw new Error(`Failed to build @rulesets/core: ${res.stderr}`);
  }
});
