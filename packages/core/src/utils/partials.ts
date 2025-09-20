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

// Maximum depth for recursive directory walking to prevent performance issues
const MAX_WALK_DEPTH = 10;

// Maximum number of files to process per directory to prevent memory issues
const MAX_FILES_PER_DIR = 1000;

async function directoryExists(candidate: string): Promise<boolean> {
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

/**
 * Validates that a resolved path stays within the expected base directory.
 * Prevents directory traversal attacks.
 */
function isPathSafe(resolvedPath: string, baseDir: string): boolean {
  const normalizedBase = path.resolve(baseDir);
  const normalizedPath = path.resolve(resolvedPath);
  return normalizedPath.startsWith(normalizedBase);
}

async function collectPartialsFromDir(opts: {
  baseDir: string;
  targetMap: Map<string, string>;
  logger: Logger;
  requireAtPrefix?: boolean;
  label: string;
}): Promise<void> {
  const { baseDir, targetMap, logger, requireAtPrefix = false, label } = opts;

  // Resolve base directory once for security checks
  const resolvedBase = path.resolve(baseDir);
  let fileCount = 0;

  async function walk(currentDir: string, depth = 0): Promise<void> {
    // Prevent excessive recursion
    if (depth > MAX_WALK_DEPTH) {
      logger.warn('Maximum directory depth exceeded', {
        dir: currentDir,
        maxDepth: MAX_WALK_DEPTH,
        source: label,
      });
      return;
    }

    // Validate that we're still within the base directory
    if (!isPathSafe(currentDir, resolvedBase)) {
      logger.warn('Attempted directory traversal detected', {
        dir: currentDir,
        baseDir: resolvedBase,
        source: label,
      });
      return;
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip git directories and hidden files
      if (entry.name.startsWith('.git') || entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      // Security check: ensure resolved path stays within base directory
      const resolvedPath = path.resolve(fullPath);
      if (!isPathSafe(resolvedPath, resolvedBase)) {
        logger.warn('Skipping file outside base directory', {
          path: fullPath,
          baseDir: resolvedBase,
          source: label,
        });
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      // Limit total files processed
      if (fileCount >= MAX_FILES_PER_DIR) {
        logger.warn('Maximum file count exceeded', {
          dir: currentDir,
          maxFiles: MAX_FILES_PER_DIR,
          source: label,
        });
        return;
      }

      if (requireAtPrefix && !entry.name.startsWith('@')) {
        continue;
      }

      const relativePath = path.relative(resolvedBase, resolvedPath);
      const partialName = normalisePartialName(relativePath, requireAtPrefix);
      if (!partialName) {
        continue;
      }

      try {
        const content = await fs.readFile(resolvedPath, 'utf8');
        targetMap.set(partialName, content);
        fileCount++;
      } catch (error) {
        logger.warn('Failed to load Handlebars partial', {
          path: resolvedPath,
          source: label,
          error,
        });
      }
    }
  }

  await walk(resolvedBase);
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

      if (await directoryExists(configPartialsDir)) {
        searchQueue.push({ dir: configPartialsDir, label: 'project-config' });
      }
      if (await directoryExists(projectPartialsDir)) {
        searchQueue.push({ dir: projectPartialsDir, label: 'project-partials' });
      }
      if (await directoryExists(rulesDir)) {
        searchQueue.push({ dir: rulesDir, requireAt: true, label: 'ruleset-rules' });
      }
    }
  }

  const globalDir = GlobalConfig.getInstance().getGlobalDirectory();
  const globalPartialsDir = path.join(globalDir, 'partials');
  if (await directoryExists(globalPartialsDir)) {
    searchQueue.unshift({ dir: globalPartialsDir, label: 'global-partials' });
  }

  // Use Promise.allSettled to prevent one failing directory from blocking others
  const results = await Promise.allSettled(
    searchQueue.map(async (entry) => {
      try {
        await collectPartialsFromDir({
          baseDir: entry.dir,
          targetMap: partials,
          logger,
          requireAtPrefix: entry.requireAt ?? false,
          label: entry.label,
        });
      } catch (error) {
        // Log but don't throw - error isolation
        logger.warn('Failed to process Handlebars partial directory', {
          path: entry.dir,
          source: entry.label,
          error,
        });
      }
    })
  );

  // Log summary of failed directories if any
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn('Some partial directories could not be processed', {
      failureCount: failures.length,
      totalDirectories: searchQueue.length,
    });
  }

  return Object.fromEntries(partials);
}