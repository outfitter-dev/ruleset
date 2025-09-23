import { promises as fs } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  isPathWithinBoundary,
  isPathWithinBoundaryReal,
  sanitizePath,
} from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { createSpinner } from '../utils/spinner.js';
import {
  detectHandlebarsExpressions,
  parseFrontmatter,
  stringifyFrontmatter,
} from '../utils/frontmatter.js';

const DEFAULT_TARGET_DIR = './.ruleset/rules';
const DEFAULT_RULE_VERSION = '0.2.0';

function slugify(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const slug = trimmed
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'imported-rule';
}

async function ensureDirectory(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

async function resolveTargetPath(
  targetDir: string,
  slug: string
): Promise<string> {
  await ensureDirectory(targetDir);
  return join(targetDir, `${slug}.md`);
}

export function importCommand(): Command {
  return new Command('import')
    .description('Copy an external Markdown file into .ruleset/rules/')
    .argument('<source>', 'Path to the source Markdown file')
    .option('--target <dir>', 'Target rules directory', DEFAULT_TARGET_DIR)
    .option('--slug <slug>', 'Override the generated filename slug')
    .option('--enable-template', 'Set rule.template: true when copying', false)
    .option('--force', 'Overwrite existing files', false)
    .action(async (source: string, options) => {
      await runImport(source, options);
    });
}

type ImportOptions = {
  target: string;
  slug?: string;
  enableTemplate?: boolean;
  force?: boolean;
};

async function runImport(source: string, options: ImportOptions): Promise<void> {
  const spinner = createSpinner('Importing rule...');

  try {
    const cwd = process.cwd();
    const sourcePath = resolve(cwd, sanitizePath(source));
    const targetRoot = resolve(cwd, sanitizePath(options.target));

    if (!isPathWithinBoundary(targetRoot, cwd)) {
      throw new Error(
        `Target directory '${options.target}' is outside the project workspace.`
      );
    }

    const targetWithinReal = await isPathWithinBoundaryReal(targetRoot, cwd);
    if (!targetWithinReal) {
      throw new Error(
        `Target directory '${options.target}' resolves outside the project workspace.`
      );
    }

    const rawContent = await fs.readFile(sourcePath, 'utf8');
    const { body: originalBody } = parseFrontmatter(rawContent);
    const trimmedBody = originalBody.trimStart();
    const normalizedBody = trimmedBody.length > 0 ? `${trimmedBody}\n` : '';

    const hasHandlebars = detectHandlebarsExpressions(normalizedBody);
    const templateEnabled = hasHandlebars || Boolean(options.enableTemplate);

    const baseName = basename(sourcePath).replace(/\.[^.]+$/, '');
    const slug = options.slug ? slugify(options.slug) : slugify(baseName);
    const targetPath = await resolveTargetPath(targetRoot, slug);

    if (!options.force) {
      try {
        await fs.access(targetPath);
        throw new Error(
          `Target file already exists: ${targetPath}. Use --force to overwrite.`
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    const frontmatter: Record<string, unknown> = {
      rule: {
        version: DEFAULT_RULE_VERSION,
        template: templateEnabled,
      },
    };
    const nextContent = `${stringifyFrontmatter(frontmatter)}${normalizedBody}`;

    await fs.writeFile(targetPath, nextContent, { encoding: 'utf8' });

    spinner.succeed(
      chalk.green(
        `Imported ${chalk.cyan(basename(sourcePath))} -> ${chalk.cyan(
          targetPath
        )}`
      )
    );

    if (hasHandlebars && !options.enableTemplate) {
      logger.warn(
        chalk.yellow(
          'Detected `{{` braces; rule.template has been enabled automatically. Escape the braces (e.g. \\{{) to keep templating disabled.'
        )
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown import failure';
    spinner.fail(chalk.red(`Failed to import rule: ${message}`));
    logger.error(error instanceof Error ? error : new Error(String(error)));
    process.exitCode = 1;
  }
}
