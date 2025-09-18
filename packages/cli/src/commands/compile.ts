import { promises as fs } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import {
  compile,
  destinations,
  isPathWithinBoundary,
  isPathWithinBoundaryReal,
  parse,
  RESOURCE_LIMITS,
  sanitizePath,
} from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';

// TLDR: Compile rules from a file or directory into per-destination outputs (mixd-v0)
const MIX_EXT_RE = /\.mix\.md$/i; // mixd-perf: precompiled regex for extension replacement

async function listMarkdownFiles(rootPath: string): Promise<string[]> {
  const stats = await fs.stat(rootPath);
  if (!stats.isDirectory()) {
    const isMd = rootPath.endsWith('.md') || rootPath.endsWith('.mix.md');
    return isMd ? [rootPath] : [];
  }

  const result: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (
        entry.isFile() &&
        (full.endsWith('.md') || full.endsWith('.mix.md'))
      ) {
        result.push(full);
      }
    }
  }

  await walk(rootPath);
  return result;
}

export function compileCommand(): Command {
  return new Command('compile')
    .description('Compile source rules to destination formats')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .argument('[source]', 'Source file or directory', './rules')
    .option('-o, --output <dir>', 'Output directory', './.rulesets/dist')
    .option('-d, --destination <dest>', 'Specific destination to compile for')
    .option('-w, --watch', 'Watch for changes and recompile')
    .action(async (source: string, options) => {
      await runCompile(source, options);
    });
}

type CompileContext = {
  sourcePath: string;
  outputPath: string;
  isDir: boolean;
  files: string[];
  destinations: string[];
};

async function buildContext(
  source: string,
  options: { output: string; destination?: string }
): Promise<CompileContext> {
  const cwd = process.cwd();
  const sourcePath = resolve(cwd, sanitizePath(source));
  const outputPath = resolve(cwd, sanitizePath(options.output));

  // Validate paths stay within project boundaries
  if (!isPathWithinBoundary(sourcePath, cwd)) {
    throw new Error(`Source path '${source}' is outside project directory`);
  }
  if (!isPathWithinBoundary(outputPath, cwd)) {
    throw new Error(
      `Output path '${options.output}' is outside project directory`
    );
  }

  const [sourceWithinReal, outputWithinReal] = await Promise.all([
    isPathWithinBoundaryReal(sourcePath, cwd),
    isPathWithinBoundaryReal(outputPath, cwd),
  ]);

  if (!sourceWithinReal) {
    throw new Error(
      `Source path '${source}' resolves outside project directory`
    );
  }

  if (!outputWithinReal) {
    throw new Error(
      `Output path '${options.output}' resolves outside project directory`
    );
  }

  const isDir = (await fs.stat(sourcePath)).isDirectory();
  const files = await listMarkdownFiles(sourcePath);
  const destinationsList = options.destination
    ? [options.destination]
    : (Array.from(destinations.keys()) as string[]);
  return {
    sourcePath,
    outputPath,
    isDir,
    files,
    destinations: destinationsList,
  };
}

async function compileFile(file: string, ctx: CompileContext): Promise<number> {
  const content = await fs.readFile(file, 'utf-8');
  const parsed = parse(content);
  let compiledCount = 0;
  for (const dest of ctx.destinations) {
    if (!destinations.has(dest)) {
      logger.warn(chalk.yellow(`  - No plugin found for destination: ${dest}`));
      continue;
    }
    const compiled = compile(parsed, dest, {});
    const rel = ctx.isDir ? relative(ctx.sourcePath, file) : basename(file);
    const outfile = join(ctx.outputPath, dest, rel.replace(MIX_EXT_RE, '.md'));
    await fs.mkdir(dirname(outfile), { recursive: true });
    await fs.writeFile(outfile, compiled.output.content, { encoding: 'utf8' });
    compiledCount++;
  }
  return compiledCount;
}

async function compileAll(
  ctx: CompileContext
): Promise<{ totalCompiled: number; errors: string[] }> {
  const errors: string[] = [];
  let totalCompiled = 0;
  for (const file of ctx.files) {
    try {
      const count = await compileFile(file, ctx);
      totalCompiled += count;
    } catch (error) {
      errors.push(`Failed to compile ${file}: ${String(error)}`);
      if (error instanceof Error) {
        logger.error(error);
      }
    }
  }
  return { totalCompiled, errors };
}

async function startWatcher(ctx: CompileContext): Promise<void> {
  logger.info(chalk.cyan('\nWatching for changes... (Press Ctrl+C to stop)'));
  const { watch } = await import('node:fs');
  const watcher = watch(ctx.sourcePath, { recursive: true });

  let errorCount = 0;
  const { watcher: limits } = RESOURCE_LIMITS;
  let errorResetTimer: NodeJS.Timeout | null = null;

  watcher.on('change', async (_eventType: string, filename: string | null) => {
    if (!filename) {
      return;
    }
    if (!(filename.endsWith('.md') || filename.endsWith('.mix.md'))) {
      return;
    }
    logger.info(chalk.dim(`\nFile changed: ${filename}`));
    const changedFile = join(ctx.sourcePath, filename);
    try {
      await compileFile(changedFile, ctx);
      logger.info(chalk.green('  ✓ Recompiled successfully'));

      // Reset error count on success
      errorCount = 0;
      if (errorResetTimer) {
        clearTimeout(errorResetTimer);
        errorResetTimer = null;
      }
    } catch (error) {
      errorCount++;
      logger.error(chalk.red(`  ✗ Failed to recompile: ${String(error)}`));

      // Implement circuit breaker pattern
      if (errorCount >= limits.maxConsecutiveErrors) {
        logger.info(
          chalk.yellow(
            `\n⚠️  Too many consecutive errors. Pausing watcher for ${Math.floor(limits.errorResetTime / limits.msToSeconds)} seconds...`
          )
        );

        watcher.close();

        setTimeout(() => {
          (async () => {
            logger.info(chalk.cyan('Resuming watcher...'));
            // Refresh file list and bulk-compile to catch up
            const files = await listMarkdownFiles(ctx.sourcePath);
            await compileAll({ ...ctx, files });
            await startWatcher({ ...ctx, files });
          })().catch((err) => {
            logger.error(
              chalk.red(`Failed to restart watcher: ${String(err)}`)
            );
          });
        }, limits.errorResetTime);
        return;
      }

      // Set timer to reset error count
      if (!errorResetTimer) {
        errorResetTimer = setTimeout(() => {
          errorCount = 0;
          errorResetTimer = null;
        }, limits.errorResetTime);
      }
    }
  });

  watcher.on('error', (error: Error) => {
    logger.error(chalk.red(`\nWatcher error: ${error.message}`));
    logger.info(chalk.cyan('Attempting to restart watcher...'));
    watcher.close();
    setTimeout(() => startWatcher(ctx), limits.restartDelay);
  });
}

type CompileOptions = { output: string; destination?: string; watch?: boolean };

async function runCompile(
  source: string,
  options: CompileOptions
): Promise<void> {
  const spinner = createSpinner('Compiling rulesets...');
  try {
    const ctx = await buildContext(source, options);
    if (ctx.files.length === 0) {
      spinner.warn(chalk.yellow('No source files found'));
      return;
    }
    spinner.text = `Found ${ctx.files.length} source file(s)`;

    const { totalCompiled, errors } = await compileAll(ctx);
    if (errors.length > 0) {
      spinner.warn(chalk.yellow(`Compiled with ${errors.length} error(s)`));
      for (const err of errors) {
        logger.error(chalk.red(`  - ${err}`));
      }
    } else {
      spinner.succeed(
        chalk.green(`Successfully compiled ${totalCompiled} file(s)`)
      );
    }
    logger.info(chalk.dim(`Output: ${ctx.outputPath}`));
    if (options.watch) {
      await startWatcher(ctx);
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to compile rulesets'));
    logger.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}
