import { GlobalConfig, InstallationManager } from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';

async function runSync(options: {
  global?: boolean;
  force?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Syncing rulesets...');
  try {
    const config = await GlobalConfig.getInstance();
    const installer = new InstallationManager(config);
    const results = await installer.syncAllRulesets({
      global: options.global,
      force: options.force,
    });
    reportSyncResults(results, spinner);
  } catch (error) {
    spinner.fail(chalk.red('Failed to sync rulesets'));
    logger.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}

function reportSyncResults(
  results: {
    synced: number;
    updated: number;
    skipped: number;
    errors?: string[];
  },
  spinner: { succeed: (msg: string) => void; info: (msg: string) => void }
): void {
  if (results.synced === 0) {
    spinner.info(chalk.yellow('No rulesets to sync'));
  } else {
    spinner.succeed(chalk.green(`Synced ${results.synced} ruleset(s)`));
    if (results.updated > 0) {
      logger.info(chalk.dim(`Updated: ${results.updated}`));
    }
    if (results.skipped > 0) {
      logger.info(chalk.dim(`Skipped (up to date): ${results.skipped}`));
    }
  }

  if (results.errors && results.errors.length > 0) {
    logger.error(chalk.red('\nErrors:'));
    for (const err of results.errors) {
      logger.error(chalk.red(`  - ${err}`));
    }
  }
}

export function syncCommand(): Command {
  return new Command('sync')
    .description('Sync installed rulesets to their providers')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .option('-g, --global', 'Sync global rulesets')
    .option('-f, --force', 'Force sync even if up to date')
    .action(async (options) => {
      await runSync(options);
    });
}
