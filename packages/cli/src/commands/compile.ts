import { promises as fs } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  compileRules,
  discoverRulesFiles,
  RESOURCE_LIMITS,
  type CompilationOptions,
} from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';

// Compile source rules from a file or directory into per-provider outputs

/**
 * Creates the `rulesets compile` sub-command. The command compiles source rules
 * into provider-specific artefacts and can optionally watch for changes.
 */
export function compileCommand(): Command {
  return new Command('compile')
    .description('Compile source rules to provider formats')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .argument('[source]', 'Source file or directory', './.ruleset/rules')
    .option('-o, --output <dir>', 'Output directory', './.ruleset/dist')
    .option(
      '-p, --provider <id>',
      'Specific provider to compile for (preferred)'
    )
    .option(
      '-d, --destination <dest>',
      'Deprecated alias for --provider'
    )
    .option('-w, --watch', 'Watch for changes and recompile')
    .action(async (source: string, options, command) => {
      const usedDefaultSource = command.args.length === 0;
      await runCompile(source, options, usedDefaultSource);
    });
}

/** Options supported by the CLI compile command. */
type CompileOptions = {
  output: string;
  provider?: string;
  destination?: string; // Deprecated alias, kept for backwards compatibility
  watch?: boolean;
};

/**
 * Entry point for the compile command. Handles non-watch and watch flows, and
 * renders user-friendly status messages through the CLI spinner.
 */
async function runCompile(
  source: string,
  options: CompileOptions,
  usedDefaultSource: boolean
): Promise<void> {
  const spinner = createSpinner('Compiling rulesets...');
  const targetProvider = options.provider ?? options.destination;

  if (options.destination && !options.provider) {
    logger.warn(
      chalk.dim('`--destination` is deprecated; use `--provider` instead.')
    );
  }
  try {
    // Prepare compilation options
    const compilationOptions: CompilationOptions = {
      source,
      output: options.output,
      destination: targetProvider,
      logger,
      lint: true, // Enable linting by default
    };

    // Compile using the high-level API
    const result = await compileRules(compilationOptions);

    // Report results
    if (result.errors.length > 0) {
      spinner.warn(chalk.yellow(`Compiled with ${result.errors.length} error(s)`));
      for (const err of result.errors) {
        logger.error(chalk.red(`  - ${err.file}: ${err.message}`));
      }
    } else if (result.compiledCount === 0) {
      spinner.warn(chalk.yellow('No files compiled'));
    } else {
      spinner.succeed(
        chalk.green(`Successfully compiled ${result.compiledCount} file(s)`)
      );
    }

    logger.info(chalk.dim(`Output: ${result.outputPath}`));

    // Handle watch mode
    if (options.watch) {
      await startWatchMode(source, compilationOptions);
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to compile rulesets'));
    logger.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}

/**
 * Start watch mode for file changes.
 */
async function startWatchMode(
  source: string,
  compilationOptions: CompilationOptions
): Promise<void> {
  const sourcePath = resolve(source);
  const isDirectory = await fs.stat(sourcePath).then(s => s.isDirectory()).catch(() => false);

  if (!isDirectory) {
    logger.info('Watch mode only supports directories');
    return;
  }

  logger.info(chalk.cyan('\nWatching for changes... (Press Ctrl+C to stop)'));

  const { watch } = await import('node:fs');
  const watcher = watch(sourcePath, { recursive: true });

  const { watcher: limits } = RESOURCE_LIMITS;
  const errorState = { count: 0, timer: null as NodeJS.Timeout | null };

  watcher.on('change', async (_eventType: string, filename: string | null) => {
    if (!filename || !filename.endsWith('.md') || basename(filename).startsWith('@')) {
      return;
    }

    logger.info(chalk.dim(`\nFile changed: ${filename}`));

    try {
      const result = await compileRules(compilationOptions);
      if (result.compiledCount > 0) {
        logger.info(chalk.green('  ✓ Recompiled successfully'));
      }

      // Reset error state on success
      errorState.count = 0;
      if (errorState.timer) {
        clearTimeout(errorState.timer);
        errorState.timer = null;
      }
    } catch (error) {
      errorState.count++;
      logger.error(error instanceof Error ? error : new Error(String(error)));

      if (errorState.count >= limits.maxConsecutiveErrors) {
        logger.info(
          chalk.yellow(
            `\n⚠️  Too many consecutive errors. Pausing watcher for ${Math.floor(limits.errorResetTime / limits.msToSeconds)} seconds...`
          )
        );
        watcher.close();
        setTimeout(() => startWatchMode(source, compilationOptions), limits.errorResetTime);
        return;
      }

      if (!errorState.timer) {
        errorState.timer = setTimeout(() => {
          errorState.count = 0;
          errorState.timer = null;
        }, limits.errorResetTime);
      }
    }
  });

  watcher.on('error', (error: Error) => {
    logger.error(error);
    logger.info(chalk.cyan('Attempting to restart watcher...'));
    watcher.close();
    setTimeout(() => startWatchMode(source, compilationOptions), limits.restartDelay);
  });
}
