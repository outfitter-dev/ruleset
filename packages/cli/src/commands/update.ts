import { GlobalConfig, PresetManager } from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';

export function updateCommand(): Command {
  return new Command('update')
    .description('Update installed preset rules to their latest versions')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .option('--write-back', 'Force update even if versions match (re-download rules)')
    .argument('[presets...]', 'Specific preset names to update (default: update all)')
    .action(async (presetNames: string[], options) => {
      const spinner = createSpinner('Updating presets...');

      try {
        const config = await GlobalConfig.getInstance();
        const presetManager = new PresetManager(config);

        const result = await presetManager.updatePresets({
          presetNames: presetNames.length > 0 ? presetNames : undefined,
          writeBack: options.writeBack,
          logger,
        });

        if (result.updated.length > 0) {
          spinner.succeed(chalk.green(`Successfully updated ${result.updated.length} preset(s)`));

          for (const record of result.updated) {
            logger.info(
              `  ${chalk.green('•')} ${chalk.bold(record.presetName)} (${record.presetVersion})`
            );
            if (record.installedRules.length > 0) {
              logger.info(
                `    ${chalk.dim('Rules:')} ${record.installedRules.map((r: any) => r.name).join(', ')}`
              );
            }
          }
        } else {
          spinner.succeed(chalk.yellow('No presets needed updating'));
        }

        if (result.skipped.length > 0) {
          logger.info(chalk.dim(`Skipped: ${result.skipped.join(', ')}`));
        }

        if (result.errors.length > 0) {
          logger.warn(chalk.yellow(`${result.errors.length} error(s) encountered:`));
          for (const error of result.errors) {
            logger.error(`  ${chalk.red('✗')} ${error.preset}: ${error.error}`);
          }
        }

        // Exit with error code if all updates failed
        if (result.updated.length === 0 && result.errors.length > 0) {
          process.exit(1);
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to update presets'));
        logger.error(error instanceof Error ? error : String(error));
        process.exit(1);
      }
    });
}