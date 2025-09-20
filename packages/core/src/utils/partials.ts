import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Logger, ParsedDoc } from '../interfaces';
import { GlobalConfig } from '../config/global-config';

const KNOWN_EXTENSIONS = [
  '.rule.md',
  '.ruleset.md',
  '.mdc',
  '.md',
  '.hbs',
  '.handlebars',
  '.txt',
];

async function pathExists(candidate: string): Promise<boolean> {
  try {
    const stats = await fs.stat(candidate);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function findRulesetRoot(sourcePath: string): Promise<string | undefined> {
  let dir = path.resolve(path.dirname(sourcePath));
  const root = path.parse(dir).root;

  while (true) {
    const candidate = path.join(dir, '.ruleset');
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        return dir;
      }
    } catch {
      // Ignore missing directories and continue walking
    }

    if (dir === root) {
      return undefined;
    }

    dir = path.dirname(dir);
  }
}

function stripKnownExtensions(relativePath: string): string {
  for (const ext of KNOWN_EXTENSIONS) {
    if (relativePath.endsWith(ext)) {
      return relativePath.slice(0, -ext.length);
    }
  }
  return relativePath;
}

function normalisePartialName(relativePath: string, stripAtPrefix: boolean): string {
  const posixPath = relativePath.split(path.sep).join('/');
  const stripped = stripKnownExtensions(posixPath);
  if (!stripAtPrefix) {
    return stripped.replace(/^\/+/, '');
  }

  const segments = stripped.split('/');
  if (segments.length === 0) {
    return '';
  }
  if (segments[0].startsWith('@')) {
    segments[0] = segments[0].slice(1);
  }
  return segments.join('/').replace(/^\/+/, '');
}

async function collectPartialsFromDir(opts: {
  baseDir: string;
  targetMap: Map<string, string>;
  logger: Logger;
  requireAtPrefix?: boolean;
  label: string;
}): Promise<void> {
  const { baseDir, targetMap, logger, requireAtPrefix = false, label } = opts;

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.git')) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      if (requireAtPrefix && !entry.name.startsWith('@')) {
        continue;
      }

      const relativePath = path.relative(baseDir, fullPath);
      const partialName = normalisePartialName(relativePath, requireAtPrefix);
      if (!partialName) {
        continue;
      }

      try {
        const content = await fs.readFile(fullPath, 'utf8');
        targetMap.set(partialName, content);
      } catch (error) {
        logger.warn('Failed to load Handlebars partial', {
          path: fullPath,
          source: label,
          error,
        });
      }
    }
  }

  await walk(baseDir);
}

export async function loadHandlebarsPartials(opts: {
  parsed: ParsedDoc;
  logger: Logger;
}): Promise<Record<string, string>> {
  const { parsed, logger } = opts;
  const partials = new Map<string, string>();
  const sourcePath = parsed.source.path;

  const searchQueue: Array<{ dir: string; requireAt?: boolean; label: string }> = [];

  if (typeof sourcePath === 'string') {
    const projectRoot = await findRulesetRoot(sourcePath);
    if (projectRoot) {
      const rulesDir = path.join(projectRoot, '.ruleset', 'rules');
      const projectPartialsDir = path.join(projectRoot, '.ruleset', 'partials');
      const configPartialsDir = path.join(projectRoot, '.config', 'ruleset', 'partials');

      if (await pathExists(configPartialsDir)) {
        searchQueue.push({ dir: configPartialsDir, label: 'project-config' });
      }
      if (await pathExists(projectPartialsDir)) {
        searchQueue.push({ dir: projectPartialsDir, label: 'project-partials' });
      }
      if (await pathExists(rulesDir)) {
        searchQueue.push({ dir: rulesDir, requireAt: true, label: 'ruleset-rules' });
      }
    }
  }

  const globalDir = GlobalConfig.getInstance().getGlobalDirectory();
  const globalPartialsDir = path.join(globalDir, 'partials');
  if (await pathExists(globalPartialsDir)) {
    searchQueue.unshift({ dir: globalPartialsDir, label: 'global-partials' });
  }

  for (const entry of searchQueue) {
    try {
      await collectPartialsFromDir({
        baseDir: entry.dir,
        targetMap: partials,
        logger,
        requireAtPrefix: entry.requireAt ?? false,
        label: entry.label,
      });
    } catch (error) {
      logger.warn('Failed to process Handlebars partial directory', {
        path: entry.dir,
        source: entry.label,
        error,
      });
    }
  }

  return Object.fromEntries(partials);
}
