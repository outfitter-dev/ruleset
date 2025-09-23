import { GlobalConfig, InstallationManager, PresetManager } from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';

export function installCommand(): Command {
  return new Command('install')
    .description('Install a ruleset from npm/GitHub or install rules from a preset')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .argument('[package]', 'Package name, GitHub URL, or preset name (when using --preset)')
    .option('-g, --global', 'Install globally')
    .option('-d, --dev', 'Save as development dependency')
    .option('--preset', 'Install rules from a preset instead of a package')
    .option('--overwrite', 'Overwrite existing rule files when installing from preset')
    .option('--target-dir <path>', 'Target directory for preset rules (default: .ruleset/rules)')
    .action(async (packageName: string | undefined, options) => {
      // Validate arguments
      if (!packageName) {
        logger.error('Package name or preset name is required');
        process.exit(1);
      }

      if (options.preset) {
        // Install from preset
        const spinner = createSpinner(`Installing preset '${packageName}'...`);

        try {
          const config = await GlobalConfig.getInstance();
          const presetManager = new PresetManager(config);

          const result = await presetManager.installPreset(packageName, {
            targetDir: options.targetDir,
            overwrite: options.overwrite,
            logger,
          });

          spinner.succeed(chalk.green(`Successfully installed preset '${packageName}' (${result.presetVersion})`));

          if (result.installedRules.length > 0) {
            logger.info(chalk.dim(`Rules installed: ${result.installedRules.map((r: any) => r.name).join(', ')}`));
            logger.info(chalk.dim(`Target directory: ${options.targetDir || '.ruleset/rules'}`));
          }
        } catch (error) {
          spinner.fail(chalk.red(`Failed to install preset '${packageName}'`));
          logger.error(error instanceof Error ? error : String(error));
          process.exit(1);
        }
        return;
      }

      // Install package (existing functionality)
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
            chalk.dim(`Providers: ${result.destinations.join(', ')}`)
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
