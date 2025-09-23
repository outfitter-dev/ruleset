import { GlobalConfig, initializeProject } from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';
// import { fileURLToPath } from 'node:url';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize Rulesets in the current project')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .option('-g, --global', 'Initialize global configuration')
    .action(async (options) => {
      const spinner = createSpinner('Initializing Rulesets...');

      try {
        if (options.global) {
          const config = await GlobalConfig.getInstance();
          await config.ensureConfigExists();

          spinner.succeed(chalk.green('Global configuration initialized'));
          logger.info(
            chalk.dim(`Configuration file: ${config.getConfigPath()}`)
          );
        } else {
          // Use the high-level API for project initialization
          await initializeProject({
            baseDir: process.cwd(),
            createExamples: true,
            logger,
          });

          spinner.succeed(
            chalk.green('Rulesets initialized in current project')
          );
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize Rulesets'));
        logger.error(error instanceof Error ? error : String(error));
        process.exit(1);
      }
    });
}
