import { promises as fs } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import TOML from '@iarna/toml';
import JSON5 from 'json5';

export type ProjectConfigFormat = 'yaml' | 'json' | 'jsonc' | 'toml';

export type ProjectConfig = Record<string, unknown>;

export type ProjectConfigResult = {
  /** Absolute path to the resolved configuration file (if found). */
  path?: string;
  /** The format derived from the file extension. */
  format?: ProjectConfigFormat;
  /** Parsed configuration object (falls back to empty object). */
  config: ProjectConfig;
};

export type LoadProjectConfigOptions = {
  /** Starting directory or file from which to locate `.ruleset/`. Defaults to `process.cwd()`. */
  startPath?: string;
  /** Explicit path to a configuration file. Bypasses discovery when provided. */
  configPath?: string;
};

type Candidate = {
  filename: string;
  format: ProjectConfigFormat;
};

const DEFAULT_CANDIDATES: readonly Candidate[] = [
  { filename: 'config.yaml', format: 'yaml' },
  { filename: 'config.yml', format: 'yaml' },
  { filename: 'config.json', format: 'json' },
  { filename: 'config.jsonc', format: 'jsonc' },
  { filename: 'config.toml', format: 'toml' },
];

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findRulesetRoot(startPath: string): Promise<string | undefined> {
  let current = path.resolve(startPath);
  const stats = await fs
    .stat(current)
    .catch(() => undefined);
  if (stats && stats.isFile()) {
    current = path.dirname(current);
  }

  const root = path.parse(current).root;

  while (true) {
    const candidate = path.join(current, '.ruleset');
    const exists = await fs
      .stat(candidate)
      .then((stat) => stat.isDirectory())
      .catch(() => false);
    if (exists) {
      return current;
    }
    if (current === root) {
      return undefined;
    }
    current = path.dirname(current);
  }
}

function ensurePlainObject(value: unknown): ProjectConfig {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ProjectConfig;
  }
  return {};
}

function parseConfigContents(
  contents: string,
  format: ProjectConfigFormat
): ProjectConfig {
  switch (format) {
    case 'yaml':
      return ensurePlainObject(yamlLoad(contents));
    case 'json':
      return ensurePlainObject(JSON.parse(contents));
    case 'jsonc':
      return ensurePlainObject(JSON5.parse(contents));
    case 'toml':
      return ensurePlainObject(TOML.parse(contents));
    default: {
      const exhaustive: never = format;
      throw new Error(`Unsupported project config format: ${exhaustive}`);
    }
  }
}

async function resolveConfigPath(
  options: LoadProjectConfigOptions
): Promise<{ path: string; format: ProjectConfigFormat } | undefined> {
  if (options.configPath) {
    const explicit = path.resolve(options.configPath);
    const exists = await pathExists(explicit);
    if (!exists) {
      throw new Error(
        `Specified project config not found: ${options.configPath}`
      );
    }
    const ext = path.extname(explicit).toLowerCase();
    const format =
      ext === '.yaml' || ext === '.yml'
        ? 'yaml'
        : ext === '.json'
          ? 'json'
          : ext === '.jsonc'
            ? 'jsonc'
            : ext === '.toml'
              ? 'toml'
              : undefined;
    if (!format) {
      throw new Error(
        `Unsupported project config extension: ${path.basename(explicit)}`
      );
    }
    return { path: explicit, format };
  }

  const start = options.startPath
    ? path.resolve(options.startPath)
    : process.cwd();
  const rulesetRoot = await findRulesetRoot(start);

  const baseDir = rulesetRoot ?? start;
  const rulesetDir = rulesetRoot
    ? path.join(rulesetRoot, '.ruleset')
    : path.join(baseDir, '.ruleset');

  const dirExists = await fs
    .stat(rulesetDir)
    .then((stat) => stat.isDirectory())
    .catch(() => false);
  if (!dirExists) {
    return undefined;
  }

  for (const candidate of DEFAULT_CANDIDATES) {
    const candidatePath = path.join(rulesetDir, candidate.filename);
    if (await pathExists(candidatePath)) {
      return { path: candidatePath, format: candidate.format };
    }
  }

  return undefined;
}

/**
 * Loads the project configuration, searching standard locations under `.ruleset/`.
 * Returns an empty configuration when no file is present.
 *
 * If no sources are configured, defaults to ['.ruleset/rules', '.agents/rules'].
 */
export async function loadProjectConfig(
  options: LoadProjectConfigOptions = {}
): Promise<ProjectConfigResult> {
  const resolved = await resolveConfigPath(options);
  if (!resolved) {
    // Return default config with default sources when no config file is found
    return { config: { sources: ['.ruleset/rules', '.agents/rules'] } };
  }

  const contents = await fs.readFile(resolved.path, 'utf8');
  const config = parseConfigContents(contents, resolved.format);

  // Add default sources if none are configured
  if (!config.sources || !Array.isArray(config.sources) || config.sources.length === 0) {
    config.sources = ['.ruleset/rules', '.agents/rules'];
  }

  return {
    path: resolved.path,
    format: resolved.format,
    config,
  };
}
