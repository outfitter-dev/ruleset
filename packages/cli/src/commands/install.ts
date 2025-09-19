import { GlobalConfig, InstallationManager } from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';

export function installCommand(): Command {
  return new Command('install')
    .description('Install a ruleset from npm or GitHub')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .argument('<package>', 'Package name or GitHub URL')
    .option('-g, --global', 'Install globally')
    .option('-d, --dev', 'Save as development dependency')
    .action(async (packageName: string, options) => {
      const spinner = createSpinner(`Installing ${packageName}...`);

      try {
        const config = GlobalConfig.getInstance();
        const installer = new InstallationManager(config);

        const result = await installer.installRuleset(packageName, {
          global: options.global,
          dev: options.dev,
        });

        spinner.succeed(chalk.green(`Successfully installed ${packageName}`));

        if (result.destinations && result.destinations.length > 0) {
          logger.info(
            chalk.dim(`Destinations: ${result.destinations.join(', ')}`)
          );
        }

        if (result.rules && result.rules.length > 0) {
          logger.info(chalk.dim(`Rules: ${result.rules.join(', ')}`));
        }
      } catch (error) {
        spinner.fail(chalk.red(`Failed to install ${packageName}`));
        logger.error(error instanceof Error ? error : String(error));
        process.exit(1);
      }
    });
}
