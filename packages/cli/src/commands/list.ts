import { relative } from 'node:path';
import { GlobalConfig, RulesetManager } from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';

type ListedRuleset = {
  name?: string;
  version?: string;
  description?: string;
  destinations?: string[];
  path?: string;
};

function printGlobal(rulesets: ListedRuleset[]): void {
  if (rulesets.length === 0) {
    return;
  }
  logger.info(chalk.cyan('Global:'));
  for (const ruleset of rulesets) {
    logger.info(
      `  ${chalk.green('•')} ${chalk.bold(ruleset.name ?? 'unknown')}${ruleset.version ? `@${ruleset.version}` : ''}`
    );
    if (ruleset.description) {
      logger.info(`    ${chalk.dim(ruleset.description)}`);
    }
    if (ruleset.destinations?.length) {
      logger.info(
        `    ${chalk.dim('Destinations:')} ${ruleset.destinations.join(', ')}`
      );
    }
  }
  logger.info('');
}

function printLocal(rulesets: ListedRuleset[]): void {
  if (rulesets.length === 0) {
    return;
  }
  logger.info(chalk.cyan('Local:'));
  for (const ruleset of rulesets) {
    logger.info(
      `  ${chalk.green('•')} ${chalk.bold(ruleset.name ?? 'unknown')}`
    );
    if (ruleset.path) {
      logger.info(
        `    ${chalk.dim('Path:')} ${relative(process.cwd(), ruleset.path)}`
      );
    }
    if (ruleset.destinations?.length) {
      logger.info(
        `    ${chalk.dim('Destinations:')} ${ruleset.destinations.join(', ')}`
      );
    }
  }
  logger.info('');
}

async function runList(options: {
  global?: boolean;
  local?: boolean;
}): Promise<void> {
  try {
    const config = await GlobalConfig.getInstance();
    const manager = new RulesetManager(config);

    logger.info(chalk.bold('\nInstalled Rulesets:\n'));

    const globalRulesets =
      options.global || !options.local
        ? ((await manager.listGlobalRulesets()) as ListedRuleset[])
        : [];
    const localRulesets =
      options.local || !options.global
        ? ((await manager.listLocalRulesets(process.cwd())) as ListedRuleset[])
        : [];

    if (globalRulesets.length > 0) {
      printGlobal(globalRulesets);
    }

    if (localRulesets.length > 0) {
      printLocal(localRulesets);
    }

    const allRulesets = [...globalRulesets, ...localRulesets];

    if (allRulesets.length === 0) {
      logger.info(chalk.yellow('No rulesets installed'));
      logger.info(
        chalk.dim('\nRun "rulesets install <package>" to install a ruleset')
      );
      logger.info(chalk.dim('Or "rulesets init" to create a local ruleset'));
    }
  } catch (error) {
    logger.error(chalk.red('Failed to list rulesets'));
    logger.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}

export function listCommand(): Command {
  return new Command('list')
    .description('List installed rulesets')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .option('-g, --global', 'List global rulesets')
    .option('-l, --local', 'List local project rulesets')
    .action(async (options) => {
      await runList(options);
    });
}
